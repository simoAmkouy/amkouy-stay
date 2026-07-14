import { logActivity } from '@/lib/queries/activity-log';
import { supabase } from '@/lib/supabase';
import { Database } from '@/types/supabase';
import { logAppError } from '@/utils/errors';

export type PropertyRow = Database['public']['Tables']['properties']['Row'];
export type PropertyInsert = Database['public']['Tables']['properties']['Insert'];
export type PropertyUpdate = Database['public']['Tables']['properties']['Update'];

type AssignedUser = { id: string; full_name: string } | null;

export type PropertyWithOwner = PropertyRow & {
  primaryOwner: { id: string; full_name: string } | null;
  assignedManager: AssignedUser;
  defaultCleaner: AssignedUser;
  acquiredByAgentUser: AssignedUser;
};

async function attachPrimaryOwners(properties: PropertyRow[]): Promise<PropertyWithOwner[]> {
  if (properties.length === 0) return [];
  const { data: links, error } = await supabase
    .from('property_owners')
    .select('property_id, owners(id, full_name)')
    .in(
      'property_id',
      properties.map((p) => p.id)
    )
    .eq('is_primary', true)
    .is('deleted_at', null);
  if (error) throw error;

  const userIds = Array.from(
    new Set(
      properties.flatMap((p) => [p.assigned_manager_id, p.default_cleaner_id, p.acquired_by_agent]).filter((v): v is string => !!v)
    )
  );
  const usersById = new Map<string, AssignedUser>();
  if (userIds.length > 0) {
    const { data: users, error: usersError } = await supabase.from('users').select('id, full_name').in('id', userIds);
    if (usersError) throw usersError;
    for (const u of users ?? []) usersById.set(u.id, u);
  }

  const ownerByProperty = new Map(links?.map((l) => [l.property_id, l.owners]) ?? []);
  return properties.map((p) => ({
    ...p,
    primaryOwner: ownerByProperty.get(p.id) ?? null,
    assignedManager: p.assigned_manager_id ? (usersById.get(p.assigned_manager_id) ?? null) : null,
    defaultCleaner: p.default_cleaner_id ? (usersById.get(p.default_cleaner_id) ?? null) : null,
    acquiredByAgentUser: p.acquired_by_agent ? (usersById.get(p.acquired_by_agent) ?? null) : null,
  }));
}

export type PropertyListFilters = {
  statuses?: PropertyRow['status'][];
};

export async function listProperties(filters: PropertyListFilters = {}): Promise<PropertyWithOwner[]> {
  let query = supabase.from('properties').select('*').is('deleted_at', null);
  if (filters.statuses && filters.statuses.length > 0) {
    query = query.in('status', filters.statuses);
  }
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw error;
  return attachPrimaryOwners(data ?? []);
}

export type PropertyAggregate = { revenue: number; occupancyRate: number };

/**
 * Per-property revenue and an occupancy proxy, for the Properties list's "Revenue" and
 * "Occupancy" sort options (Global Sorting & Filtering, Phase 6). Occupancy isn't a stored value
 * anywhere in the schema — it's computed here as booked nights (non-cancelled reservations)
 * falling within the trailing 90 days, divided by 90. That window is a deliberate, documented
 * choice (see Mission C report), not a precise "current occupancy %" the way a dedicated
 * calendar-availability engine would compute it.
 */
export async function listPropertyAggregates(): Promise<Record<string, PropertyAggregate>> {
  const windowDays = 90;
  const today = new Date();
  const windowStart = new Date(today);
  windowStart.setDate(windowStart.getDate() - windowDays);
  const windowStartStr = windowStart.toISOString().slice(0, 10);
  const todayStr = today.toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from('reservations')
    .select('property_id, total_amount, check_in_date, check_out_date')
    .is('deleted_at', null)
    .not('status', 'in', '(cancelled,no_show)');
  if (error) throw error;

  const revenueByProperty = new Map<string, number>();
  const nightsByProperty = new Map<string, number>();
  for (const r of data ?? []) {
    revenueByProperty.set(r.property_id, (revenueByProperty.get(r.property_id) ?? 0) + r.total_amount);
    const overlapStart = r.check_in_date > windowStartStr ? r.check_in_date : windowStartStr;
    const overlapEnd = r.check_out_date < todayStr ? r.check_out_date : todayStr;
    if (overlapStart < overlapEnd) {
      const nights = Math.round((new Date(overlapEnd).getTime() - new Date(overlapStart).getTime()) / 86_400_000);
      nightsByProperty.set(r.property_id, (nightsByProperty.get(r.property_id) ?? 0) + nights);
    }
  }

  const result: Record<string, PropertyAggregate> = {};
  for (const propertyId of new Set([...revenueByProperty.keys(), ...nightsByProperty.keys()])) {
    result[propertyId] = {
      revenue: revenueByProperty.get(propertyId) ?? 0,
      occupancyRate: (nightsByProperty.get(propertyId) ?? 0) / windowDays,
    };
  }
  return result;
}

export async function getProperty(id: string): Promise<PropertyWithOwner | null> {
  const { data, error } = await supabase
    .from('properties')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const [withOwner] = await attachPrimaryOwners([data]);
  return withOwner;
}

/** Reassigns the primary owner. Previous link is soft-deleted (never hard-deleted) so ownership
 * history is recoverable and attributable — Phase 5 (Ownership Audit Hardening): every row now
 * carries created_by/updated_by/deleted_by, matching every other table in the schema. */
async function setPrimaryOwner(propertyId: string, ownerId: string | null, actorId: string | null) {
  const nowIso = new Date().toISOString();
  await supabase
    .from('property_owners')
    .update({ deleted_at: nowIso, deleted_by: actorId })
    .eq('property_id', propertyId)
    .eq('is_primary', true)
    .is('deleted_at', null);
  if (ownerId) {
    const { error } = await supabase
      .from('property_owners')
      .insert({ property_id: propertyId, owner_id: ownerId, ownership_pct: 100, is_primary: true, created_by: actorId });
    if (error) throw error;
  }
}

async function currentActorId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export async function createProperty(input: PropertyInsert, ownerId: string | null) {
  const { data, error } = await supabase.from('properties').insert(input).select().single();
  if (error) {
    logAppError('properties.createProperty', error);
    throw error;
  }
  const actorId = await currentActorId();
  if (ownerId) await setPrimaryOwner(data.id, ownerId, actorId);
  await logActivity({ entityType: 'property', entityId: data.id, action: 'property.created', changes: { name: data.name } });
  return data;
}

const ASSIGNMENT_FIELDS = [
  ['assigned_manager_id', 'assignedManager'],
  ['default_cleaner_id', 'defaultCleaner'],
  ['acquired_by_agent', 'acquiredByAgent'],
] as const;

export async function updateProperty(id: string, input: PropertyUpdate, ownerId: string | null) {
  const { data: before, error: beforeError } = await supabase
    .from('properties')
    .select('assigned_manager_id, default_cleaner_id, acquired_by_agent')
    .eq('id', id)
    .maybeSingle();
  if (beforeError) throw beforeError;

  const { data, error } = await supabase.from('properties').update(input).eq('id', id).select().single();
  if (error) {
    logAppError('properties.updateProperty', error);
    throw error;
  }
  const actorId = await currentActorId();
  await setPrimaryOwner(id, ownerId, actorId);
  await logActivity({ entityType: 'property', entityId: id, action: 'property.updated' });

  // Phase 2 (Property Assignment Management): a dedicated, structured log entry per changed
  // assignment field — old value, new value — separate from the generic "updated" entry above.
  if (before) {
    for (const [column, label] of ASSIGNMENT_FIELDS) {
      const oldValue = before[column];
      const newValue = data[column];
      if (oldValue !== newValue) {
        await logActivity({
          entityType: 'property',
          entityId: id,
          action: 'property.reassigned',
          changes: { field: label, old_value: oldValue, new_value: newValue },
        });
      }
    }
  }
  return data;
}

/** Soft delete: sets deleted_at, never issues a real DELETE (see DATABASE_SCHEMA.md §7). */
export async function softDeleteProperty(id: string) {
  const actorId = await currentActorId();
  const { error } = await supabase
    .from('properties')
    .update({ deleted_at: new Date().toISOString(), deleted_by: actorId })
    .eq('id', id);
  if (error) {
    logAppError('properties.softDeleteProperty', error);
    throw error;
  }
  await logActivity({ entityType: 'property', entityId: id, action: 'property.archived' });
}

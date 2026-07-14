import { logActivity } from '@/lib/queries/activity-log';
import { supabase } from '@/lib/supabase';
import { Database } from '@/types/supabase';
import { logAppError } from '@/utils/errors';

export type OwnerRow = Database['public']['Tables']['owners']['Row'];
export type OwnerInsert = Database['public']['Tables']['owners']['Insert'];
export type OwnerUpdate = Database['public']['Tables']['owners']['Update'];

/** Owner Portal only — resolves the signed-in user's own `owners.id` so owner-scoped report RPCs
 * (which take an explicit `p_owner_id`) can be called. RLS still independently restricts the
 * result to the caller's own row regardless of what id is queried. */
export async function getMyOwnerId(userId: string): Promise<string | null> {
  const { data, error } = await supabase.from('owners').select('id').eq('user_id', userId).maybeSingle();
  if (error) {
    logAppError('owners.getMyOwnerId', error);
    throw error;
  }
  return data?.id ?? null;
}

export async function listOwners(): Promise<OwnerRow[]> {
  const { data, error } = await supabase
    .from('owners')
    .select('*')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getOwner(id: string): Promise<OwnerRow | null> {
  const { data, error } = await supabase
    .from('owners')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function createOwner(input: OwnerInsert): Promise<OwnerRow> {
  const { data, error } = await supabase.from('owners').insert(input).select().single();
  if (error) {
    logAppError('owners.createOwner', error);
    throw error;
  }
  await logActivity({ entityType: 'owner', entityId: data.id, action: 'owner.created', changes: { full_name: data.full_name } });
  return data;
}

export async function updateOwner(id: string, input: OwnerUpdate): Promise<OwnerRow> {
  const { data, error } = await supabase.from('owners').update(input).eq('id', id).select().single();
  if (error) {
    logAppError('owners.updateOwner', error);
    throw error;
  }
  await logActivity({ entityType: 'owner', entityId: id, action: 'owner.updated' });
  return data;
}

/** Soft delete: sets deleted_at, never issues a real DELETE (see DATABASE_SCHEMA.md §7). */
export async function softDeleteOwner(id: string) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase
    .from('owners')
    .update({ deleted_at: new Date().toISOString(), deleted_by: user?.id ?? null })
    .eq('id', id);
  if (error) {
    logAppError('owners.softDeleteOwner', error);
    throw error;
  }
  await logActivity({ entityType: 'owner', entityId: id, action: 'owner.archived' });
}

export type OwnerAggregate = { propertyCount: number; revenue: number };

/**
 * Per-owner property count and revenue, for the Owners list's "Property Count" and "Revenue"
 * sort options (Global Sorting & Filtering, Phase 5). Revenue is attributed to each property's
 * primary owner only (matching `setPrimaryOwner`'s existing primary-ownership convention
 * elsewhere) rather than split by `ownership_pct` — co-ownership revenue splitting is a bigger
 * financial-model question outside this list-sorting task's scope. Computed client-side from two
 * flat queries (not a DB view/RPC) since it's cheap at current dataset size — see Mission C
 * performance validation.
 */
export async function listOwnerAggregates(): Promise<Record<string, OwnerAggregate>> {
  const { data: links, error: linksError } = await supabase
    .from('property_owners')
    .select('owner_id, property_id, is_primary')
    .is('deleted_at', null);
  if (linksError) {
    logAppError('owners.listOwnerAggregates (links)', linksError);
    throw linksError;
  }

  const propertyToPrimaryOwner = new Map<string, string>();
  const countByOwner = new Map<string, number>();
  for (const link of links ?? []) {
    countByOwner.set(link.owner_id, (countByOwner.get(link.owner_id) ?? 0) + 1);
    if (link.is_primary) propertyToPrimaryOwner.set(link.property_id, link.owner_id);
  }

  const { data: reservations, error: resError } = await supabase
    .from('reservations')
    .select('property_id, total_amount')
    .is('deleted_at', null);
  if (resError) {
    logAppError('owners.listOwnerAggregates (reservations)', resError);
    throw resError;
  }

  const revenueByOwner = new Map<string, number>();
  for (const r of reservations ?? []) {
    const ownerId = propertyToPrimaryOwner.get(r.property_id);
    if (!ownerId) continue;
    revenueByOwner.set(ownerId, (revenueByOwner.get(ownerId) ?? 0) + r.total_amount);
  }

  const result: Record<string, OwnerAggregate> = {};
  for (const ownerId of new Set([...countByOwner.keys(), ...revenueByOwner.keys()])) {
    result[ownerId] = {
      propertyCount: countByOwner.get(ownerId) ?? 0,
      revenue: revenueByOwner.get(ownerId) ?? 0,
    };
  }
  return result;
}

export async function listOwnerProperties(ownerId: string) {
  const { data, error } = await supabase
    .from('property_owners')
    .select('ownership_pct, is_primary, properties(id, name, city, base_nightly_rate)')
    .eq('owner_id', ownerId)
    .is('deleted_at', null);
  if (error) throw error;
  return (data ?? [])
    .map((row) => row.properties)
    .filter((p): p is NonNullable<typeof p> => p !== null);
}

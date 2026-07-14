import { logActivity } from '@/lib/queries/activity-log';
import { notifyUsers } from '@/lib/queries/notifications';
import { supabase } from '@/lib/supabase';
import { listStaffUserIds } from '@/lib/queries/users';
import { Database } from '@/types/supabase';
import { logAppError } from '@/utils/errors';

export type CommercialLeadRow = Database['public']['Tables']['commercial_leads']['Row'];
export type LeadStatus = Database['public']['Enums']['lead_status'];

export type CommercialLeadWithRelations = CommercialLeadRow & {
  assignedAgent: { id: string; full_name: string } | null;
};

const SELECT = '*, assignedAgent:users!commercial_leads_assigned_to_fkey(id, full_name)';

export type CommercialLeadListFilters = {
  statuses?: LeadStatus[];
};

/** Staff see every lead (Phase 8 KPI engine needs cross-agent visibility); an agent sees only
 * leads assigned to them — enforced by `commercial_leads_select` RLS, not filtered here. */
export async function listCommercialLeads(filters: CommercialLeadListFilters = {}): Promise<CommercialLeadWithRelations[]> {
  let query = supabase.from('commercial_leads').select(SELECT).is('deleted_at', null);
  if (filters.statuses && filters.statuses.length > 0) {
    query = query.in('status', filters.statuses);
  }
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) {
    logAppError('commercial-leads.listCommercialLeads', error);
    throw error;
  }
  return (data ?? []) as unknown as CommercialLeadWithRelations[];
}

export async function getCommercialLead(id: string): Promise<CommercialLeadWithRelations | null> {
  const { data, error } = await supabase.from('commercial_leads').select(SELECT).eq('id', id).is('deleted_at', null).maybeSingle();
  if (error) {
    logAppError('commercial-leads.getCommercialLead', error);
    throw error;
  }
  return data as unknown as CommercialLeadWithRelations | null;
}

export type CommercialLeadInput = {
  ownerName: string;
  phone?: string;
  email?: string;
  source?: string;
  propertyType?: Database['public']['Enums']['property_type'] | null;
  city?: string;
  estimatedUnits?: number | null;
  notes?: string;
  assignedTo?: string | null;
};

export async function createCommercialLead(input: CommercialLeadInput): Promise<CommercialLeadRow> {
  const { data, error } = await supabase
    .from('commercial_leads')
    .insert({
      owner_name: input.ownerName,
      phone: input.phone || null,
      email: input.email || null,
      source: input.source || null,
      property_type: input.propertyType ?? null,
      city: input.city || null,
      estimated_units: input.estimatedUnits ?? null,
      notes: input.notes || null,
      assigned_to: input.assignedTo ?? null,
    })
    .select()
    .single();
  if (error) {
    logAppError('commercial-leads.createCommercialLead', error);
    throw error;
  }
  await logActivity({ entityType: 'commercial_lead', entityId: data.id, action: 'commercial_lead.created' });
  if (input.assignedTo) {
    await notifyUsers({
      userIds: [input.assignedTo],
      type: 'commercial',
      title: 'Lead assigné',
      body: `${input.ownerName} · ${input.city ?? ''}`,
      relatedEntityType: 'commercial_lead',
      relatedEntityId: data.id,
    });
  }
  return data;
}

export async function updateCommercialLead(id: string, input: Partial<CommercialLeadInput>): Promise<CommercialLeadRow> {
  const { data, error } = await supabase
    .from('commercial_leads')
    .update({
      owner_name: input.ownerName,
      phone: input.phone,
      email: input.email,
      source: input.source,
      property_type: input.propertyType,
      city: input.city,
      estimated_units: input.estimatedUnits,
      notes: input.notes,
      assigned_to: input.assignedTo,
    })
    .eq('id', id)
    .select()
    .single();
  if (error) {
    logAppError('commercial-leads.updateCommercialLead', error);
    throw error;
  }
  await logActivity({ entityType: 'commercial_lead', entityId: id, action: 'commercial_lead.updated' });
  return data;
}

/** Phase 3 (Commercial Lead Reassignment) — a dedicated action distinct from the generic
 * `updateCommercialLead`, so the audit trail records a clean old-agent → new-agent transfer
 * rather than a generic "updated" entry. Only ever touches `assigned_to`: conversion history
 * (`converted_property_id`), commissions, and every other field are untouched — reassigning a
 * lead changes ownership going forward, it never rewrites what already happened. */
export async function reassignCommercialLeadAgent(id: string, newAgentId: string): Promise<CommercialLeadRow> {
  const { data: before, error: beforeError } = await supabase
    .from('commercial_leads')
    .select('assigned_to')
    .eq('id', id)
    .maybeSingle();
  if (beforeError) throw beforeError;

  const { data, error } = await supabase
    .from('commercial_leads')
    .update({ assigned_to: newAgentId })
    .eq('id', id)
    .select()
    .single();
  if (error) {
    logAppError('commercial-leads.reassignCommercialLeadAgent', error);
    throw error;
  }
  await logActivity({
    entityType: 'commercial_lead',
    entityId: id,
    action: 'commercial_lead.reassigned',
    changes: { old_agent: before?.assigned_to ?? null, new_agent: newAgentId },
  });
  await notifyUsers({
    userIds: [newAgentId],
    type: 'commercial',
    title: 'Lead transféré',
    body: `${data.owner_name} · ${data.lead_number}`,
    relatedEntityType: 'commercial_lead',
    relatedEntityId: id,
  });
  return data;
}

const STATUS_NOTIFICATION_TITLE: Partial<Record<LeadStatus, string>> = {
  visit_scheduled: 'Visite planifiée',
  proposal_sent: 'Proposition envoyée',
  won: 'Lead gagné',
  lost: 'Lead perdu',
};

/** Status transitions are their own action (not folded into the generic update) because
 * won/lost need staff-wide visibility (Phase 12), not just the assigned agent. */
export async function updateLeadStatus(id: string, status: LeadStatus): Promise<CommercialLeadRow> {
  const { data, error } = await supabase.from('commercial_leads').update({ status }).eq('id', id).select().single();
  if (error) {
    logAppError('commercial-leads.updateLeadStatus', error);
    throw error;
  }
  await logActivity({ entityType: 'commercial_lead', entityId: id, action: `commercial_lead.${status}` });
  const title = STATUS_NOTIFICATION_TITLE[status];
  if (title) {
    const recipients = status === 'won' || status === 'lost' ? await listStaffUserIds() : data.assigned_to ? [data.assigned_to] : [];
    await notifyUsers({
      userIds: recipients,
      type: 'commercial',
      title,
      body: `${data.owner_name} · ${data.lead_number}`,
      priority: status === 'won' ? 'info' : status === 'lost' ? 'warning' : 'info',
      relatedEntityType: 'commercial_lead',
      relatedEntityId: id,
    });
  }
  return data;
}

export type ConvertLeadResult = { ownerId: string; propertyId: string; contractId: string };

/** Phase 3 — calls the SECURITY DEFINER RPC rather than inserting into owners/properties/
 * contracts directly (those are is_staff()-only under RLS; the RPC does its own internal
 * authorization check so an agent can convert their own won lead without needing staff access
 * to every other table). */
export async function convertLeadToOwner(leadId: string): Promise<ConvertLeadResult> {
  const { data, error } = await supabase.rpc('convert_lead_to_owner', { p_lead_id: leadId });
  if (error) {
    logAppError('commercial-leads.convertLeadToOwner', error);
    throw error;
  }
  const row = data?.[0];
  if (!row) throw new Error('Conversion did not return a result.');
  await logActivity({ entityType: 'commercial_lead', entityId: leadId, action: 'commercial_lead.converted', changes: { property_id: row.property_id } });
  const staffIds = await listStaffUserIds();
  await notifyUsers({
    userIds: staffIds,
    type: 'commercial',
    title: 'Lead converti en propriétaire',
    relatedEntityType: 'property',
    relatedEntityId: row.property_id,
  });
  return { ownerId: row.owner_id, propertyId: row.property_id, contractId: row.contract_id };
}

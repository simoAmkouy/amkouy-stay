import { logActivity } from '@/lib/queries/activity-log';
import { notifyUsers } from '@/lib/queries/notifications';
import { listStaffUserIds } from '@/lib/queries/users';
import { supabase } from '@/lib/supabase';
import { Database } from '@/types/supabase';
import { logAppError } from '@/utils/errors';

export type MaintenanceTicketRow = Database['public']['Tables']['maintenance_tickets']['Row'];
export type MaintenanceStatus = Database['public']['Enums']['maintenance_status'];
export type MaintenancePriority = Database['public']['Enums']['maintenance_priority'];
export type MaintenanceCategory = Database['public']['Enums']['maintenance_category'];

export type MaintenanceTicketWithRelations = MaintenanceTicketRow & {
  property: { id: string; name: string } | null;
  reportedByUser: { id: string; full_name: string } | null;
  technician: { id: string; full_name: string } | null;
};

const SELECT =
  '*, property:properties(id, name), reportedByUser:users!maintenance_tickets_reported_by_fkey(id, full_name), technician:users!maintenance_tickets_assigned_to_user_id_fkey(id, full_name)';

const OPEN_STATUSES: MaintenanceStatus[] = ['open', 'assigned', 'in_progress', 'on_hold'];

export type MaintenanceTicketListFilters = {
  statuses?: MaintenanceStatus[];
  propertyId?: string | null;
};

export async function listMaintenanceTickets(
  filters: MaintenanceTicketListFilters = {}
): Promise<MaintenanceTicketWithRelations[]> {
  let query = supabase.from('maintenance_tickets').select(SELECT).is('deleted_at', null);
  if (filters.statuses && filters.statuses.length > 0) {
    query = query.in('status', filters.statuses);
  }
  if (filters.propertyId) {
    query = query.eq('property_id', filters.propertyId);
  }
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) {
    logAppError('maintenance-tickets.listMaintenanceTickets', error);
    throw error;
  }
  return (data ?? []) as unknown as MaintenanceTicketWithRelations[];
}

export async function getMaintenanceTicket(id: string): Promise<MaintenanceTicketWithRelations | null> {
  const { data, error } = await supabase
    .from('maintenance_tickets')
    .select(SELECT)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) {
    logAppError('maintenance-tickets.getMaintenanceTicket', error);
    throw error;
  }
  return data as unknown as MaintenanceTicketWithRelations | null;
}

export type MaintenanceTicketCreateInput = {
  propertyId: string;
  reservationId?: string | null;
  cleaningTaskId?: string | null;
  category: MaintenanceCategory;
  priority: MaintenancePriority;
  issueSummary: string;
  description?: string;
  scheduledDate?: string | null;
  estimatedCost?: number | null;
  reportedBy: string;
};

export async function createMaintenanceTicket(input: MaintenanceTicketCreateInput): Promise<MaintenanceTicketRow> {
  const { data, error } = await supabase
    .from('maintenance_tickets')
    .insert({
      property_id: input.propertyId,
      reservation_id: input.reservationId ?? null,
      cleaning_task_id: input.cleaningTaskId ?? null,
      category: input.category,
      priority: input.priority,
      issue_summary: input.issueSummary,
      description: input.description || null,
      scheduled_date: input.scheduledDate ?? null,
      estimated_cost: input.estimatedCost ?? null,
      reported_by: input.reportedBy,
      status: 'open',
    })
    .select()
    .single();
  if (error) {
    logAppError('maintenance-tickets.createMaintenanceTicket', error);
    throw error;
  }
  await logActivity({ entityType: 'maintenance_ticket', entityId: data.id, action: 'maintenance_ticket.created' });
  const staffIds = await listStaffUserIds();
  await notifyUsers({
    userIds: staffIds,
    type: 'maintenance',
    title: 'Nouveau ticket de maintenance',
    body: `${data.ticket_number} · ${input.issueSummary}`,
    priority: input.priority === 'urgent' ? 'urgent' : 'info',
    relatedEntityType: 'maintenance_ticket',
    relatedEntityId: data.id,
  });
  return data;
}

export async function assignTechnician(id: string, userId: string): Promise<MaintenanceTicketRow> {
  const { data, error } = await supabase
    .from('maintenance_tickets')
    .update({ assigned_to_user_id: userId, status: 'assigned' })
    .eq('id', id)
    .select()
    .single();
  if (error) {
    logAppError('maintenance-tickets.assignTechnician', error);
    throw error;
  }
  await logActivity({ entityType: 'maintenance_ticket', entityId: id, action: 'maintenance_ticket.assigned' });
  await notifyUsers({
    userIds: [userId],
    type: 'maintenance',
    title: 'Ticket assigné',
    body: `${data.ticket_number} · ${data.issue_summary}`,
    priority: data.priority === 'urgent' ? 'urgent' : 'info',
    relatedEntityType: 'maintenance_ticket',
    relatedEntityId: id,
  });
  return data;
}

export async function startWork(id: string): Promise<MaintenanceTicketRow> {
  const { data, error } = await supabase
    .from('maintenance_tickets')
    .update({ status: 'in_progress', started_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) {
    logAppError('maintenance-tickets.startWork', error);
    throw error;
  }
  await logActivity({ entityType: 'maintenance_ticket', entityId: id, action: 'maintenance_ticket.started' });
  const staffIds = await listStaffUserIds();
  await notifyUsers({
    userIds: staffIds,
    type: 'maintenance',
    title: 'Travaux démarrés',
    body: `${data.ticket_number} · ${data.issue_summary}`,
    relatedEntityType: 'maintenance_ticket',
    relatedEntityId: id,
  });
  return data;
}

export async function holdForParts(id: string, notes?: string): Promise<MaintenanceTicketRow> {
  const { data, error } = await supabase
    .from('maintenance_tickets')
    .update({ status: 'on_hold', notes: notes || null })
    .eq('id', id)
    .select()
    .single();
  if (error) {
    logAppError('maintenance-tickets.holdForParts', error);
    throw error;
  }
  await logActivity({ entityType: 'maintenance_ticket', entityId: id, action: 'maintenance_ticket.on_hold' });
  return data;
}

export async function completeTicket(
  id: string,
  input: { actualCost: number | null; notes?: string }
): Promise<MaintenanceTicketRow> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('maintenance_tickets')
    .update({
      status: 'resolved',
      completed_at: now,
      resolved_at: now,
      actual_cost: input.actualCost,
      notes: input.notes || null,
    })
    .eq('id', id)
    .select()
    .single();
  if (error) {
    logAppError('maintenance-tickets.completeTicket', error);
    throw error;
  }
  await logActivity({ entityType: 'maintenance_ticket', entityId: id, action: 'maintenance_ticket.completed' });
  const staffIds = await listStaffUserIds();
  await notifyUsers({
    userIds: staffIds,
    type: 'maintenance',
    title: 'Réparation terminée',
    body: `${data.ticket_number} · en attente de vérification`,
    relatedEntityType: 'maintenance_ticket',
    relatedEntityId: id,
  });
  return data;
}

export async function verifyTicket(id: string): Promise<MaintenanceTicketRow> {
  const { data, error } = await supabase
    .from('maintenance_tickets')
    .update({ status: 'closed' })
    .eq('id', id)
    .select()
    .single();
  if (error) {
    logAppError('maintenance-tickets.verifyTicket', error);
    throw error;
  }
  await logActivity({ entityType: 'maintenance_ticket', entityId: id, action: 'maintenance_ticket.verified' });
  return data;
}

export async function cancelTicket(id: string): Promise<MaintenanceTicketRow> {
  const { data, error } = await supabase
    .from('maintenance_tickets')
    .update({ status: 'cancelled' })
    .eq('id', id)
    .select()
    .single();
  if (error) {
    logAppError('maintenance-tickets.cancelTicket', error);
    throw error;
  }
  await logActivity({ entityType: 'maintenance_ticket', entityId: id, action: 'maintenance_ticket.cancelled' });
  return data;
}

/** Distinct properties currently holding at least one open ticket — the Operations screen's
 * "Propriétés en maintenance" widget; deliberately not a general 5-state occupancy engine, since
 * this is the only place that needs it. */
export async function listPropertiesUnderMaintenance(): Promise<{ propertyId: string; propertyName: string; openCount: number }[]> {
  const { data, error } = await supabase
    .from('maintenance_tickets')
    .select('property_id, status, property:properties(id, name)')
    .is('deleted_at', null)
    .in('status', OPEN_STATUSES);
  if (error) {
    logAppError('maintenance-tickets.listPropertiesUnderMaintenance', error);
    throw error;
  }
  const byProperty = new Map<string, { propertyId: string; propertyName: string; openCount: number }>();
  for (const row of (data ?? []) as unknown as { property_id: string; property: { id: string; name: string } | null }[]) {
    const existing = byProperty.get(row.property_id);
    if (existing) existing.openCount += 1;
    else byProperty.set(row.property_id, { propertyId: row.property_id, propertyName: row.property?.name ?? '—', openCount: 1 });
  }
  return Array.from(byProperty.values());
}

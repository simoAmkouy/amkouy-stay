import { logActivity } from '@/lib/queries/activity-log';
import { notifyUsers } from '@/lib/queries/notifications';
import { listStaffUserIds } from '@/lib/queries/users';
import { supabase } from '@/lib/supabase';
import { Database } from '@/types/supabase';
import { logAppError } from '@/utils/errors';

export type ReservationServiceRow = Database['public']['Tables']['reservation_services']['Row'];
export type ReservationServiceUpdate = Database['public']['Tables']['reservation_services']['Update'];
export type ReservationServiceStatus = Database['public']['Enums']['reservation_service_status'];

export type ReservationServiceWithRelations = ReservationServiceRow & {
  service: { id: string; name: string; category: string } | null;
  provider: { id: string; name: string } | null;
};

const SELECT = '*, service:services(id, name, category), provider:service_providers(id, name)';

export async function listReservationServices(reservationId: string): Promise<ReservationServiceWithRelations[]> {
  const { data, error } = await supabase
    .from('reservation_services')
    .select(SELECT)
    .eq('reservation_id', reservationId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as ReservationServiceWithRelations[];
}

export type ReservationServiceForOperations = ReservationServiceWithRelations & {
  reservation: { id: string; guest: { full_name: string } | null; property: { name: string } | null } | null;
};

/** Cross-reservation feed for the Operations screen's concierge sections — never scoped to
 * one reservation, unlike `listReservationServices`. */
export async function listActiveReservationServices(): Promise<ReservationServiceForOperations[]> {
  const { data, error } = await supabase
    .from('reservation_services')
    .select(
      `${SELECT}, reservation:reservations(id, guest:guests(full_name), property:properties(name))`
    )
    .is('deleted_at', null)
    .not('status', 'in', '(cancelled,refunded,delivered)')
    .order('scheduled_date', { ascending: true });
  if (error) {
    logAppError('reservation-services.listActiveReservationServices', error);
    throw error;
  }
  return (data ?? []) as unknown as ReservationServiceForOperations[];
}

/** Every non-deleted request regardless of status — for the Operations Center, which needs
 * "Completed Today" and per-provider/team performance stats alongside the active-only buckets. */
export async function listAllReservationServicesForOps(): Promise<ReservationServiceForOperations[]> {
  const { data, error } = await supabase
    .from('reservation_services')
    .select(
      `${SELECT}, reservation:reservations(id, guest:guests(full_name), property:properties(name))`
    )
    .is('deleted_at', null)
    .order('scheduled_date', { ascending: true });
  if (error) {
    logAppError('reservation-services.listAllReservationServicesForOps', error);
    throw error;
  }
  return (data ?? []) as unknown as ReservationServiceForOperations[];
}

export type ReservationServiceFormInput = {
  serviceId: string;
  providerId: string | null;
  quantity: number;
  unitPrice: number;
  costAmount: number | null;
  status: ReservationServiceStatus;
  scheduledDate?: string | null;
  scheduledTime?: string | null;
  notes?: string;
};

function toPayload(input: ReservationServiceFormInput) {
  return {
    service_id: input.serviceId,
    provider_id: input.providerId,
    quantity: input.quantity,
    unit_price: input.unitPrice,
    cost_amount: input.costAmount,
    status: input.status,
    scheduled_date: input.scheduledDate || null,
    scheduled_time: input.scheduledTime || null,
    notes: input.notes || null,
  };
}

export async function createReservationService(
  reservationId: string,
  input: ReservationServiceFormInput
): Promise<ReservationServiceRow> {
  const { data, error } = await supabase
    .from('reservation_services')
    .insert({ ...toPayload(input), reservation_id: reservationId })
    .select()
    .single();
  if (error) {
    logAppError('reservation-services.createReservationService', error);
    throw error;
  }

  await logActivity({
    entityType: 'reservation',
    entityId: reservationId,
    action: 'reservation_service.added',
    changes: { quantity: data.quantity, unit_price: data.unit_price },
  });
  const staffIds = await listStaffUserIds();
  await notifyUsers({
    userIds: staffIds,
    type: 'concierge',
    title: 'Nouvelle demande de service',
    body: data.request_number,
    relatedEntityType: 'reservation_service',
    relatedEntityId: data.id,
  });
  return data;
}

export async function updateReservationService(
  id: string,
  reservationId: string,
  input: ReservationServiceFormInput
): Promise<ReservationServiceRow> {
  const { data, error } = await supabase
    .from('reservation_services')
    .update(toPayload(input))
    .eq('id', id)
    .select()
    .single();
  if (error) {
    logAppError('reservation-services.updateReservationService', error);
    throw error;
  }

  await logActivity({
    entityType: 'reservation',
    entityId: reservationId,
    action: 'reservation_service.updated',
    changes: { status: data.status },
  });
  return data;
}

/** Requested → Confirmed. No dedicated notification (not in the spec's trigger list). */
export async function confirmReservationService(id: string, reservationId: string): Promise<ReservationServiceRow> {
  const { data, error } = await supabase
    .from('reservation_services')
    .update({ status: 'accepted' })
    .eq('id', id)
    .select()
    .single();
  if (error) {
    logAppError('reservation-services.confirmReservationService', error);
    throw error;
  }
  await logActivity({ entityType: 'reservation', entityId: reservationId, action: 'reservation_service.confirmed' });
  return data;
}

export async function startReservationService(id: string, reservationId: string): Promise<ReservationServiceRow> {
  const { data, error } = await supabase
    .from('reservation_services')
    .update({ status: 'in_progress' })
    .eq('id', id)
    .select()
    .single();
  if (error) {
    logAppError('reservation-services.startReservationService', error);
    throw error;
  }
  await logActivity({ entityType: 'reservation', entityId: reservationId, action: 'reservation_service.started' });
  const staffIds = await listStaffUserIds();
  await notifyUsers({
    userIds: staffIds,
    type: 'concierge',
    title: 'Service démarré',
    body: data.request_number,
    relatedEntityType: 'reservation_service',
    relatedEntityId: id,
  });
  return data;
}

/**
 * Completed → Refunded. CB-08 (Launch Readiness Audit): this used to only flip the status flag,
 * with nothing recording who refunded what amount or when.
 *
 * An earlier version of this fix routed the refund through `payments`/`refundPayment` (the same
 * path the reservation-level "Rembourser" button uses) — reverted after checking the actual RPC
 * definitions live: `get_reservation_payment_summary` and `report_portfolio_summary` both treat
 * every `payments` row scoped to a reservation as an ACCOMMODATION cash movement (`reservation_
 * total`/`outstanding` there are `reservations.total_amount`, which never includes concierge
 * revenue). A concierge service's revenue is tracked entirely separately and already correctly
 * self-corrects on refund — `report_portfolio_summary`'s `concierge` CTE excludes any service whose
 * `status = 'refunded'` from concierge revenue the moment this update lands. Also inserting a
 * `payments` refund row would have DOUBLE-COUNTED that same amount a second time (subtracted again
 * from `total_net_revenue`/`total_profit`), and would have inflated the reservation's accommodation
 * "Reste dû" for money the guest never owed on their room. Fixed correctly instead: this now
 * records the actual amount/context on the activity log entry — a genuine, timestamped,
 * attributable record (who, what amount, which request) — without corrupting either trusted RPC or
 * writing to `ledger_entries`, which is DB-trigger-only by design (see payments.ts's own comment on
 * that table).
 */
export async function refundReservationService(id: string, reservationId: string): Promise<ReservationServiceRow> {
  const { data, error } = await supabase
    .from('reservation_services')
    .update({ status: 'refunded' })
    .eq('id', id)
    .select()
    .single();
  if (error) {
    logAppError('reservation-services.refundReservationService', error);
    throw error;
  }

  await logActivity({
    entityType: 'reservation',
    entityId: reservationId,
    action: 'reservation_service.refunded',
    changes: { request_number: data.request_number, refunded_amount: data.total_price ?? 0 },
  });
  return data;
}

export async function assignProvider(
  id: string,
  reservationId: string,
  providerId: string
): Promise<ReservationServiceRow> {
  const { data, error } = await supabase
    .from('reservation_services')
    .update({ provider_id: providerId })
    .eq('id', id)
    .select()
    .single();
  if (error) {
    logAppError('reservation-services.assignProvider', error);
    throw error;
  }
  await logActivity({ entityType: 'reservation', entityId: reservationId, action: 'reservation_service.provider_assigned' });
  const staffIds = await listStaffUserIds();
  await notifyUsers({
    userIds: staffIds,
    type: 'concierge',
    title: 'Prestataire assigné',
    body: data.request_number,
    relatedEntityType: 'reservation_service',
    relatedEntityId: id,
  });
  return data;
}

export async function scheduleReservationService(
  id: string,
  reservationId: string,
  input: { scheduledDate: string; scheduledTime?: string | null }
): Promise<ReservationServiceRow> {
  const { data, error } = await supabase
    .from('reservation_services')
    .update({ scheduled_date: input.scheduledDate, scheduled_time: input.scheduledTime || null, status: 'scheduled' })
    .eq('id', id)
    .select()
    .single();
  if (error) {
    logAppError('reservation-services.scheduleReservationService', error);
    throw error;
  }
  await logActivity({ entityType: 'reservation', entityId: reservationId, action: 'reservation_service.scheduled' });
  const staffIds = await listStaffUserIds();
  await notifyUsers({
    userIds: staffIds,
    type: 'concierge',
    title: 'Service planifié',
    body: data.request_number,
    relatedEntityType: 'reservation_service',
    relatedEntityId: id,
  });
  return data;
}

export async function completeReservationService(
  id: string,
  reservationId: string
): Promise<ReservationServiceRow> {
  const { data, error } = await supabase
    .from('reservation_services')
    .update({ status: 'delivered', completion_date: new Date().toISOString().slice(0, 10) })
    .eq('id', id)
    .select()
    .single();
  if (error) {
    logAppError('reservation-services.completeReservationService', error);
    throw error;
  }
  await logActivity({ entityType: 'reservation', entityId: reservationId, action: 'reservation_service.completed' });
  const staffIds = await listStaffUserIds();
  await notifyUsers({
    userIds: staffIds,
    type: 'concierge',
    title: 'Service terminé',
    body: data.request_number,
    relatedEntityType: 'reservation_service',
    relatedEntityId: id,
  });
  return data;
}

export async function cancelReservationService(id: string, reservationId: string): Promise<ReservationServiceRow> {
  const { data, error } = await supabase
    .from('reservation_services')
    .update({ status: 'cancelled' })
    .eq('id', id)
    .select()
    .single();
  if (error) {
    logAppError('reservation-services.cancelReservationService', error);
    throw error;
  }
  await logActivity({ entityType: 'reservation', entityId: reservationId, action: 'reservation_service.cancelled' });
  const staffIds = await listStaffUserIds();
  await notifyUsers({
    userIds: staffIds,
    type: 'concierge',
    title: 'Service annulé',
    body: data.request_number,
    relatedEntityType: 'reservation_service',
    relatedEntityId: id,
  });
  return data;
}

/** Soft delete: sets deleted_at, never issues a real DELETE (see DATABASE_SCHEMA.md §7). */
export async function softDeleteReservationService(id: string, reservationId: string, requestNumber: string) {
  const { error } = await supabase
    .from('reservation_services')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);
  if (error) {
    logAppError('reservation-services.softDeleteReservationService', error);
    throw error;
  }

  await logActivity({
    entityType: 'reservation',
    entityId: reservationId,
    action: 'reservation_service.removed',
    changes: { request_number: requestNumber },
  });
}

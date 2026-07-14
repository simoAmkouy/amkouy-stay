import { logActivity } from '@/lib/queries/activity-log';
import { notifyUsers } from '@/lib/queries/notifications';
import { supabase } from '@/lib/supabase';
import { listStaffUserIds } from '@/lib/queries/users';
import { Database } from '@/types/supabase';
import { logAppError } from '@/utils/errors';

export type ReservationLeadRow = Database['public']['Tables']['commercial_reservation_leads']['Row'];
export type ReservationLeadStatus = Database['public']['Enums']['reservation_lead_status'];

export type ReservationLeadWithRelations = ReservationLeadRow & {
  assignedAgent: { id: string; full_name: string } | null;
  property: { id: string; name: string } | null;
};

const SELECT =
  '*, assignedAgent:users!commercial_reservation_leads_assigned_to_fkey(id, full_name), property:properties(id, name)';

export async function listReservationLeads(): Promise<ReservationLeadWithRelations[]> {
  const { data, error } = await supabase
    .from('commercial_reservation_leads')
    .select(SELECT)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error) {
    logAppError('reservation-leads.listReservationLeads', error);
    throw error;
  }
  return (data ?? []) as unknown as ReservationLeadWithRelations[];
}

export async function getReservationLead(id: string): Promise<ReservationLeadWithRelations | null> {
  const { data, error } = await supabase.from('commercial_reservation_leads').select(SELECT).eq('id', id).is('deleted_at', null).maybeSingle();
  if (error) {
    logAppError('reservation-leads.getReservationLead', error);
    throw error;
  }
  return data as unknown as ReservationLeadWithRelations | null;
}

export type ReservationLeadInput = {
  guestName: string;
  phone?: string;
  email?: string;
  checkIn?: string | null;
  checkOut?: string | null;
  guestsCount?: number | null;
  propertyId?: string | null;
  source?: string;
  notes?: string;
  assignedTo?: string | null;
};

export async function createReservationLead(input: ReservationLeadInput): Promise<ReservationLeadRow> {
  const { data, error } = await supabase
    .from('commercial_reservation_leads')
    .insert({
      guest_name: input.guestName,
      phone: input.phone || null,
      email: input.email || null,
      check_in: input.checkIn || null,
      check_out: input.checkOut || null,
      guests_count: input.guestsCount ?? null,
      property_id: input.propertyId ?? null,
      source: input.source || null,
      notes: input.notes || null,
      assigned_to: input.assignedTo ?? null,
    })
    .select()
    .single();
  if (error) {
    logAppError('reservation-leads.createReservationLead', error);
    throw error;
  }
  await logActivity({ entityType: 'reservation_lead', entityId: data.id, action: 'reservation_lead.created' });
  if (input.assignedTo) {
    await notifyUsers({
      userIds: [input.assignedTo],
      type: 'commercial',
      title: 'Lead réservation assigné',
      body: input.guestName,
      relatedEntityType: 'reservation_lead',
      relatedEntityId: data.id,
    });
  }
  return data;
}

export async function updateReservationLead(id: string, input: Partial<ReservationLeadInput>): Promise<ReservationLeadRow> {
  const { data, error } = await supabase
    .from('commercial_reservation_leads')
    .update({
      guest_name: input.guestName,
      phone: input.phone,
      email: input.email,
      check_in: input.checkIn,
      check_out: input.checkOut,
      guests_count: input.guestsCount,
      property_id: input.propertyId,
      source: input.source,
      notes: input.notes,
      assigned_to: input.assignedTo,
    })
    .eq('id', id)
    .select()
    .single();
  if (error) {
    logAppError('reservation-leads.updateReservationLead', error);
    throw error;
  }
  await logActivity({ entityType: 'reservation_lead', entityId: id, action: 'reservation_lead.updated' });
  return data;
}

export async function updateReservationLeadStatus(id: string, status: ReservationLeadStatus): Promise<ReservationLeadRow> {
  const { data, error } = await supabase.from('commercial_reservation_leads').update({ status }).eq('id', id).select().single();
  if (error) {
    logAppError('reservation-leads.updateReservationLeadStatus', error);
    throw error;
  }
  await logActivity({ entityType: 'reservation_lead', entityId: id, action: `reservation_lead.${status}` });
  return data;
}

export type CreateReservationAsAgentInput = {
  propertyId: string;
  guestName: string;
  guestPhone: string;
  channelId: string;
  checkInDate: string;
  checkOutDate: string;
  adults: number;
  children: number;
  nightlyRate: number;
  subtotalAmount: number;
  cleaningFeeAmount: number;
  totalAmount: number;
  reservationLeadId?: string;
};

/** Phase 4/7 — calls the SECURITY DEFINER RPC (reservations_insert/guests_insert are
 * is_staff()-only under RLS). Pricing (nightly rate/subtotal/total) is computed by the caller
 * using the exact same logic the regular reservation form uses — this function only crosses the
 * RLS boundary, it doesn't reimplement pricing rules. */
export async function createReservationAsAgent(input: CreateReservationAsAgentInput): Promise<{ reservationId: string; reservationCode: string }> {
  const { data, error } = await supabase.rpc('create_reservation_as_agent', {
    p_property_id: input.propertyId,
    p_guest_name: input.guestName,
    p_guest_phone: input.guestPhone,
    p_channel_id: input.channelId,
    p_check_in_date: input.checkInDate,
    p_check_out_date: input.checkOutDate,
    p_adults: input.adults,
    p_children: input.children,
    p_nightly_rate: input.nightlyRate,
    p_subtotal_amount: input.subtotalAmount,
    p_cleaning_fee_amount: input.cleaningFeeAmount,
    p_total_amount: input.totalAmount,
    p_reservation_lead_id: input.reservationLeadId ?? undefined,
  });
  if (error) {
    logAppError('reservation-leads.createReservationAsAgent', error);
    throw error;
  }
  const row = data?.[0];
  if (!row) throw new Error('Reservation creation did not return a result.');
  await logActivity({ entityType: 'reservation', entityId: row.reservation_id, action: 'reservation.created_by_agent' });
  const staffIds = await listStaffUserIds();
  await notifyUsers({
    userIds: staffIds,
    type: 'commercial',
    title: 'Réservation confirmée par un agent',
    body: `${row.reservation_code} · ${input.guestName}`,
    relatedEntityType: 'reservation',
    relatedEntityId: row.reservation_id,
  });
  return { reservationId: row.reservation_id, reservationCode: row.reservation_code };
}

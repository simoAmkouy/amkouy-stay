import { logActivity } from '@/lib/queries/activity-log';
import { notifyUsers } from '@/lib/queries/notifications';
import { supabase } from '@/lib/supabase';
import { listStaffUserIds } from '@/lib/queries/users';
import { Database } from '@/types/supabase';
import { logAppError } from '@/utils/errors';

export type PaymentRow = Database['public']['Tables']['payments']['Row'];
export type PaymentType = Database['public']['Enums']['payment_type'];
export type PaymentMethodType = Database['public']['Enums']['payment_method_type'];
export type PaymentRowStatus = Database['public']['Enums']['payment_status'];

const SELECT = '*';

export async function listPayments(reservationId: string): Promise<PaymentRow[]> {
  const { data, error } = await supabase
    .from('payments')
    .select(SELECT)
    .eq('reservation_id', reservationId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error) {
    logAppError('payments.listPayments', error);
    throw error;
  }
  return data ?? [];
}

/** Export Center only (Phase 14) — every other screen scopes payments to one reservation via
 * `listPayments`; this is the one place that needs the full, unfiltered table (RLS-scoped to
 * staff/finance, per the payments_select policy). */
export async function listAllPayments(): Promise<PaymentRow[]> {
  const { data, error } = await supabase.from('payments').select(SELECT).is('deleted_at', null).order('created_at', { ascending: false });
  if (error) {
    logAppError('payments.listAllPayments', error);
    throw error;
  }
  return data ?? [];
}

export async function getPayment(id: string): Promise<PaymentRow | null> {
  const { data, error } = await supabase.from('payments').select(SELECT).eq('id', id).is('deleted_at', null).maybeSingle();
  if (error) {
    logAppError('payments.getPayment', error);
    throw error;
  }
  return data;
}

export type PaymentCreateInput = {
  reservationId: string;
  type: PaymentType;
  amount: number;
  method: PaymentMethodType;
  gatewayReference?: string;
};

/** Recording a payment as `completed` immediately (no separate "capture" step in this app) is
 * what fires the `ledger_from_payment` trigger — the ledger entry is never written by this
 * function directly, only by the database, so it can never drift from what's actually stored. */
export async function createPayment(input: PaymentCreateInput): Promise<PaymentRow> {
  const { data, error } = await supabase
    .from('payments')
    .insert({
      reservation_id: input.reservationId,
      type: input.type,
      amount: input.amount,
      method: input.method,
      gateway_reference: input.gatewayReference || null,
      status: 'completed',
      processed_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) {
    logAppError('payments.createPayment', error);
    throw error;
  }
  await logActivity({
    entityType: 'payment',
    entityId: data.id,
    action: `payment.${input.type}_recorded`,
    changes: { amount: input.amount, method: input.method },
  });
  const staffIds = await listStaffUserIds();
  const title = input.type === 'deposit_hold' ? 'Acompte reçu' : input.type === 'charge' ? 'Solde reçu' : 'Paiement enregistré';
  await notifyUsers({
    userIds: staffIds,
    type: 'payment',
    title,
    body: `${input.amount} MAD · ${input.method}`,
    relatedEntityType: 'reservation',
    relatedEntityId: input.reservationId,
  });
  return data;
}

export async function updatePayment(id: string, input: { method?: PaymentMethodType; gatewayReference?: string }): Promise<PaymentRow> {
  const { data, error } = await supabase
    .from('payments')
    .update({
      method: input.method,
      gateway_reference: input.gatewayReference,
    })
    .eq('id', id)
    .select()
    .single();
  if (error) {
    logAppError('payments.updatePayment', error);
    throw error;
  }
  await logActivity({ entityType: 'payment', entityId: id, action: 'payment.updated' });
  return data;
}

/** Refunds are their own payment row (`type: 'refund'` or `'deposit_release'`), never a mutation
 * of the original charge — the original charge stays exactly as it was collected, matching
 * "never rely on UI-only calculations" (every movement is its own traceable row). Validation
 * (refund <= net collected) lives in validation/payment.ts, enforced before this is called. */
export async function refundPayment(params: {
  reservationId: string;
  amount: number;
  isDepositRelease: boolean;
  method: PaymentMethodType;
  notes?: string;
}): Promise<PaymentRow> {
  const { data, error } = await supabase
    .from('payments')
    .insert({
      reservation_id: params.reservationId,
      type: params.isDepositRelease ? 'deposit_release' : 'refund',
      amount: params.amount,
      method: params.method,
      status: 'completed',
      processed_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) {
    logAppError('payments.refundPayment', error);
    throw error;
  }
  await logActivity({
    entityType: 'payment',
    entityId: data.id,
    action: 'payment.refund_issued',
    changes: { amount: params.amount },
  });
  const staffIds = await listStaffUserIds();
  await notifyUsers({
    userIds: staffIds,
    type: 'payment',
    title: 'Remboursement émis',
    body: `${params.amount} MAD${params.notes ? ' · ' + params.notes : ''}`,
    priority: 'warning',
    relatedEntityType: 'reservation',
    relatedEntityId: params.reservationId,
  });
  return data;
}

// ============================================================================
// READ-TIME PAYMENT STATUS ENGINE (Phase 9) — never stored, mirrors
// computeDisplayStatus (owner-payments.ts) / computeContractHealth (contracts.ts).
// ============================================================================

export type PaymentStatus = 'unpaid' | 'deposit_paid' | 'partially_paid' | 'paid' | 'refunded' | 'overdue';

export type ReservationPaymentSummary = {
  reservationTotal: number;
  depositPaid: number;
  balancePaid: number;
  refunded: number;
  netCollected: number;
  outstanding: number;
  collectionRate: number;
};

export function computePaymentStatus(
  summary: ReservationPaymentSummary,
  checkInDate: string,
  today: Date = new Date()
): PaymentStatus {
  const todayStr = today.toISOString().slice(0, 10);
  if (summary.netCollected <= 0 && summary.refunded > 0) return 'refunded';
  if (summary.outstanding <= 0 && summary.netCollected > 0) return 'paid';
  if (summary.outstanding > 0 && checkInDate < todayStr) return 'overdue';
  if (summary.depositPaid > 0 && summary.balancePaid === 0) return 'deposit_paid';
  if (summary.netCollected > 0) return 'partially_paid';
  return 'unpaid';
}

export async function getReservationPaymentSummary(reservationId: string): Promise<ReservationPaymentSummary> {
  const { data, error } = await supabase.rpc('get_reservation_payment_summary', { p_reservation_id: reservationId });
  if (error) {
    logAppError('payments.getReservationPaymentSummary', error);
    throw error;
  }
  const row = data?.[0];
  return {
    reservationTotal: Number(row?.reservation_total ?? 0),
    depositPaid: Number(row?.deposit_paid ?? 0),
    balancePaid: Number(row?.balance_paid ?? 0),
    refunded: Number(row?.refunded ?? 0),
    netCollected: Number(row?.net_collected ?? 0),
    outstanding: Number(row?.outstanding ?? 0),
    collectionRate: Number(row?.collection_rate ?? 0),
  };
}

export type PaymentsOverview = {
  totalCollected: number;
  totalOutstanding: number;
  totalRefunded: number;
  totalDepositsCollected: number;
  collectionRate: number;
  avgCollectionDelayDays: number | null;
  depositsMissingCount: number;
  balanceOverdueCount: number;
  balanceDueTodayCount: number;
  largeOutstandingCount: number;
  refundPendingCount: number;
};

export async function getPaymentsOverview(startIso: string, endIso: string, largeThreshold = 5000): Promise<PaymentsOverview> {
  const { data, error } = await supabase.rpc('get_payments_overview', {
    p_start: startIso,
    p_end: endIso,
    p_large_threshold: largeThreshold,
  });
  if (error) {
    logAppError('payments.getPaymentsOverview', error);
    throw error;
  }
  const row = data?.[0];
  return {
    totalCollected: Number(row?.total_collected ?? 0),
    totalOutstanding: Number(row?.total_outstanding ?? 0),
    totalRefunded: Number(row?.total_refunded ?? 0),
    totalDepositsCollected: Number(row?.total_deposits_collected ?? 0),
    collectionRate: Number(row?.collection_rate ?? 0),
    avgCollectionDelayDays: row?.avg_collection_delay_days == null ? null : Number(row.avg_collection_delay_days),
    depositsMissingCount: row?.deposits_missing_count ?? 0,
    balanceOverdueCount: row?.balance_overdue_count ?? 0,
    balanceDueTodayCount: row?.balance_due_today_count ?? 0,
    largeOutstandingCount: row?.large_outstanding_count ?? 0,
    refundPendingCount: row?.refund_pending_count ?? 0,
  };
}

export type OutstandingReservation = {
  reservationId: string;
  reservationCode: string;
  propertyName: string;
  guestName: string;
  checkInDate: string;
  checkOutDate: string;
  totalAmount: number;
  netCollected: number;
  outstanding: number;
};

export async function getOutstandingBalances(startIso: string, endIso: string): Promise<OutstandingReservation[]> {
  const { data, error } = await supabase.rpc('get_outstanding_reservations', { p_start: startIso, p_end: endIso });
  if (error) {
    logAppError('payments.getOutstandingBalances', error);
    throw error;
  }
  return (data ?? []).map((row) => ({
    reservationId: row.reservation_id,
    reservationCode: row.reservation_code,
    propertyName: row.property_name,
    guestName: row.guest_name,
    checkInDate: row.check_in_date,
    checkOutDate: row.check_out_date,
    totalAmount: Number(row.total_amount ?? 0),
    netCollected: Number(row.net_collected ?? 0),
    outstanding: Number(row.outstanding ?? 0),
  }));
}

// ============================================================================
// LEDGER (Phase 4/5) — read-only from the app's perspective; every row is
// written by a database trigger (see the module9_ledger_entries migration).
// ============================================================================

export type LedgerEntryRow = Database['public']['Tables']['ledger_entries']['Row'];

export async function getLedgerEntries(params: {
  startIso?: string;
  endIso?: string;
  propertyId?: string;
  entityType?: string;
  limit?: number;
}): Promise<LedgerEntryRow[]> {
  let query = supabase.from('ledger_entries').select('*').order('entry_date', { ascending: false }).order('created_at', { ascending: false });
  if (params.startIso) query = query.gte('entry_date', params.startIso);
  if (params.endIso) query = query.lte('entry_date', params.endIso);
  if (params.propertyId) query = query.eq('property_id', params.propertyId);
  if (params.entityType) query = query.eq('entity_type', params.entityType);
  query = query.limit(params.limit ?? 200);

  const { data, error } = await query;
  if (error) {
    logAppError('payments.getLedgerEntries', error);
    throw error;
  }
  return data ?? [];
}

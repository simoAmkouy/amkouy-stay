import { logActivity } from '@/lib/queries/activity-log';
import { supabase } from '@/lib/supabase';
import { Database } from '@/types/supabase';
import { logAppError } from '@/utils/errors';

export type OwnerPaymentRow = Database['public']['Tables']['owner_payments']['Row'];
export type OwnerPaymentUpdate = Database['public']['Tables']['owner_payments']['Update'];
export type PayoutMethod = Database['public']['Enums']['payout_method'];

export type OwnerPaymentWithRelations = OwnerPaymentRow & {
  owner: { id: string; full_name: string } | null;
  property: { id: string; name: string } | null;
};

/** Upcoming/Due/Overdue are derived from `due_date` at read time — never stored, so there's
 * nothing that needs a nightly job to flip as the clock passes midnight. `approved` surfaces
 * once a settlement leaves the initial 'pending' (draft-equivalent) state — its financial
 * figures are frozen at that point (see trg_owner_payments_freeze_financials). */
export type DisplayStatus = 'upcoming' | 'due' | 'overdue' | 'approved' | 'paid' | 'cancelled';

export function computeDisplayStatus(row: Pick<OwnerPaymentRow, 'status' | 'due_date'>): DisplayStatus {
  if (row.status === 'paid') return 'paid';
  if (row.status === 'cancelled') return 'cancelled';
  if (row.status === 'approved' || row.status === 'processing') return 'approved';
  if (!row.due_date) return 'upcoming';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${row.due_date}T00:00:00`);
  if (due.getTime() === today.getTime()) return 'due';
  if (due.getTime() < today.getTime()) return 'overdue';
  return 'upcoming';
}

const SELECT = '*, owner:owners(id, full_name), property:properties(id, name)';

export async function listOwnerPayments(): Promise<OwnerPaymentWithRelations[]> {
  const { data, error } = await supabase
    .from('owner_payments')
    .select(SELECT)
    .is('deleted_at', null)
    .order('due_date', { ascending: true, nullsFirst: false });
  if (error) {
    logAppError('owner-payments.listOwnerPayments', error);
    throw error;
  }
  return (data ?? []) as unknown as OwnerPaymentWithRelations[];
}

export async function getOwnerPayment(id: string): Promise<OwnerPaymentWithRelations | null> {
  const { data, error } = await supabase
    .from('owner_payments')
    .select(SELECT)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) {
    logAppError('owner-payments.getOwnerPayment', error);
    throw error;
  }
  return data as unknown as OwnerPaymentWithRelations | null;
}

// ============================================================================
// SETTLEMENT PREVIEW & CREATION — Financial Truth Remediation, Phase 2. The audit found 94 of
// 249 owner_payments couldn't be reconciled against compute_owner_settlement(): they'd been
// created through a form that let staff type gross_revenue/expenses/commission_pct by hand, with
// no check against real reservations/expenses. From here on, financial figures are ALWAYS read
// fresh from compute_owner_settlement() — the caller only picks the property, period, due date,
// and payment method; there is no code path left that accepts a hand-typed financial value.
// ============================================================================

export type SettlementPreview = {
  ownerId: string | null;
  ownerName: string | null;
  contractId: string | null;
  grossRevenue: number;
  totalExpenses: number;
  netRevenue: number;
  companyCommissionPct: number;
  ownerCommissionPct: number;
  commissionAmount: number;
  netAmount: number;
  reservationsCount: number;
  contractStatus: string;
};

/** What a settlement WOULD look like for this property/period, computed live by the same engine
 * `generate_owner_settlements()` uses — shown read-only in the create form, never edited. */
export async function previewOwnerSettlement(propertyId: string, periodStart: string, periodEnd: string): Promise<SettlementPreview> {
  const { data, error } = await supabase.rpc('compute_owner_settlement', {
    p_property_id: propertyId,
    p_start: periodStart,
    p_end: periodEnd,
  });
  if (error) {
    logAppError('owner-payments.previewOwnerSettlement', error);
    throw error;
  }
  const row = data?.[0];
  let ownerName: string | null = null;
  if (row?.owner_id) {
    const { data: owner } = await supabase.from('owners').select('full_name').eq('id', row.owner_id).maybeSingle();
    ownerName = owner?.full_name ?? null;
  }
  return {
    ownerId: row?.owner_id ?? null,
    ownerName,
    contractId: row?.contract_id ?? null,
    grossRevenue: Number(row?.gross_revenue ?? 0),
    totalExpenses: Number(row?.total_expenses ?? 0),
    netRevenue: Number(row?.net_revenue ?? 0),
    companyCommissionPct: Number(row?.company_commission_pct ?? 0),
    ownerCommissionPct: Number(row?.owner_commission_pct ?? 0),
    commissionAmount: Number(row?.commission_amount ?? 0),
    netAmount: Number(row?.net_amount ?? 0),
    reservationsCount: row?.reservations_count ?? 0,
    contractStatus: row?.contract_status ?? 'none',
  };
}

export type OwnerPaymentCreateInput = {
  propertyId: string;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  paymentMethod: PayoutMethod | null;
  paymentReference?: string;
  notes?: string;
};

export async function createOwnerPayment(input: OwnerPaymentCreateInput): Promise<OwnerPaymentRow> {
  const settlement = await previewOwnerSettlement(input.propertyId, input.periodStart, input.periodEnd);
  if (!settlement.ownerId) {
    throw new Error("Ce bien n'a aucun propriétaire assigné — impossible de générer un versement.");
  }
  const { data, error } = await supabase
    .from('owner_payments')
    .insert({
      owner_id: settlement.ownerId,
      contract_id: settlement.contractId,
      property_id: input.propertyId,
      period_start: input.periodStart,
      period_end: input.periodEnd,
      gross_revenue: settlement.grossRevenue,
      total_expenses: settlement.totalExpenses,
      owner_commission_pct: settlement.ownerCommissionPct,
      company_commission_pct: settlement.companyCommissionPct,
      commission_amount: settlement.commissionAmount,
      net_amount: settlement.netAmount,
      due_date: input.dueDate,
      payment_method: input.paymentMethod,
      payment_reference: input.paymentReference || null,
      notes: input.notes || null,
      status: 'pending',
      is_manual_adjustment: false,
    })
    .select()
    .single();
  if (error) {
    logAppError('owner-payments.createOwnerPayment', error);
    throw error;
  }
  await logActivity({
    entityType: 'owner_payment',
    entityId: data.id,
    action: 'owner_payment.created',
    changes: { net_amount: settlement.netAmount, due_date: input.dueDate },
  });
  return data;
}

export type OwnerPaymentMetadataInput = {
  dueDate: string;
  paymentMethod: PayoutMethod | null;
  paymentReference?: string;
  notes?: string;
};

/** Only non-financial metadata — matches the DB trigger that already freezes gross_revenue/
 * total_expenses/commission_amount/net_amount once a payment leaves 'pending'; this closes the
 * same gap while a payment is still pending (previously the only path that let staff overwrite
 * settlement-engine figures by hand after the fact). */
export async function updateOwnerPaymentMetadata(id: string, input: OwnerPaymentMetadataInput): Promise<OwnerPaymentRow> {
  const { data, error } = await supabase
    .from('owner_payments')
    .update({
      due_date: input.dueDate,
      payment_method: input.paymentMethod,
      payment_reference: input.paymentReference || null,
      notes: input.notes || null,
    })
    .eq('id', id)
    .select()
    .single();
  if (error) {
    logAppError('owner-payments.updateOwnerPaymentMetadata', error);
    throw error;
  }
  await logActivity({ entityType: 'owner_payment', entityId: data.id, action: 'owner_payment.updated' });
  return data;
}

/** Thrown when "mark as paid" is attempted without the safeguards CB-09/CB-10 (Launch Readiness
 * Audit) require: a real payment reference on file, and a prior "approved" review step. */
export class OwnerPaymentNotPayableError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = 'OwnerPaymentNotPayableError';
  }
}

export async function markOwnerPaymentAsPaid(
  id: string,
  input: { paidAt: string; paymentMethod: PayoutMethod; paymentReference?: string }
): Promise<OwnerPaymentRow> {
  // CB-09: a real money transfer needs a real reference to reconcile against later — the form
  // already requires this (see `markAsPaidSchema`), this is the server-side boundary backstopping it.
  if (!input.paymentReference || !input.paymentReference.trim()) {
    throw new OwnerPaymentNotPayableError(
      'Une référence de paiement est requise pour marquer un versement comme payé.'
    );
  }

  // CB-10: a settlement must be reviewed ("approved") before it can be paid out — otherwise the
  // review step is optional in practice, not enforced.
  const { data: current, error: fetchError } = await supabase
    .from('owner_payments')
    .select('status')
    .eq('id', id)
    .maybeSingle();
  if (fetchError) {
    logAppError('owner-payments.markOwnerPaymentAsPaid (fetch)', fetchError);
    throw fetchError;
  }
  if (current?.status !== 'approved' && current?.status !== 'processing') {
    throw new OwnerPaymentNotPayableError(
      "Ce versement doit d'abord être approuvé avant d'être marqué comme payé."
    );
  }

  const { data, error } = await supabase
    .from('owner_payments')
    .update({
      status: 'paid',
      paid_at: new Date(input.paidAt).toISOString(),
      payment_method: input.paymentMethod,
      payment_reference: input.paymentReference.trim(),
    })
    .eq('id', id)
    .select()
    .single();
  if (error) {
    logAppError('owner-payments.markOwnerPaymentAsPaid', error);
    throw error;
  }
  await logActivity({ entityType: 'owner_payment', entityId: data.id, action: 'owner_payment.paid' });
  return data;
}

export async function approveOwnerPayment(id: string): Promise<OwnerPaymentRow> {
  // CB-11: record who approved this settlement — previously never written, so approvals had no
  // audit trail and the Accountant "Versements traités" KPI (team.ts's getAccountantStats, which
  // counts by approved_by) silently stayed at 0 for everyone.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('owner_payments')
    .update({ status: 'approved', approved_at: new Date().toISOString(), approved_by: user?.id ?? null })
    .eq('id', id)
    .select()
    .single();
  if (error) {
    logAppError('owner-payments.approveOwnerPayment', error);
    throw error;
  }
  await logActivity({ entityType: 'owner_payment', entityId: data.id, action: 'owner_payment.approved' });
  return data;
}

export type GeneratedSettlement = {
  property_id: string;
  owner_id: string;
  net_amount: number;
  generated: boolean;
};

/** Calls generate_owner_settlements() — the settlement engine that reuses
 * compute_owner_settlement(), the exact same function report_owner_statement() reuses.
 * Never recomputes anything client-side; idempotent server-side (safe to call twice for
 * the same period — existing settlements are left untouched, not duplicated). */
export async function generateOwnerSettlements(
  periodStart: string,
  periodEnd: string,
  dueDate?: string
): Promise<GeneratedSettlement[]> {
  const { data, error } = await supabase.rpc('generate_owner_settlements', {
    p_period_start: periodStart,
    p_period_end: periodEnd,
    p_due_date: dueDate ?? undefined,
  });
  if (error) {
    logAppError('owner-payments.generateOwnerSettlements', error);
    throw error;
  }
  return (data ?? []) as GeneratedSettlement[];
}

export async function cancelOwnerPayment(id: string): Promise<OwnerPaymentRow> {
  const { data, error } = await supabase
    .from('owner_payments')
    .update({ status: 'cancelled' })
    .eq('id', id)
    .select()
    .single();
  if (error) {
    logAppError('owner-payments.cancelOwnerPayment', error);
    throw error;
  }
  await logActivity({ entityType: 'owner_payment', entityId: data.id, action: 'owner_payment.cancelled' });
  return data;
}

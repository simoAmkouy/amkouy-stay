import { listActivity, logActivity } from '@/lib/queries/activity-log';
import { notifyUsers } from '@/lib/queries/notifications';
import { listStaffUserIds } from '@/lib/queries/users';
import { supabase } from '@/lib/supabase';
import { Database } from '@/types/supabase';
import { logAppError } from '@/utils/errors';

export type ContractRow = Database['public']['Tables']['contracts']['Row'];
export type ContractStatus = Database['public']['Enums']['contract_status'];
export type PayoutSchedule = Database['public']['Enums']['payout_schedule'];

export type ContractWithRelations = ContractRow & {
  owner: { id: string; full_name: string } | null;
  property: { id: string; name: string; city: string } | null;
};

const SELECT = '*, owner:owners(id, full_name), property:properties(id, name, city)';

export async function listContracts(): Promise<ContractWithRelations[]> {
  const { data, error } = await supabase
    .from('contracts')
    .select(SELECT)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error) {
    logAppError('contracts.listContracts', error);
    throw error;
  }
  return (data ?? []) as unknown as ContractWithRelations[];
}

export async function getContract(id: string): Promise<ContractWithRelations | null> {
  const { data, error } = await supabase
    .from('contracts')
    .select(SELECT)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) {
    logAppError('contracts.getContract', error);
    throw error;
  }
  return data as unknown as ContractWithRelations | null;
}

/** Owner Portal-safe projection: RLS already restricts rows to the signed-in owner's own
 * contracts (`contracts_select`'s `owner_id = current_owner_id()` branch), but RLS is row-level,
 * not column-level — it would still return `commission_pct`/`terms` on the owner's own row.
 * Those are internal (company margin / internal terms), so this is a dedicated, narrower SELECT
 * used ONLY by the Owner Portal — never the full `ContractWithRelations` shape — matching the
 * Owner Portal Rule precedent set for concierge data in Module 5. */
export type OwnerPortalContract = {
  id: string;
  contract_number: string;
  status: ContractStatus;
  start_date: string;
  end_date: string | null;
  payout_schedule: PayoutSchedule;
  property: { id: string; name: string; city: string } | null;
};

export async function listMyContracts(): Promise<OwnerPortalContract[]> {
  const { data, error } = await supabase
    .from('contracts')
    .select('id, contract_number, status, start_date, end_date, payout_schedule, property:properties(id, name, city)')
    .is('deleted_at', null)
    .order('start_date', { ascending: false });
  if (error) {
    logAppError('contracts.listMyContracts', error);
    throw error;
  }
  return (data ?? []) as unknown as OwnerPortalContract[];
}

export type ContractFormInput = {
  ownerId: string;
  propertyId: string;
  commissionPct: number;
  payoutSchedule: PayoutSchedule;
  startDate: string;
  endDate: string | null;
  autoRenew: boolean;
  terms?: string;
};

/** Numbering is entirely DB-generated (`contract_number` DEFAULT, sequence `contracts_number_seq`)
 * — never set here, matching the pattern used by cleaning/maintenance/expenses/owner-payments/
 * reservation-services. New contracts always start `draft`; `activateContract` is the only path
 * into `active`. */
export async function createContract(input: ContractFormInput): Promise<ContractRow> {
  const { data, error } = await supabase
    .from('contracts')
    .insert({
      owner_id: input.ownerId,
      property_id: input.propertyId,
      commission_pct: input.commissionPct,
      payout_schedule: input.payoutSchedule,
      start_date: input.startDate,
      end_date: input.endDate,
      auto_renew: input.autoRenew,
      terms: input.terms || null,
      status: 'draft',
    })
    .select()
    .single();
  if (error) {
    logAppError('contracts.createContract', error);
    throw error;
  }
  await logActivity({ entityType: 'contract', entityId: data.id, action: 'contract.created' });
  return data;
}

export async function updateContract(id: string, input: ContractFormInput): Promise<ContractRow> {
  const { data, error } = await supabase
    .from('contracts')
    .update({
      owner_id: input.ownerId,
      property_id: input.propertyId,
      commission_pct: input.commissionPct,
      payout_schedule: input.payoutSchedule,
      start_date: input.startDate,
      end_date: input.endDate,
      auto_renew: input.autoRenew,
      terms: input.terms || null,
    })
    .eq('id', id)
    .select()
    .single();
  if (error) {
    logAppError('contracts.updateContract', error);
    throw error;
  }
  await logActivity({ entityType: 'contract', entityId: id, action: 'contract.updated' });
  return data;
}

export async function activateContract(id: string): Promise<ContractRow> {
  const { data, error } = await supabase
    .from('contracts')
    .update({ status: 'active' })
    .eq('id', id)
    .select()
    .single();
  if (error) {
    logAppError('contracts.activateContract', error);
    throw error;
  }
  await logActivity({ entityType: 'contract', entityId: id, action: 'contract.activated' });
  const staffIds = await listStaffUserIds();
  await notifyUsers({
    userIds: staffIds,
    type: 'contract',
    title: 'Contrat activé',
    body: `${data.contract_number} — contrat actif`,
    relatedEntityType: 'contract',
    relatedEntityId: id,
  });
  return data;
}

export async function terminateContract(id: string): Promise<ContractRow> {
  const { data, error } = await supabase
    .from('contracts')
    .update({ status: 'terminated' })
    .eq('id', id)
    .select()
    .single();
  if (error) {
    logAppError('contracts.terminateContract', error);
    throw error;
  }
  await logActivity({ entityType: 'contract', entityId: id, action: 'contract.terminated' });
  const staffIds = await listStaffUserIds();
  await notifyUsers({
    userIds: staffIds,
    type: 'contract',
    title: 'Contrat résilié',
    body: `${data.contract_number} — contrat résilié`,
    priority: 'warning',
    relatedEntityType: 'contract',
    relatedEntityId: id,
  });
  return data;
}

// ============================================================================
// READ-TIME HEALTH — Expiring Soon / Expired / Days Remaining are computed from
// `end_date` on every read, never stored (matching `computeDisplayStatus` in
// owner-payments.ts and the Property Status Engine in operations-center.ts).
// No cron, no scheduled worker, no edge function.
// ============================================================================

export type ContractHealth = 'healthy' | 'expiring_soon' | 'urgent' | 'expired' | 'terminated';

export function computeDaysRemaining(endDate: string | null, today: Date = new Date()): number | null {
  if (!endDate) return null;
  const end = new Date(`${endDate}T00:00:00`);
  const start = new Date(today);
  start.setHours(0, 0, 0, 0);
  return Math.round((end.getTime() - start.getTime()) / 86_400_000);
}

/** Green >90d, Orange 30-90d, Red <30d, Expired past end_date. A contract with no `end_date`
 * (open-ended) is treated as healthy — there is nothing to expire. */
export function computeContractHealth(
  contract: Pick<ContractRow, 'status' | 'end_date'>,
  today: Date = new Date()
): ContractHealth {
  if (contract.status === 'terminated') return 'terminated';
  const days = computeDaysRemaining(contract.end_date, today);
  if (days === null) return 'healthy';
  if (days < 0) return 'expired';
  if (days < 30) return 'urgent';
  if (days <= 90) return 'expiring_soon';
  return 'healthy';
}

// ============================================================================
// EXPIRY NOTIFICATIONS — no cron/scheduled worker/edge function exists in this
// app, so expiry alerts are computed and (idempotently) fired whenever the
// Contracts list or Operations Center loads, per the Module 7 spec. Dedup is
// via `activity_logs` (already staff-readable via `is_staff()`, unlike
// `notifications` which is self-scoped per user) so any staff member's session
// re-triggering this on page load doesn't double-notify.
// ============================================================================

async function notifyOnceForMilestone(
  contract: ContractWithRelations,
  staffIds: string[],
  milestone: '90d' | '30d',
  title: string
): Promise<void> {
  const action = `contract.notified_${milestone}`;
  const history = await listActivity('contract', contract.id);
  if (history.some((h) => h.action === action)) return;
  await notifyUsers({
    userIds: staffIds,
    type: 'contract',
    title,
    body: `${contract.contract_number} · ${contract.property?.name ?? '—'}`,
    priority: milestone === '30d' ? 'warning' : 'info',
    relatedEntityType: 'contract',
    relatedEntityId: contract.id,
  });
  await logActivity({ entityType: 'contract', entityId: contract.id, action });
}

/** Staff-only side effect (call only when the caller is admin/manager — matches
 * `contracts_insert`/`contracts_update` RLS being `is_staff()`-only, so an accountant's
 * read-only view of this screen never attempts a write). Safe to call on every load —
 * `notifyOnceForMilestone` no-ops once a milestone has already fired for a contract. */
export async function syncContractExpiryNotifications(contracts: ContractWithRelations[]): Promise<void> {
  const active = contracts.filter((c) => c.status === 'active' && c.end_date);
  if (active.length === 0) return;
  const staffIds = await listStaffUserIds();
  const today = new Date();
  for (const c of active) {
    const days = computeDaysRemaining(c.end_date, today);
    if (days === null || days < 0) continue;
    if (days <= 30) {
      await notifyOnceForMilestone(c, staffIds, '30d', 'Contrat expirant dans 30 jours');
    } else if (days <= 90) {
      await notifyOnceForMilestone(c, staffIds, '90d', 'Contrat expirant dans 90 jours');
    }
  }
}

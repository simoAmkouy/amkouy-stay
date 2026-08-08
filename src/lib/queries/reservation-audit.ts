import { UserRole } from '@/constants/permissions';
import { supabase } from '@/lib/supabase';
import { Json } from '@/types/supabase';
import { logAppError } from '@/utils/errors';

// ---------------------------------------------------------------------------
// Snapshot shape — a complete point-in-time capture of a reservation's state.
// Stored in activity_logs.changes so records are immutable and require no
// schema migration (activity_logs.changes is already Json in the DB).
// ---------------------------------------------------------------------------

export type ReservationAuditSnapshot = {
  reservation_code: string;
  property_id: string;
  property_name: string | null;
  guest_name: string | null;
  guest_phone: string | null;
  channel_name: string | null;
  check_in_date: string;
  check_out_date: string;
  nights: number | null;
  adults: number;
  children: number;
  status: string;
  nightly_rate: number;
  subtotal_amount: number;
  cleaning_fee_amount: number;
  total_amount: number;
  amount_paid: number;
  remaining: number;
  notes: string | null;
  cancellation_reason: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  deleted_by: string | null;
  is_deleted?: boolean;
};

// Structural input type — accepts ReservationWithRelations without a circular import.
type ReservationSnapshotInput = {
  reservation_code: string;
  property_id: string;
  property?: { name: string } | null;
  guest?: { full_name: string; phone: string | null } | null;
  channel?: { name: string } | null;
  check_in_date: string;
  check_out_date: string;
  nights: number | null;
  adults: number;
  children: number;
  status: string;
  nightly_rate: number;
  subtotal_amount: number;
  cleaning_fee_amount: number;
  total_amount: number;
  special_requests: string | null;
  cancellation_reason: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  deleted_by: string | null;
};

export function buildReservationSnapshot(
  r: ReservationSnapshotInput,
  payment: { netCollected: number; outstanding: number } = {
    netCollected: 0,
    outstanding: r.total_amount,
  }
): ReservationAuditSnapshot {
  return {
    reservation_code: r.reservation_code,
    property_id: r.property_id,
    property_name: r.property?.name ?? null,
    guest_name: r.guest?.full_name ?? null,
    guest_phone: r.guest?.phone ?? null,
    channel_name: r.channel?.name ?? null,
    check_in_date: r.check_in_date,
    check_out_date: r.check_out_date,
    nights: r.nights,
    adults: r.adults,
    children: r.children,
    status: r.status,
    nightly_rate: r.nightly_rate,
    subtotal_amount: r.subtotal_amount,
    cleaning_fee_amount: r.cleaning_fee_amount,
    total_amount: r.total_amount,
    amount_paid: payment.netCollected,
    remaining: payment.outstanding,
    notes: r.special_requests,
    cancellation_reason: r.cancellation_reason,
    created_at: r.created_at,
    updated_at: r.updated_at,
    deleted_at: r.deleted_at,
    deleted_by: r.deleted_by,
  };
}

export function generateBulkOperationId(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `BULK-${date}-${rand}`;
}

// ---------------------------------------------------------------------------
// Changed-fields diff — a lightweight object showing exactly what changed
// between two snapshots, without requiring the UI to compare full objects.
// ---------------------------------------------------------------------------

export type ChangedFieldValue = string | number | null;
export type ChangedFields = Record<string, { before: ChangedFieldValue; after: ChangedFieldValue }>;

const COMPARABLE_FIELDS: (keyof ReservationAuditSnapshot)[] = [
  'status',
  'total_amount',
  'nightly_rate',
  'cleaning_fee_amount',
  'check_in_date',
  'check_out_date',
  'nights',
  'property_name',
  'guest_name',
  'guest_phone',
  'channel_name',
  'adults',
  'children',
  'notes',
  'cancellation_reason',
];

export function computeChangedFields(
  before: ReservationAuditSnapshot | null,
  after: ReservationAuditSnapshot | null
): ChangedFields | null {
  if (!before || !after) return null;
  const fields: ChangedFields = {};
  for (const key of COMPARABLE_FIELDS) {
    const b = before[key] as ChangedFieldValue;
    const a = after[key] as ChangedFieldValue;
    const changed =
      typeof b === 'number' && typeof a === 'number'
        ? Math.abs(b - a) > 0.001
        : b !== a;
    if (changed) fields[key] = { before: b, after: a };
  }
  return Object.keys(fields).length > 0 ? fields : null;
}

// ---------------------------------------------------------------------------
// Logging — writes one activity_logs row per action with full snapshot data.
// Never throws; audit failures must not block the mutation that triggered it.
// ---------------------------------------------------------------------------

export async function logReservationAudit(params: {
  reservationId: string;
  action: string;
  snapshotBefore: ReservationAuditSnapshot | null;
  snapshotAfter: ReservationAuditSnapshot | null;
  changedFields?: ChangedFields | null;
  bulkOperationId?: string;
  reason?: string | null;
}): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: profile } = await supabase
    .from('users')
    .select('full_name, role')
    .eq('id', user.id)
    .maybeSingle();

  const { error } = await supabase.from('activity_logs').insert({
    entity_type: 'reservation',
    entity_id: params.reservationId,
    action: params.action,
    user_id: user.id,
    changes: {
      actor_name: profile?.full_name ?? null,
      actor_role: profile?.role ?? null,
      bulk_operation_id: params.bulkOperationId ?? null,
      reason: params.reason ?? null,
      changed_fields: (params.changedFields ?? null) as unknown as Json,
      snapshot_before: params.snapshotBefore as unknown as Json,
      snapshot_after: params.snapshotAfter as unknown as Json,
    } as unknown as Json,
  });
  if (error) {
    console.warn('[reservation-audit] failed to record', params.action, error.message);
  }
}

// ---------------------------------------------------------------------------
// Query — reads the audit trail for the Audit Trail page.
// ---------------------------------------------------------------------------

export const AUDIT_ACTIONS = [
  'reservation.created',
  'reservation.updated',
  'reservation.status_changed',
  'reservation.price_changed',
  'reservation.dates_changed',
  'reservation.guest_changed',
  'reservation.property_changed',
  'reservation.channel_changed',
  'reservation.deleted',
  'reservation.bulk_deleted',
] as const;

export type ReservationAuditAction = (typeof AUDIT_ACTIONS)[number];

export type ReservationAuditEntry = {
  id: number;
  reservation_id: string;
  action: string;
  actor_id: string | null;
  actor_name: string | null;
  actor_role: string | null;
  created_at: string;
  bulk_operation_id: string | null;
  reason: string | null;
  changed_fields: ChangedFields | null;
  snapshot_before: ReservationAuditSnapshot | null;
  snapshot_after: ReservationAuditSnapshot | null;
};

export type ReservationAuditFilters = {
  dateStart?: string;
  dateEnd?: string;
  currentUserRole: UserRole;
  currentUserId: string;
  limit?: number;
};

export async function listReservationAuditTrail(
  filters: ReservationAuditFilters
): Promise<ReservationAuditEntry[]> {
  let query = supabase
    .from('activity_logs')
    .select('*')
    .eq('entity_type', 'reservation')
    .in('action', [...AUDIT_ACTIONS])
    .order('created_at', { ascending: false })
    .limit(filters.limit ?? 300);

  if (filters.dateStart) query = query.gte('created_at', filters.dateStart);
  if (filters.dateEnd) query = query.lte('created_at', filters.dateEnd + 'T23:59:59Z');

  const { data, error } = await query;
  if (error) {
    logAppError('reservation-audit.listReservationAuditTrail', error);
    throw error;
  }

  return (data ?? []).map((row) => {
    const c = (row.changes ?? {}) as Record<string, unknown>;
    return {
      id: row.id,
      reservation_id: row.entity_id,
      action: row.action,
      actor_id: row.user_id,
      actor_name: (c.actor_name as string) ?? null,
      actor_role: (c.actor_role as string) ?? null,
      created_at: row.created_at,
      bulk_operation_id: (c.bulk_operation_id as string) ?? null,
      reason: (c.reason as string) ?? null,
      changed_fields: c.changed_fields
        ? (c.changed_fields as unknown as ChangedFields)
        : null,
      snapshot_before: c.snapshot_before
        ? (c.snapshot_before as unknown as ReservationAuditSnapshot)
        : null,
      snapshot_after: c.snapshot_after
        ? (c.snapshot_after as unknown as ReservationAuditSnapshot)
        : null,
    };
  });
}

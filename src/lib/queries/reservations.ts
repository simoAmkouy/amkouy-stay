import { buildReservationSnapshot, computeChangedFields, generateBulkOperationId, logReservationAudit } from '@/lib/queries/reservation-audit';
import { logActivity } from '@/lib/queries/activity-log';
import { notifyUsers } from '@/lib/queries/notifications';
import { getReservationPaymentSummary } from '@/lib/queries/payments';
import { supabase } from '@/lib/supabase';
import { listStaffUserIds } from '@/lib/queries/users';
import { RESERVATION_STATUS_TRANSITIONS, ReservationStatusValue } from '@/lib/validation/reservation';
import { Database } from '@/types/supabase';
import { logAppError } from '@/utils/errors';

export type ReservationRow = Database['public']['Tables']['reservations']['Row'];
export type ReservationInsert = Database['public']['Tables']['reservations']['Insert'];
export type ReservationUpdate = Database['public']['Tables']['reservations']['Update'];
export type ReservationStatus = Database['public']['Enums']['reservation_status'];
export type ChannelRow = Database['public']['Tables']['channels']['Row'];

export type ReservationWithRelations = ReservationRow & {
  property: { id: string; name: string; city: string } | null;
  guest: { id: string; full_name: string; phone: string | null } | null;
  channel: { id: string; name: string; code: string } | null;
};

const RESERVATION_SELECT =
  '*, property:properties(id, name, city), guest:guests(id, full_name, phone), channel:channels(id, name, code)';

export type ReservationListFilters = {
  /** Empty/omitted = all statuses. Pushed to the DB via `.in()` rather than filtered client-side. */
  statuses?: ReservationStatus[];
  /** Filters on `check_in_date`, matching the column the list is ordered/scanned by default. */
  dateRange?: { start: string; end: string };
};

export async function listReservations(filters: ReservationListFilters = {}): Promise<ReservationWithRelations[]> {
  let query = supabase.from('reservations').select(RESERVATION_SELECT).is('deleted_at', null);
  if (filters.statuses && filters.statuses.length > 0) {
    query = query.in('status', filters.statuses);
  }
  if (filters.dateRange) {
    query = query.gte('check_in_date', filters.dateRange.start).lte('check_in_date', filters.dateRange.end);
  }
  const { data, error } = await query.order('check_in_date', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as ReservationWithRelations[];
}

/** Owner Portal's "upcoming reservations" — relies on the same `reservations_select` RLS
 * (owns_property()) as everything else on that screen, so an owner only ever sees their own. */
export async function listUpcomingReservations(limit = 5): Promise<ReservationWithRelations[]> {
  const _d = new Date();
  const today = `${_d.getFullYear()}-${String(_d.getMonth() + 1).padStart(2, '0')}-${String(_d.getDate()).padStart(2, '0')}`;
  const { data, error } = await supabase
    .from('reservations')
    .select(RESERVATION_SELECT)
    .is('deleted_at', null)
    .not('status', 'in', '(cancelled,no_show)')
    .gte('check_in_date', today)
    .order('check_in_date', { ascending: true })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as ReservationWithRelations[];
}

/** Owner Portal's "upcoming departures" — the check_out counterpart to `listUpcomingReservations`
 * (which orders by check_in_date and would miss a reservation whose guest already checked in but
 * hasn't checked out yet). Same RLS (`owns_property()`) scoping as every other owner-portal query. */
export async function listUpcomingCheckouts(limit = 5): Promise<ReservationWithRelations[]> {
  const _d = new Date();
  const today = `${_d.getFullYear()}-${String(_d.getMonth() + 1).padStart(2, '0')}-${String(_d.getDate()).padStart(2, '0')}`;
  const { data, error } = await supabase
    .from('reservations')
    .select(RESERVATION_SELECT)
    .is('deleted_at', null)
    .not('status', 'in', '(cancelled,no_show)')
    .gte('check_out_date', today)
    .order('check_out_date', { ascending: true })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as ReservationWithRelations[];
}

export async function getReservation(id: string): Promise<ReservationWithRelations | null> {
  const { data, error } = await supabase
    .from('reservations')
    .select(RESERVATION_SELECT)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) throw error;
  return data as unknown as ReservationWithRelations | null;
}

export async function listChannels(): Promise<ChannelRow[]> {
  const { data, error } = await supabase
    .from('channels')
    .select('*')
    .is('deleted_at', null)
    .eq('is_active', true)
    .order('name');
  if (error) throw error;
  return data ?? [];
}

/** Find a guest by phone, or create a minimal record — no full guest-management UI in this pass. */
async function findOrCreateGuest(fullName: string, phone: string): Promise<string> {
  const { data: existing, error: findError } = await supabase
    .from('guests')
    .select('id')
    .eq('phone', phone)
    .is('deleted_at', null)
    .maybeSingle();
  if (findError) {
    logAppError('reservations.findOrCreateGuest (lookup by phone)', findError);
    throw findError;
  }
  if (existing) return existing.id;

  const { data: created, error: createError } = await supabase
    .from('guests')
    .insert({ full_name: fullName, phone })
    .select('id')
    .single();
  if (createError) {
    logAppError('reservations.findOrCreateGuest (insert new guest)', createError);
    throw createError;
  }
  return created.id;
}

export type ReservationFormInput = {
  propertyId: string;
  channelId: string;
  guestName: string;
  guestPhone: string;
  checkInDate: string; // 'YYYY-MM-DD'
  checkOutDate: string; // 'YYYY-MM-DD'
  nightlyRate: number;
  cleaningFeeAmount: number;
  adults: number;
  children: number;
  status: ReservationStatus;
  specialRequests?: string;
};

/** Exported so other reservation-creating flows (e.g. the commercial-agent path) use the exact
 * same pricing formula rather than reimplementing it — narrowed to just the fields it needs. */
export function computeTotals(input: Pick<ReservationFormInput, 'checkInDate' | 'checkOutDate' | 'nightlyRate' | 'cleaningFeeAmount'>) {
  const nights = Math.max(
    1,
    Math.round(
      (new Date(input.checkOutDate).getTime() - new Date(input.checkInDate).getTime()) / 86_400_000
    )
  );
  const subtotalAmount = nights * input.nightlyRate;
  const totalAmount = subtotalAmount + input.cleaningFeeAmount;
  return { subtotalAmount, totalAmount };
}

/** Thrown when the DB's overlap-prevention constraint (ck_reservations_no_overlap) rejects the write. */
export class DoubleBookingError extends Error {
  constructor() {
    super('Ces dates ne sont pas disponibles pour ce bien.');
    this.name = 'DoubleBookingError';
  }
}

function isExclusionViolation(error: unknown): boolean {
  return (
    !!error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === '23P01'
  );
}

/** Thrown when a reservation is created/moved against a property that isn't `status = 'active'`
 * (e.g. still onboarding, or flagged under maintenance) — CB-02, Launch Readiness Audit. */
export class PropertyNotBookableError extends Error {
  constructor() {
    super("Ce bien n'est pas actif et ne peut pas recevoir de nouvelle réservation.");
    this.name = 'PropertyNotBookableError';
  }
}

/** Thrown when an edit tries to move a reservation's status to something that isn't a valid next
 * step from its current status — CB-01, Launch Readiness Audit. */
export class InvalidStatusTransitionError extends Error {
  constructor(from: string, to: string) {
    super(`Impossible de passer du statut "${from}" à "${to}".`);
    this.name = 'InvalidStatusTransitionError';
  }
}

async function assertPropertyBookable(propertyId: string): Promise<void> {
  const { data, error } = await supabase
    .from('properties')
    .select('status')
    .eq('id', propertyId)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) {
    logAppError('reservations.assertPropertyBookable', error);
    throw error;
  }
  if (!data || data.status !== 'active') {
    throw new PropertyNotBookableError();
  }
}

/** Thrown when a property has an urgent open maintenance ticket, or its last checkout's cleaning
 * task isn't done — CB-04, Launch Readiness Audit ("a property's cleaning/maintenance readiness
 * is never checked before a new reservation is created against it"). */
export class PropertyNotReadyError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = 'PropertyNotReadyError';
  }
}

const OPEN_MAINTENANCE_STATUSES = ['open', 'assigned', 'in_progress', 'on_hold'] as const;

/** Mirrors the exact same "needs_cleaning" / "blocked" signal the Operations Center dashboard
 * already computes (see `computePropertyStatuses` in operations-center.ts) — reimplemented here as
 * two small direct queries rather than importing that module's full raw-fetch, since this only
 * needs a yes/no answer for one property, not every panel on the dashboard. */
async function assertPropertyOperationallyReady(propertyId: string): Promise<void> {
  const { data: urgentTicket, error: ticketError } = await supabase
    .from('maintenance_tickets')
    .select('id')
    .eq('property_id', propertyId)
    .is('deleted_at', null)
    .eq('priority', 'urgent')
    .in('status', OPEN_MAINTENANCE_STATUSES)
    .limit(1)
    .maybeSingle();
  if (ticketError) {
    logAppError('reservations.assertPropertyOperationallyReady (maintenance)', ticketError);
    throw ticketError;
  }
  if (urgentTicket) {
    throw new PropertyNotReadyError(
      'Ce bien a un incident de maintenance urgent en cours — à résoudre avant toute nouvelle réservation.'
    );
  }

  const _td = new Date();
  const todayStr = `${_td.getFullYear()}-${String(_td.getMonth() + 1).padStart(2, '0')}-${String(_td.getDate()).padStart(2, '0')}`;
  const { data: lastCheckouts, error: checkoutError } = await supabase
    .from('reservations')
    .select('id')
    .eq('property_id', propertyId)
    .is('deleted_at', null)
    .not('status', 'in', '(cancelled,no_show)')
    .lte('check_out_date', todayStr)
    .order('check_out_date', { ascending: false })
    .limit(1);
  if (checkoutError) {
    logAppError('reservations.assertPropertyOperationallyReady (last checkout)', checkoutError);
    throw checkoutError;
  }
  const lastCheckout = lastCheckouts?.[0];
  if (!lastCheckout) return;

  const { data: cleaningTask, error: cleaningError } = await supabase
    .from('cleaning_tasks')
    .select('status')
    .eq('reservation_id', lastCheckout.id)
    .is('deleted_at', null)
    .maybeSingle();
  if (cleaningError) {
    logAppError('reservations.assertPropertyOperationallyReady (cleaning)', cleaningError);
    throw cleaningError;
  }
  if (!cleaningTask || !['completed', 'verified'].includes(cleaningTask.status)) {
    throw new PropertyNotReadyError(
      "Le ménage du dernier départ n'est pas terminé pour ce bien — à vérifier avant toute nouvelle réservation."
    );
  }
}

/** Priority-ordered detection of the most specific audit action for an update.
 * Compares the before-snapshot (pre-update row) to the post-update row. */
function detectReservationUpdateAction(
  before: ReservationRow,
  after: ReservationRow
): string {
  if (before.status !== after.status) return 'reservation.status_changed';
  if (before.property_id !== after.property_id) return 'reservation.property_changed';
  if (before.guest_id !== after.guest_id) return 'reservation.guest_changed';
  if (before.channel_id !== after.channel_id) return 'reservation.channel_changed';
  if (before.check_in_date !== after.check_in_date || before.check_out_date !== after.check_out_date)
    return 'reservation.dates_changed';
  if (Math.abs(before.total_amount - after.total_amount) > 0.001) return 'reservation.price_changed';
  return 'reservation.updated';
}

export async function createReservation(input: ReservationFormInput): Promise<ReservationRow> {
  await assertPropertyBookable(input.propertyId);
  await assertPropertyOperationallyReady(input.propertyId);
  const guestId = await findOrCreateGuest(input.guestName, input.guestPhone);
  const { subtotalAmount, totalAmount } = computeTotals(input);

  const payload: ReservationInsert = {
    reservation_code: `R-${Date.now().toString(36).toUpperCase()}`,
    property_id: input.propertyId,
    guest_id: guestId,
    channel_id: input.channelId,
    status: input.status,
    check_in_date: input.checkInDate,
    check_out_date: input.checkOutDate,
    adults: input.adults,
    children: input.children,
    nightly_rate: input.nightlyRate,
    subtotal_amount: subtotalAmount,
    cleaning_fee_amount: input.cleaningFeeAmount,
    total_amount: totalAmount,
    special_requests: input.specialRequests || null,
  };

  const { data, error } = await supabase.from('reservations').insert(payload).select().single();
  if (error) {
    logAppError('reservations.createReservation (insert)', error);
    if (isExclusionViolation(error)) throw new DoubleBookingError();
    throw error;
  }

  const { data: fullCreated } = await supabase
    .from('reservations')
    .select(RESERVATION_SELECT)
    .eq('id', data.id)
    .maybeSingle();
  await Promise.all([
    logActivity({
      entityType: 'reservation',
      entityId: data.id,
      action: 'reservation.created',
      changes: { code: data.reservation_code },
    }),
    logReservationAudit({
      reservationId: data.id,
      action: 'reservation.created',
      snapshotBefore: null,
      snapshotAfter: fullCreated
        ? buildReservationSnapshot(fullCreated as unknown as ReservationWithRelations, {
            netCollected: 0,
            outstanding: data.total_amount,
          })
        : null,
    }),
  ]);
  return data;
}

export async function updateReservation(id: string, input: ReservationFormInput): Promise<ReservationRow> {
  const { data: beforeData } = await supabase
    .from('reservations')
    .select(RESERVATION_SELECT)
    .eq('id', id)
    .maybeSingle();
  const before = beforeData as unknown as ReservationWithRelations | null;

  if (before && before.status !== input.status) {
    const allowedNextStatuses = RESERVATION_STATUS_TRANSITIONS[before.status as ReservationStatusValue] ?? [];
    if (!allowedNextStatuses.includes(input.status as ReservationStatusValue)) {
      throw new InvalidStatusTransitionError(before.status, input.status);
    }
  }
  if (before && before.property_id !== input.propertyId) {
    await assertPropertyBookable(input.propertyId);
  }
  // CB-04: the actual check-in moment is the one point a dirty/broken property must not be
  // silently accepted, even for a reservation that was created weeks earlier.
  if (before && before.status !== 'checked_in' && input.status === 'checked_in') {
    await assertPropertyOperationallyReady(input.propertyId);
  }

  const guestId = await findOrCreateGuest(input.guestName, input.guestPhone);
  const { subtotalAmount, totalAmount } = computeTotals(input);

  const payload: ReservationUpdate = {
    property_id: input.propertyId,
    guest_id: guestId,
    channel_id: input.channelId,
    status: input.status,
    check_in_date: input.checkInDate,
    check_out_date: input.checkOutDate,
    adults: input.adults,
    children: input.children,
    nightly_rate: input.nightlyRate,
    subtotal_amount: subtotalAmount,
    cleaning_fee_amount: input.cleaningFeeAmount,
    total_amount: totalAmount,
    special_requests: input.specialRequests || null,
  };

  const { data, error } = await supabase.from('reservations').update(payload).eq('id', id).select().single();
  if (error) {
    logAppError('reservations.updateReservation (update)', error);
    if (isExclusionViolation(error)) throw new DoubleBookingError();
    throw error;
  }

  try {
    const [paymentSummary, { data: fullAfterRaw }] = await Promise.all([
      getReservationPaymentSummary(data.id),
      supabase.from('reservations').select(RESERVATION_SELECT).eq('id', data.id).maybeSingle(),
    ]);
    const fullAfter = fullAfterRaw as unknown as ReservationWithRelations | null;
    const auditAction = before ? detectReservationUpdateAction(before, data) : 'reservation.updated';
    const snapshotBefore = before
      ? buildReservationSnapshot(before, {
          netCollected: paymentSummary.netCollected,
          outstanding: paymentSummary.outstanding,
        })
      : null;
    const snapshotAfter = fullAfter
      ? buildReservationSnapshot(fullAfter, {
          netCollected: paymentSummary.netCollected,
          outstanding: paymentSummary.outstanding,
        })
      : null;
    const changedFields = computeChangedFields(snapshotBefore, snapshotAfter);
    await Promise.all([
      logActivity({
        entityType: 'reservation',
        entityId: data.id,
        action: auditAction,
        changes: before
          ? { from_status: before.status, to_status: data.status, code: data.reservation_code }
          : { code: data.reservation_code },
      }),
      logReservationAudit({
        reservationId: data.id,
        action: auditAction,
        snapshotBefore,
        snapshotAfter,
        changedFields,
      }),
    ]);
  } catch (auditError) {
    logAppError('reservations.updateReservation (audit)', auditError);
  }

  if (before && before.status !== data.status && (data.status === 'checked_in' || data.status === 'checked_out')) {
    const staffIds = await listStaffUserIds();
    await notifyUsers({
      userIds: staffIds,
      type: 'reservation',
      title: data.status === 'checked_in' ? 'Nouvelle arrivée' : 'Nouveau départ',
      body: `${data.reservation_code}`,
      relatedEntityType: 'reservation',
      relatedEntityId: data.id,
    });
  }
  return data;
}

/** Thrown when deletion is blocked because the guest is currently in-stay or money has already
 * been collected against the reservation — CB-03, Launch Readiness Audit. */
export class ReservationNotDeletableError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = 'ReservationNotDeletableError';
  }
}

/** Soft delete: sets deleted_at, never issues a real DELETE (see DATABASE_SCHEMA.md §7).
 * CB-03 (Launch Readiness Audit): blocks deleting a reservation that's currently checked_in or
 * that has any collected payments — those must be cancelled (a status transition, which keeps
 * the record and its payment history intact) rather than removed from every list with a single
 * tap. */
export async function softDeleteReservation(id: string, reason?: string) {
  const { data: reservationRaw, error: fetchError } = await supabase
    .from('reservations')
    .select(RESERVATION_SELECT)
    .eq('id', id)
    .maybeSingle();
  const reservation = reservationRaw as unknown as ReservationWithRelations | null;
  if (fetchError) {
    logAppError('reservations.softDeleteReservation (fetch)', fetchError);
    throw fetchError;
  }
  if (reservation?.status === 'checked_in') {
    throw new ReservationNotDeletableError(
      'Cette réservation est en cours de séjour (client déjà arrivé) — annulez-la plutôt que de la supprimer.'
    );
  }

  const paymentSummary = await getReservationPaymentSummary(id);
  if (paymentSummary.netCollected > 0) {
    throw new ReservationNotDeletableError(
      'Cette réservation a des paiements enregistrés — annulez-la plutôt que de la supprimer.'
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const actorId = user?.id ?? null;
  const now = new Date().toISOString();

  const { error } = await supabase
    .from('reservations')
    .update({ deleted_at: now, deleted_by: actorId })
    .eq('id', id);
  if (error) {
    logAppError('reservations.softDeleteReservation', error);
    throw error;
  }

  const snapshotBefore = reservation
    ? buildReservationSnapshot(reservation, {
        netCollected: paymentSummary.netCollected,
        outstanding: paymentSummary.outstanding,
      })
    : null;
  await Promise.all([
    logActivity({
      entityType: 'reservation',
      entityId: id,
      action: 'reservation.deleted',
      changes: {
        code: reservation?.reservation_code ?? null,
        reason: reason ?? null,
      },
    }),
    logReservationAudit({
      reservationId: id,
      action: 'reservation.deleted',
      snapshotBefore,
      snapshotAfter: snapshotBefore
        ? { ...snapshotBefore, deleted_at: now, deleted_by: actorId, is_deleted: true }
        : null,
      reason: reason ?? null,
    }),
  ]);
}

// ---------------------------------------------------------------------------
// BULK DELETE POLICY
//
//   deleted   — no collected payments → soft-delete (deleted_at = now()).
//               Status is irrelevant: if no money was ever collected the record
//               carries no financial history and is safe to remove.
//
//   protected — any collected payment exists (netCollected > 0).
//               The reservation's status is left exactly as-is: pending,
//               confirmed, checked_in, checked_out, completed, cancelled,
//               no_show — whatever it already is. Nothing is mutated.
//               This covers collected payments, owner-payment periods (which
//               are derived from the payments table), and any future accounting
//               lock, because all of them require at least one payment row.
//
//   failed    — unexpected Supabase/network error; counted but never thrown.
//
// The function never throws. Every reservation is processed independently so
// one protected or failed row never blocks the rest of the batch.
// ---------------------------------------------------------------------------

export type BulkDeleteResult = {
  deleted: number;
  protected: number;
  failed: number;
};

export async function bulkDeleteReservations(ids: string[]): Promise<BulkDeleteResult> {
  const result: BulkDeleteResult = { deleted: 0, protected: 0, failed: 0 };

  const { data: { user } } = await supabase.auth.getUser();
  const actorId = user?.id ?? null;
  const now = new Date().toISOString();

  const bulkOperationId = generateBulkOperationId();
  for (const id of ids) {
    try {
      const { data: rowRaw, error: fetchError } = await supabase
        .from('reservations')
        .select(RESERVATION_SELECT)
        .eq('id', id)
        .is('deleted_at', null)
        .maybeSingle();

      if (fetchError) {
        logAppError('reservations.bulkDeleteReservations (fetch)', fetchError);
        result.failed += 1;
        continue;
      }

      const row = rowRaw as unknown as ReservationWithRelations | null;
      if (!row) {
        // Already deleted or not found — idempotent success.
        result.deleted += 1;
        continue;
      }

      const paymentSummary = await getReservationPaymentSummary(id);

      if (paymentSummary.netCollected > 0) {
        // Financial history exists — protect regardless of current status.
        result.protected += 1;
        continue;
      }

      // No financial history → safe to soft-delete.
      const { error: deleteError } = await supabase
        .from('reservations')
        .update({ deleted_at: now, deleted_by: actorId })
        .eq('id', id);

      if (deleteError) {
        logAppError('reservations.bulkDeleteReservations (soft-delete)', deleteError);
        result.failed += 1;
      } else {
        result.deleted += 1;
        const snapshotBefore = buildReservationSnapshot(row, {
          netCollected: paymentSummary.netCollected,
          outstanding: paymentSummary.outstanding,
        });
        await Promise.all([
          logActivity({
            entityType: 'reservation',
            entityId: id,
            action: 'reservation.bulk_deleted',
            changes: { bulk_operation_id: bulkOperationId, code: row.reservation_code },
          }),
          logReservationAudit({
            reservationId: id,
            action: 'reservation.bulk_deleted',
            snapshotBefore,
            snapshotAfter: { ...snapshotBefore, deleted_at: now, deleted_by: actorId, is_deleted: true },
            bulkOperationId,
          }),
        ]);
      }
    } catch (error) {
      logAppError('reservations.bulkDeleteReservations (unexpected)', error);
      result.failed += 1;
    }
  }

  return result;
}

import { listCleaningTasks, CleaningTaskWithRelations } from '@/lib/queries/cleaning-tasks';
import { computeDaysRemaining, listContracts, ContractWithRelations } from '@/lib/queries/contracts';
import { computeOccupancyRate } from '@/lib/queries/dashboard-metrics';
import { listMaintenanceTickets, MaintenanceTicketWithRelations } from '@/lib/queries/maintenance-tickets';
import { listOwnerPayments, computeDisplayStatus, OwnerPaymentWithRelations } from '@/lib/queries/owner-payments';
import { ActivationCenterEntry } from '@/lib/queries/property-activation';
import { listProperties, PropertyWithOwner } from '@/lib/queries/properties';
import { listAllReservationServicesForOps, ReservationServiceForOperations } from '@/lib/queries/reservation-services';
import { listReservations, ReservationWithRelations } from '@/lib/queries/reservations';
import { listServiceProviders, ServiceProviderRow } from '@/lib/queries/service-providers';
import { listUsersByRole, UserRow } from '@/lib/queries/users';
import { DateRange, toDateOnlyString } from '@/utils/date-range';

// ============================================================================
// FETCH LAYER — one parallel round-trip reusing every domain's existing list
// query (no new tables, no duplicated logic). Panels that only need a count
// still read from these same collections client-side; at real scale (hundreds
// of properties) the next optimization step would be dedicated head-count
// queries or a Postgres view, not more full-table fetches — noted, not done
// here since the current query set already matches what the Dashboard uses.
// ============================================================================

export type OperationsCenterRaw = {
  properties: PropertyWithOwner[];
  reservations: ReservationWithRelations[];
  cleaningTasks: CleaningTaskWithRelations[];
  maintenanceTickets: MaintenanceTicketWithRelations[];
  concierge: ReservationServiceForOperations[];
  ownerPayments: OwnerPaymentWithRelations[];
  contracts: ContractWithRelations[];
  cleaners: UserRow[];
  technicians: UserRow[];
  providers: ServiceProviderRow[];
};

export async function fetchOperationsCenterRaw(): Promise<OperationsCenterRaw> {
  const [properties, reservations, cleaningTasks, maintenanceTickets, concierge, ownerPayments, contracts, cleaners, technicians, providers] =
    await Promise.all([
      listProperties(),
      listReservations(),
      listCleaningTasks(),
      listMaintenanceTickets(),
      listAllReservationServicesForOps(),
      listOwnerPayments(),
      listContracts(),
      listUsersByRole('cleaner'),
      listUsersByRole('technician'),
      listServiceProviders(),
    ]);
  return { properties, reservations, cleaningTasks, maintenanceTickets, concierge, ownerPayments, contracts, cleaners, technicians, providers };
}

const NON_BILLABLE_RESERVATION_STATUSES = new Set(['cancelled', 'no_show']);
const OPEN_CLEANING_STATUSES = new Set(['unassigned', 'scheduled', 'in_progress']);
const OPEN_MAINTENANCE_STATUSES = new Set(['open', 'assigned', 'in_progress', 'on_hold']);
const ACTIVE_CONCIERGE_STATUSES = new Set(['offered', 'accepted', 'scheduled', 'in_progress']);

function isSameDay(dateStr: string | null | undefined, target: string): boolean {
  return !!dateStr && dateStr === target;
}

// ============================================================================
// PROPERTY STATUS ENGINE — computed at read time, never stored. Priority
// order matches the plan: a blocked/under-maintenance property overrides
// occupancy, which overrides cleaning need, which overrides "reserved".
// ============================================================================

export type PropertyOperationalStatus = 'blocked' | 'under_maintenance' | 'occupied' | 'needs_cleaning' | 'reserved' | 'ready';

export type PropertyStatusInfo = {
  propertyId: string;
  propertyName: string;
  status: PropertyOperationalStatus;
  currentGuestName: string | null;
  currentCheckIn: string | null;
  currentCheckOut: string | null;
  daysUntilAvailable: number | null;
  nextReservationCheckIn: string | null;
  daysUntilNextReservation: number | null;
};

export function computePropertyStatuses(raw: OperationsCenterRaw, today = new Date()): PropertyStatusInfo[] {
  const todayStr = toDateOnlyString(today);

  return raw.properties.map((property) => {
    const propertyReservations = raw.reservations.filter(
      (r) => r.property_id === property.id && !NON_BILLABLE_RESERVATION_STATUSES.has(r.status)
    );
    const currentReservation = propertyReservations.find(
      (r) => r.check_in_date <= todayStr && r.check_out_date > todayStr
    );
    const futureReservations = propertyReservations
      .filter((r) => r.check_in_date > todayStr)
      .sort((a, b) => a.check_in_date.localeCompare(b.check_in_date));
    const nextReservation = futureReservations[0] ?? null;

    const openTickets = raw.maintenanceTickets.filter(
      (t) => t.property_id === property.id && OPEN_MAINTENANCE_STATUSES.has(t.status)
    );
    const hasBlockingTicket = openTickets.some((t) => t.priority === 'urgent');

    // CB-05 (Launch Readiness Audit): this used to only look at a checkout that happened *today*,
    // so a property whose last guest checked out 2+ days ago with the cleaning task still open
    // fell through to "reserved"/"ready" (green) — a false-positive readiness signal. Now it looks
    // at the most recent past-or-today checkout for this property, whichever day it happened.
    const pastCheckouts = propertyReservations
      .filter((r) => r.check_out_date <= todayStr)
      .sort((a, b) => b.check_out_date.localeCompare(a.check_out_date));
    const lastCheckout = pastCheckouts[0];
    const cleaningForCheckout = lastCheckout
      ? raw.cleaningTasks.find((c) => c.reservation_id === lastCheckout.id)
      : undefined;
    const needsCleaning = !!lastCheckout && (!cleaningForCheckout || !['completed', 'verified'].includes(cleaningForCheckout.status));

    let status: PropertyOperationalStatus;
    if (hasBlockingTicket) status = 'blocked';
    else if (openTickets.length > 0) status = 'under_maintenance';
    else if (currentReservation) status = 'occupied';
    else if (needsCleaning) status = 'needs_cleaning';
    else if (nextReservation) status = 'reserved';
    else status = 'ready';

    const daysUntilAvailable = currentReservation
      ? Math.round((new Date(currentReservation.check_out_date).getTime() - today.getTime()) / 86_400_000)
      : null;
    const daysUntilNextReservation = nextReservation
      ? Math.round((new Date(nextReservation.check_in_date).getTime() - today.getTime()) / 86_400_000)
      : null;

    return {
      propertyId: property.id,
      propertyName: property.name,
      status,
      currentGuestName: currentReservation?.guest?.full_name ?? null,
      currentCheckIn: currentReservation?.check_in_date ?? null,
      currentCheckOut: currentReservation?.check_out_date ?? null,
      daysUntilAvailable,
      nextReservationCheckIn: nextReservation?.check_in_date ?? null,
      daysUntilNextReservation,
    };
  });
}

export const PROPERTY_STATUS_LABEL: Record<PropertyOperationalStatus, string> = {
  blocked: 'Bloqué',
  under_maintenance: 'En maintenance',
  occupied: 'Occupé',
  needs_cleaning: 'Ménage requis',
  reserved: 'Réservé',
  ready: 'Prêt',
};

export const PROPERTY_STATUS_COLOR: Record<PropertyOperationalStatus, { bg: string; text: string }> = {
  blocked: { bg: '#FAD9D9', text: '#B91C1C' },
  under_maintenance: { bg: '#FDEBC8', text: '#B45309' },
  occupied: { bg: '#E3E9F4', text: '#1E3A6E' },
  needs_cleaning: { bg: '#EEEAFB', text: '#6D4FC9' },
  reserved: { bg: '#F8EFD4', text: '#8a6d1c' },
  ready: { bg: '#DEF7E6', text: '#15803D' },
};

// ============================================================================
// TODAY / TOMORROW OPERATIONS — always real today/tomorrow, independent of
// the top date filter (their section titles are literal, not "the current
// selection"). The top filter instead widens the *flexible* panels below.
// ============================================================================

export function computeArrivals(raw: OperationsCenterRaw, dateStr: string): ReservationWithRelations[] {
  return raw.reservations.filter((r) => r.check_in_date === dateStr && !NON_BILLABLE_RESERVATION_STATUSES.has(r.status));
}

export function computeDepartures(raw: OperationsCenterRaw, dateStr: string): ReservationWithRelations[] {
  return raw.reservations.filter((r) => r.check_out_date === dateStr && !NON_BILLABLE_RESERVATION_STATUSES.has(r.status));
}

/** Reservations arriving/departing strictly between tomorrow and +7 days (today/tomorrow already
 * have their own dedicated sections) — a plain count, computed from the same `reservations`
 * collection already fetched for everything else on this screen. */
export function computeArrivalsNext7(raw: OperationsCenterRaw, todayStr: string): number {
  const start = new Date(`${todayStr}T00:00:00`);
  const end = new Date(start.getTime() + 7 * 86_400_000);
  const startStr = toDateOnlyString(new Date(start.getTime() + 86_400_000));
  const endStr = toDateOnlyString(end);
  return raw.reservations.filter(
    (r) => !NON_BILLABLE_RESERVATION_STATUSES.has(r.status) && r.check_in_date >= startStr && r.check_in_date <= endStr
  ).length;
}

export function computeDeparturesNext7(raw: OperationsCenterRaw, todayStr: string): number {
  const start = new Date(`${todayStr}T00:00:00`);
  const end = new Date(start.getTime() + 7 * 86_400_000);
  const startStr = toDateOnlyString(new Date(start.getTime() + 86_400_000));
  const endStr = toDateOnlyString(end);
  return raw.reservations.filter(
    (r) => !NON_BILLABLE_RESERVATION_STATUSES.has(r.status) && r.check_out_date >= startStr && r.check_out_date <= endStr
  ).length;
}

// ============================================================================
// RESERVATION RISKS — Phase 2 of the Operational Command Center mission. Every
// bucket is computed from columns that already exist on `reservations`/`guests`;
// "Late Check-In Risk" specifically is NOT implemented — see the false branch
// below and the mission report's Bugs Found section for why.
// ============================================================================

export function computeReservationRisks(raw: OperationsCenterRaw, todayStr: string) {
  const in48hStr = toDateOnlyString(new Date(new Date(`${todayStr}T00:00:00`).getTime() + 2 * 86_400_000));
  const active = raw.reservations.filter((r) => !NON_BILLABLE_RESERVATION_STATUSES.has(r.status));
  return {
    missingGuestInfo: active.filter((r) => !r.guest?.phone),
    pendingConfirmation: active.filter((r) => r.status === 'pending'),
    startingWithin48h: active.filter((r) => r.check_in_date >= todayStr && r.check_in_date <= in48hStr),
    /** Not computable: `reservations` has no expected-arrival-*time* column (`check_in_date` is a
     * date, not a timestamp), so there is no signal to distinguish a guest at risk of arriving
     * late from one arriving on time. Left empty rather than guessed — see Recommendations. */
    lateCheckInRisk: [] as ReservationWithRelations[],
  };
}

export function computeOccupiedToday(raw: OperationsCenterRaw, todayStr: string) {
  return raw.reservations
    .filter((r) => r.check_in_date <= todayStr && r.check_out_date > todayStr && !NON_BILLABLE_RESERVATION_STATUSES.has(r.status))
    .map((r) => ({
      propertyId: r.property_id,
      propertyName: r.property?.name ?? '—',
      guestName: r.guest?.full_name ?? '—',
      checkIn: r.check_in_date,
      checkOut: r.check_out_date,
      reservationId: r.id,
    }));
}

/** Properties with no active reservation today — with a forecast of when the
 * current gap ends (next confirmed reservation), satisfying the Availability
 * Forecast requirement without a second query. */
export function computeAvailableToday(statuses: PropertyStatusInfo[]) {
  return statuses
    .filter((s) => s.status === 'ready' || s.status === 'reserved' || s.status === 'needs_cleaning')
    .map((s) => ({
      propertyId: s.propertyId,
      propertyName: s.propertyName,
      status: s.status,
      daysUntilNextReservation: s.daysUntilNextReservation,
      nextReservationCheckIn: s.nextReservationCheckIn,
    }));
}

// ============================================================================
// FLEXIBLE OPERATIONAL PANELS — scoped to the manager-selected date range for
// the forward-looking "due/scheduled" slice; status-only buckets (overdue,
// in progress, unassigned, pending) are range-independent by nature.
// ============================================================================

export function computeCleaningPanel(raw: OperationsCenterRaw, range: DateRange, todayStr: string) {
  const startStr = toDateOnlyString(range.start);
  const endStr = toDateOnlyString(range.end);
  const nonCancelled = raw.cleaningTasks.filter((t) => t.status !== 'cancelled');
  return {
    dueInRange: nonCancelled.filter((t) => OPEN_CLEANING_STATUSES.has(t.status) && t.scheduled_date >= startStr && t.scheduled_date <= endStr),
    inProgress: nonCancelled.filter((t) => t.status === 'in_progress'),
    overdue: nonCancelled.filter((t) => OPEN_CLEANING_STATUSES.has(t.status) && t.scheduled_date < todayStr),
    awaitingVerification: nonCancelled.filter((t) => t.status === 'completed'),
    unassignedCount: nonCancelled.filter((t) => t.status === 'unassigned').length,
    /** All not-completed/not-verified/not-cancelled tasks, unbounded by the selected range —
     * the Executive Summary's "Cleaning Pending" KPI reuses this instead of a new query. */
    pendingCount: nonCancelled.filter((t) => OPEN_CLEANING_STATUSES.has(t.status)).length,
  };
}

export function computeMaintenancePanel(raw: OperationsCenterRaw, today: Date = new Date()) {
  const nonCancelled = raw.maintenanceTickets.filter((t) => t.status !== 'cancelled');
  const sevenDaysAgo = new Date(today.getTime() - 7 * 86_400_000);
  return {
    open: nonCancelled.filter((t) => OPEN_MAINTENANCE_STATUSES.has(t.status)),
    urgent: nonCancelled.filter((t) => t.priority === 'urgent' && OPEN_MAINTENANCE_STATUSES.has(t.status)),
    inProgress: nonCancelled.filter((t) => t.status === 'in_progress'),
    awaitingVerification: nonCancelled.filter((t) => t.status === 'resolved'),
    unassignedCount: nonCancelled.filter((t) => t.status === 'open' && !t.assigned_to_user_id).length,
    /** "on_hold" is this app's real status for a ticket blocked on parts — no separate column. */
    waitingParts: nonCancelled.filter((t) => t.status === 'on_hold'),
    olderThan7Days: nonCancelled.filter((t) => OPEN_MAINTENANCE_STATUSES.has(t.status) && new Date(t.created_at) < sevenDaysAgo),
  };
}

export function computeConciergePanel(raw: OperationsCenterRaw, range: DateRange, todayStr: string) {
  const startStr = toDateOnlyString(range.start);
  const endStr = toDateOnlyString(range.end);
  const relevant = raw.concierge.filter((s) => s.status !== 'cancelled' && s.status !== 'refunded');
  return {
    today: relevant.filter((s) => isSameDay(s.scheduled_date, todayStr)),
    pending: relevant.filter((s) => s.status === 'offered' || s.status === 'accepted'),
    scheduledInRange: relevant.filter(
      (s) => s.status === 'scheduled' && s.scheduled_date && s.scheduled_date >= startStr && s.scheduled_date <= endStr
    ),
    inProgress: relevant.filter((s) => s.status === 'in_progress'),
    completedToday: relevant.filter((s) => s.status === 'delivered' && isSameDay(s.completion_date, todayStr)),
    unassignedCount: relevant.filter((s) => !s.provider_id && ACTIVE_CONCIERGE_STATUSES.has(s.status)).length,
    /** Requested/Confirmed/Scheduled/In Progress, unbounded by the selected range — the
     * Executive Summary's "Concierge Requests Active" KPI reuses this instead of a new query. */
    activeCount: relevant.filter((s) => ACTIVE_CONCIERGE_STATUSES.has(s.status)).length,
  };
}

export function computeOwnerPaymentsPanel(raw: OperationsCenterRaw, todayStr: string) {
  const weekEnd = toDateOnlyString(new Date(new Date(todayStr).getTime() + 7 * 86_400_000));
  const active = raw.ownerPayments.filter((p) => p.status !== 'paid' && p.status !== 'cancelled');
  return {
    dueToday: active.filter((p) => p.due_date === todayStr),
    dueThisWeek: active.filter((p) => p.due_date && p.due_date > todayStr && p.due_date <= weekEnd),
    overdue: active.filter((p) => computeDisplayStatus(p) === 'overdue'),
  };
}

/** Module 7 / Phase 12: replaces the old static "Bientôt" placeholder. Computed at read time
 * from `end_date` — same `computeDaysRemaining` used by the Contracts screens, no new logic. */
export function computeContractsPanel(raw: OperationsCenterRaw, today: Date = new Date()) {
  const active = raw.contracts.filter((c) => c.status === 'active' && c.end_date);
  const withDays = active.map((c) => ({ contract: c, days: computeDaysRemaining(c.end_date, today) as number }));
  return {
    expiringWithin90: withDays.filter((c) => c.days >= 0 && c.days <= 90).map((c) => c.contract),
    expiringWithin60: withDays.filter((c) => c.days >= 0 && c.days <= 60).map((c) => c.contract),
    expiringWithin30: withDays.filter((c) => c.days >= 0 && c.days <= 30).map((c) => c.contract),
    expired: withDays.filter((c) => c.days < 0).map((c) => c.contract),
  };
}

// ============================================================================
// PROPERTY HEALTH — Manager Command Center, Phase 2. "Pending Activation",
// "Missing Photos/Pricing/Contract" are read straight off the Activation
// Center summary (already computed server-side by get_activation_center_summary,
// not recomputed here); "Missing Owner Assignment" is the one signal that
// activation status doesn't track, so it's derived from `properties.primaryOwner`
// (already attached by `attachPrimaryOwners`) instead.
// ============================================================================

export function computePropertyHealthPanel(raw: OperationsCenterRaw, activationEntries: ActivationCenterEntry[]) {
  return {
    pendingActivation: activationEntries,
    missingPhotos: activationEntries.filter((p) => !p.photosSatisfied),
    missingPricing: activationEntries.filter((p) => !p.pricingComplete),
    missingContract: activationEntries.filter((p) => !p.hasActiveContract),
    missingOwner: raw.properties.filter((p) => !p.primaryOwner && p.status !== 'archived'),
  };
}

// ============================================================================
// OCCUPANCY CONTROL — Today / 7d / 30d / 90d, reusing the same
// occupied-properties-count-over-active-properties-count logic already used
// by `dashboard-metrics.ts`, just windowed differently.
// ============================================================================

export type OccupancySnapshot = { occupiedCount: number; availableCount: number; rate: number };

/** Booked nights for active properties, clipped to [start, end] — the numerator for the app-wide
 * Occupancy Rate standard (see `computeOccupancyRate` in dashboard-metrics.ts). Computed from the
 * same `raw.reservations` already fetched for this whole screen, no new query. */
function computeOccupiedNightsInWindow(raw: OperationsCenterRaw, start: Date, end: Date, activePropertyIds: Set<string>): number {
  const startMs = new Date(`${toDateOnlyString(start)}T00:00:00Z`).getTime();
  const endMs = new Date(`${toDateOnlyString(end)}T00:00:00Z`).getTime();
  let nights = 0;
  for (const r of raw.reservations) {
    if (NON_BILLABLE_RESERVATION_STATUSES.has(r.status) || !activePropertyIds.has(r.property_id)) continue;
    const checkInMs = new Date(`${r.check_in_date}T00:00:00Z`).getTime();
    const checkOutMs = new Date(`${r.check_out_date}T00:00:00Z`).getTime();
    const overlapStart = Math.max(checkInMs, startMs);
    const overlapEnd = Math.min(checkOutMs, endMs);
    if (overlapEnd > overlapStart) nights += (overlapEnd - overlapStart) / 86_400_000;
  }
  return nights;
}

/**
 * Financial Truth Remediation, Phase 1: `rate` is now the same booked-nights-÷-available-nights
 * standard used everywhere else (see `computeOccupancyRate`) — it used to be "properties booked
 * at least once ÷ active properties," which could disagree with Finance/Reports by as much as
 * 11x for the same range. `occupiedCount`/`availableCount` (property headcounts, shown in the
 * card's "X occ. · Y dispo." meta line) intentionally keep the old distinct-property logic — that
 * headcount is still a real, useful number, it's just not what "Occupancy Rate" means anymore.
 */
function computeOccupancyForWindow(raw: OperationsCenterRaw, start: Date, end: Date): OccupancySnapshot {
  const startStr = toDateOnlyString(start);
  const endStr = toDateOnlyString(end);
  const activeProperties = raw.properties.filter((p) => p.status === 'active');
  const activePropertyIds = new Set(activeProperties.map((p) => p.id));
  const occupiedPropertyIds = new Set(
    raw.reservations
      .filter((r) => !NON_BILLABLE_RESERVATION_STATUSES.has(r.status) && r.check_in_date <= endStr && r.check_out_date > startStr)
      .map((r) => r.property_id)
  );
  const occupiedCount = activeProperties.filter((p) => occupiedPropertyIds.has(p.id)).length;
  const occupiedNights = computeOccupiedNightsInWindow(raw, start, end, activePropertyIds);
  return {
    occupiedCount,
    availableCount: Math.max(0, activeProperties.length - occupiedCount),
    rate: computeOccupancyRate(occupiedNights, { start, end }, activeProperties.length),
  };
}

export function computeOccupancyControl(raw: OperationsCenterRaw, today = new Date()) {
  const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);
  return {
    today: computeOccupancyForWindow(raw, today, today),
    next7Days: computeOccupancyForWindow(raw, today, addDays(today, 7)),
    next30Days: computeOccupancyForWindow(raw, today, addDays(today, 30)),
    next90Days: computeOccupancyForWindow(raw, today, addDays(today, 90)),
  };
}

// ============================================================================
// TEAM WORKLOAD + PERFORMANCE — per person, not just a raw count: completion
// rate and average turnaround alongside assigned/completed/overdue, reusing
// the exact metric shapes already built for provider KPIs in Module 5.
// ============================================================================

export type CleanerPerformance = {
  userId: string;
  fullName: string;
  assignedCount: number;
  completedCount: number;
  overdueCount: number;
  completionRate: number | null;
  avgCompletionHours: number | null;
};

export function computeCleaningTeamWorkload(raw: OperationsCenterRaw, todayStr: string): CleanerPerformance[] {
  return raw.cleaners.map((cleaner) => {
    const assigned = raw.cleaningTasks.filter((t) => t.assigned_to_user_id === cleaner.id && t.status !== 'cancelled');
    const completed = assigned.filter((t) => t.status === 'completed' || t.status === 'verified');
    const overdue = assigned.filter((t) => OPEN_CLEANING_STATUSES.has(t.status) && t.scheduled_date < todayStr);
    const durations = completed
      .filter((t) => t.started_at && t.completed_at)
      .map((t) => (new Date(t.completed_at as string).getTime() - new Date(t.started_at as string).getTime()) / 3_600_000);
    return {
      userId: cleaner.id,
      fullName: cleaner.full_name,
      assignedCount: assigned.length,
      completedCount: completed.length,
      overdueCount: overdue.length,
      completionRate: assigned.length > 0 ? (completed.length / assigned.length) * 100 : null,
      avgCompletionHours: durations.length > 0 ? durations.reduce((s, d) => s + d, 0) / durations.length : null,
    };
  });
}

export type TechnicianPerformance = {
  userId: string;
  fullName: string;
  assignedCount: number;
  openCount: number;
  completedCount: number;
  completionRate: number | null;
  avgResolutionHours: number | null;
};

export function computeMaintenanceTeamWorkload(raw: OperationsCenterRaw): TechnicianPerformance[] {
  return raw.technicians.map((tech) => {
    const assigned = raw.maintenanceTickets.filter((t) => t.assigned_to_user_id === tech.id && t.status !== 'cancelled');
    const open = assigned.filter((t) => OPEN_MAINTENANCE_STATUSES.has(t.status));
    const completed = assigned.filter((t) => t.status === 'resolved' || t.status === 'closed');
    const durations = completed
      .filter((t) => t.resolved_at)
      .map((t) => (new Date(t.resolved_at as string).getTime() - new Date(t.created_at).getTime()) / 3_600_000);
    return {
      userId: tech.id,
      fullName: tech.full_name,
      assignedCount: assigned.length,
      openCount: open.length,
      completedCount: completed.length,
      completionRate: assigned.length > 0 ? (completed.length / assigned.length) * 100 : null,
      avgResolutionHours: durations.length > 0 ? durations.reduce((s, d) => s + d, 0) / durations.length : null,
    };
  });
}

export type ProviderPerformance = {
  providerId: string;
  name: string;
  pendingCount: number;
  activeCount: number;
  completedCount: number;
  revenue: number;
  profit: number;
  completionRate: number | null;
};

/** "Concierge Team" workload, computed per provider — the only assignable
 * entity in the concierge domain (requests link to a provider company, not a
 * staff "concierge manager"). Flagged in the plan; same interpretation here. */
export function computeConciergeTeamWorkload(raw: OperationsCenterRaw): ProviderPerformance[] {
  return raw.providers.map((provider) => {
    const requests = raw.concierge.filter((s) => s.provider_id === provider.id);
    const pending = requests.filter((s) => s.status === 'offered' || s.status === 'accepted');
    const active = requests.filter((s) => s.status === 'scheduled' || s.status === 'in_progress');
    const completed = requests.filter((s) => s.status === 'delivered');
    const nonCancelled = requests.filter((s) => s.status !== 'cancelled' && s.status !== 'refunded');
    return {
      providerId: provider.id,
      name: provider.name,
      pendingCount: pending.length,
      activeCount: active.length,
      completedCount: completed.length,
      revenue: completed.reduce((sum, s) => sum + (s.total_price ?? 0), 0),
      profit: completed.reduce((sum, s) => sum + (s.profit ?? 0), 0),
      completionRate: nonCancelled.length > 0 ? (completed.length / nonCancelled.length) * 100 : null,
    };
  });
}

// ============================================================================
// UNASSIGNED WORK — a dedicated KPI row, distinct from (but feeding into) the
// Risk Center below.
// ============================================================================

export function computeUnassignedWork(raw: OperationsCenterRaw) {
  return {
    cleaning: raw.cleaningTasks.filter((t) => t.status === 'unassigned').length,
    maintenance: raw.maintenanceTickets.filter((t) => t.status === 'open' && !t.assigned_to_user_id).length,
    concierge: raw.concierge.filter((s) => !s.provider_id && ACTIVE_CONCIERGE_STATUSES.has(s.status)).length,
  };
}

// ============================================================================
// BUSINESS RISK CENTER
// ============================================================================

export function computeRiskCenter(raw: OperationsCenterRaw, statuses: PropertyStatusInfo[]) {
  const unassignedWork = computeUnassignedWork(raw);
  return {
    propertiesWithoutReservation: statuses.filter((s) => s.status === 'ready' && !s.nextReservationCheckIn).length,
    propertiesNeedingCleaning: statuses.filter((s) => s.status === 'needs_cleaning').length,
    propertiesBlocked: statuses.filter((s) => s.status === 'blocked').length,
    unassignedMaintenanceTickets: unassignedWork.maintenance,
    unassignedCleaningTasks: unassignedWork.cleaning,
    unassignedConciergeRequests: unassignedWork.concierge,
    overdueOwnerPayments: raw.ownerPayments.filter((p) => computeDisplayStatus(p) === 'overdue').length,
  };
}

// ============================================================================
// ALERT CENTER — every entry carries enough to be clickable (id + kind).
// ============================================================================

export type OperationsAlert = {
  id: string;
  kind: 'maintenance' | 'cleaning' | 'owner_payment' | 'concierge' | 'reservation' | 'contract' | 'payment';
  severity: 'urgent' | 'warning';
  title: string;
  subtitle: string;
  href: string;
};

export function computeAlertCenter(raw: OperationsCenterRaw, todayStr: string, tomorrowStr: string): OperationsAlert[] {
  const alerts: OperationsAlert[] = [];

  for (const t of raw.maintenanceTickets.filter((t) => t.priority === 'urgent' && OPEN_MAINTENANCE_STATUSES.has(t.status))) {
    alerts.push({
      id: `maint-${t.id}`,
      kind: 'maintenance',
      severity: 'urgent',
      title: `Maintenance urgente · ${t.ticket_number}`,
      subtitle: `${t.issue_summary} — ${t.property?.name ?? '—'}`,
      href: `/more/maintenance/${t.id}`,
    });
  }
  for (const c of raw.cleaningTasks.filter((c) => OPEN_CLEANING_STATUSES.has(c.status) && c.scheduled_date < todayStr)) {
    alerts.push({
      id: `clean-${c.id}`,
      kind: 'cleaning',
      severity: 'urgent',
      title: `Ménage en retard · ${c.task_number}`,
      subtitle: `${c.property?.name ?? '—'} — prévu le ${c.scheduled_date}`,
      href: `/more/cleaning/${c.id}`,
    });
  }
  for (const p of raw.ownerPayments.filter((p) => computeDisplayStatus(p) === 'overdue')) {
    alerts.push({
      id: `pay-${p.id}`,
      kind: 'owner_payment',
      severity: 'urgent',
      title: `Versement en retard · ${p.payment_number}`,
      subtitle: `${p.owner?.full_name ?? '—'} — échéance ${p.due_date}`,
      href: `/more/owner-payments/${p.id}`,
    });
  }
  for (const s of raw.concierge.filter((s) => !s.provider_id && ACTIVE_CONCIERGE_STATUSES.has(s.status))) {
    alerts.push({
      id: `con-${s.id}`,
      kind: 'concierge',
      severity: 'warning',
      title: `Prestataire à assigner · ${s.request_number}`,
      subtitle: `${s.service?.name ?? '—'} — ${s.reservation?.property?.name ?? '—'}`,
      href: `/reservations/${s.reservation_id}`,
    });
  }
  for (const r of computeArrivals(raw, tomorrowStr)) {
    alerts.push({
      id: `arr-${r.id}`,
      kind: 'reservation',
      severity: 'warning',
      title: `Arrivée demain`,
      subtitle: `${r.guest?.full_name ?? '—'} — ${r.property?.name ?? '—'}`,
      href: `/reservations/${r.id}`,
    });
  }
  for (const r of computeDepartures(raw, tomorrowStr)) {
    alerts.push({
      id: `dep-${r.id}`,
      kind: 'reservation',
      severity: 'warning',
      title: `Départ demain`,
      subtitle: `${r.guest?.full_name ?? '—'} — ${r.property?.name ?? '—'}`,
      href: `/reservations/${r.id}`,
    });
  }
  for (const c of raw.cleaningTasks.filter((c) => c.status === 'completed')) {
    alerts.push({
      id: `unverif-clean-${c.id}`,
      kind: 'cleaning',
      severity: 'warning',
      title: `Ménage non vérifié · ${c.task_number}`,
      subtitle: c.property?.name ?? '—',
      href: `/more/cleaning/${c.id}`,
    });
  }
  for (const t of raw.maintenanceTickets.filter((t) => t.status === 'resolved')) {
    alerts.push({
      id: `unverif-maint-${t.id}`,
      kind: 'maintenance',
      severity: 'warning',
      title: `Réparation non vérifiée · ${t.ticket_number}`,
      subtitle: t.property?.name ?? '—',
      href: `/more/maintenance/${t.id}`,
    });
  }
  // Reservation Risks (Phase 2): only surfaced here when the risk is imminent (within 48h) —
  // the full, unbounded lists live in the dedicated Reservation Risks panel below.
  const in48hStr = toDateOnlyString(new Date(new Date(`${todayStr}T00:00:00`).getTime() + 2 * 86_400_000));
  for (const r of raw.reservations.filter(
    (r) => r.status === 'pending' && r.check_in_date >= todayStr && r.check_in_date <= in48hStr
  )) {
    alerts.push({
      id: `risk-pending-${r.id}`,
      kind: 'reservation',
      severity: 'urgent',
      title: `Réservation non confirmée · arrivée sous 48h`,
      subtitle: `${r.guest?.full_name ?? '—'} — ${r.property?.name ?? '—'} — ${r.check_in_date}`,
      href: `/reservations/${r.id}`,
    });
  }
  for (const r of raw.reservations.filter(
    (r) =>
      !NON_BILLABLE_RESERVATION_STATUSES.has(r.status) &&
      !r.guest?.phone &&
      r.check_in_date >= todayStr &&
      r.check_in_date <= in48hStr
  )) {
    alerts.push({
      id: `risk-missing-info-${r.id}`,
      kind: 'reservation',
      severity: 'warning',
      title: `Coordonnées client manquantes · arrivée sous 48h`,
      subtitle: `${r.guest?.full_name ?? '—'} — ${r.property?.name ?? '—'}`,
      href: `/reservations/${r.id}`,
    });
  }
  for (const c of raw.contracts.filter((c) => c.status === 'active' && c.end_date)) {
    const days = computeDaysRemaining(c.end_date, new Date(todayStr));
    if (days === null || days < 0) continue;
    if (days <= 30) {
      alerts.push({
        id: `contract-${c.id}`,
        kind: 'contract',
        severity: 'urgent',
        title: `Contrat expirant · ${c.contract_number}`,
        subtitle: `${c.property?.name ?? '—'} — ${days} jours restants`,
        href: `/more/contracts/${c.id}`,
      });
    } else if (days <= 90) {
      alerts.push({
        id: `contract-${c.id}`,
        kind: 'contract',
        severity: 'warning',
        title: `Contrat expirant bientôt · ${c.contract_number}`,
        subtitle: `${c.property?.name ?? '—'} — ${days} jours restants`,
        href: `/more/contracts/${c.id}`,
      });
    }
  }

  return alerts.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'urgent' ? -1 : 1));
}

// ============================================================================
// PERFORMANCE INSIGHTS — derived from data already fetched, no manual scores.
// ============================================================================

export function computePerformanceInsights(
  raw: OperationsCenterRaw,
  cleanerPerf: CleanerPerformance[],
  technicianPerf: TechnicianPerformance[]
) {
  const revenueByProperty = new Map<string, number>();
  const occupiedDaysByProperty = new Map<string, number>();
  for (const r of raw.reservations.filter((r) => !NON_BILLABLE_RESERVATION_STATUSES.has(r.status))) {
    revenueByProperty.set(r.property_id, (revenueByProperty.get(r.property_id) ?? 0) + r.total_amount);
    occupiedDaysByProperty.set(r.property_id, (occupiedDaysByProperty.get(r.property_id) ?? 0) + (r.nights ?? 0));
  }
  // Financial Truth Remediation, Phase 7 (regression finding): this was previously an always-empty
  // map, silently making "Plus rentable" (Most Profitable) an exact duplicate of "Meilleur revenu"
  // (Top Revenue) — a genuine "Duplicate KPI" bug caught while validating this file's other
  // changes. Cleaning/maintenance costs ARE already fetched onto this same `raw` object, so they
  // now actually reduce the per-property figure; the general `expenses` table is NOT fetched here
  // (Operations Center's raw fetch never has needed it before), so this remains a real but partial
  // cost basis — documented, not silently claimed as complete.
  const costByProperty = new Map<string, number>();
  for (const c of raw.cleaningTasks.filter((c) => c.status !== 'cancelled')) {
    costByProperty.set(c.property_id, (costByProperty.get(c.property_id) ?? 0) + (c.cost_amount ?? 0));
  }
  for (const m of raw.maintenanceTickets.filter((m) => m.status !== 'cancelled')) {
    costByProperty.set(m.property_id, (costByProperty.get(m.property_id) ?? 0) + (m.actual_cost ?? m.estimated_cost ?? 0));
  }
  const profitByProperty = new Map<string, number>(
    Array.from(revenueByProperty.entries()).map(([id, revenue]) => [id, revenue - (costByProperty.get(id) ?? 0)])
  );

  const topBy = (map: Map<string, number>, nameOf: (id: string) => string): { name: string; value: number } | null => {
    if (map.size === 0) return null;
    const [id, value] = Array.from(map.entries()).sort((a, b) => b[1] - a[1])[0];
    return { name: nameOf(id), value };
  };

  const propertyName = (id: string) => raw.properties.find((p) => p.id === id)?.name ?? '—';

  const serviceRevenue = new Map<string, number>();
  const providerRevenue = new Map<string, number>();
  for (const s of raw.concierge.filter((s) => s.status === 'delivered')) {
    if (s.service?.name) serviceRevenue.set(s.service.name, (serviceRevenue.get(s.service.name) ?? 0) + (s.profit ?? 0));
    if (s.provider?.name) providerRevenue.set(s.provider.name, (providerRevenue.get(s.provider.name) ?? 0) + (s.profit ?? 0));
  }
  const topServiceEntry = Array.from(serviceRevenue.entries()).sort((a, b) => b[1] - a[1])[0];
  const topProviderEntry = Array.from(providerRevenue.entries()).sort((a, b) => b[1] - a[1])[0];

  const bestCleaner = cleanerPerf.filter((c) => c.completedCount > 0).sort((a, b) => b.completedCount - a.completedCount)[0];
  const bestTechnician = technicianPerf.filter((t) => t.completedCount > 0).sort((a, b) => b.completedCount - a.completedCount)[0];

  return {
    topRevenueProperty: topBy(revenueByProperty, propertyName),
    topOccupancyProperty: topBy(occupiedDaysByProperty, propertyName),
    mostProfitableProperty: topBy(profitByProperty, propertyName),
    topConciergeService: topServiceEntry ? { name: topServiceEntry[0], value: topServiceEntry[1] } : null,
    topConciergeProvider: topProviderEntry ? { name: topProviderEntry[0], value: topProviderEntry[1] } : null,
    bestCleaner: bestCleaner ? { name: bestCleaner.fullName, value: bestCleaner.completedCount } : null,
    bestTechnician: bestTechnician ? { name: bestTechnician.fullName, value: bestTechnician.completedCount } : null,
  };
}

// ============================================================================
// BUSINESS HEALTH SCORE — Mission D, Phase 11. Super Admin/Admin/Manager only.
//
// FORMULA (documented per the mission's explicit requirement — nothing here is
// guessed or hardcoded; every input is a count already computed elsewhere on
// this same screen from real rows):
//
//   score = 0.20 * reservationsScore
//         + 0.15 * cleaningScore
//         + 0.15 * maintenanceScore
//         + 0.20 * financeScore
//         + 0.15 * contractsScore
//         + 0.15 * propertyReadinessScore
//
// Each sub-score is 0-100, computed as "100 minus the share of the relevant
// population that is currently a problem":
//   reservationsScore  = 100 - (pendingConfirmation + missingGuestInfo, deduped) / upcoming7dCount
//   cleaningScore      = 100 - overdueCleaningCount / openCleaningCount
//   maintenanceScore   = 100 - (urgentOpenCount + olderThan7DaysCount, deduped) / openMaintenanceCount
//   financeScore       = 100 - overdueOwnerPaymentsCount / activeOwnerPaymentsCount
//   contractsScore     = 100 - (expiredCount + 0.5 * expiringWithin30Count) / activeContractsCount
//   propertyReadinessScore = 100 * activePropertiesCount / (activePropertiesCount + onboardingCount)
//                            , then reduced further by blockedPropertiesCount
//
// Every ratio's denominator is floored at 1 to avoid divide-by-zero; an empty
// population (e.g. zero open maintenance tickets) scores that dimension 100,
// not undefined — an operationally quiet area is a healthy area, not a missing one.
// ============================================================================

export type BusinessHealthInputs = {
  reservationRisks: { missingGuestInfo: unknown[]; pendingConfirmation: unknown[] };
  upcoming7dReservationsCount: number;
  cleaningPanel: { overdue: unknown[] };
  openCleaningCount: number;
  maintenancePanel: { urgent: unknown[]; olderThan7Days: unknown[] };
  openMaintenanceCount: number;
  overdueOwnerPaymentsCount: number;
  activeOwnerPaymentsCount: number;
  contractsPanel: { expired: unknown[]; expiringWithin30: unknown[] };
  activeContractsCount: number;
  activePropertiesCount: number;
  onboardingPropertiesCount: number;
  blockedPropertiesCount: number;
};

export type BusinessHealthResult = {
  score: number;
  breakdown: {
    reservationsScore: number;
    cleaningScore: number;
    maintenanceScore: number;
    financeScore: number;
    contractsScore: number;
    propertyReadinessScore: number;
  };
};

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function computeBusinessHealthScore(inputs: BusinessHealthInputs): BusinessHealthResult {
  const riskyReservations = new Set([...inputs.reservationRisks.missingGuestInfo, ...inputs.reservationRisks.pendingConfirmation]).size;
  const reservationsScore = clampScore(100 - (riskyReservations / Math.max(1, inputs.upcoming7dReservationsCount)) * 100);

  const cleaningScore = clampScore(100 - (inputs.cleaningPanel.overdue.length / Math.max(1, inputs.openCleaningCount)) * 100);

  const riskyMaintenance = new Set([...inputs.maintenancePanel.urgent, ...inputs.maintenancePanel.olderThan7Days]).size;
  const maintenanceScore = clampScore(100 - (riskyMaintenance / Math.max(1, inputs.openMaintenanceCount)) * 100);

  const financeScore = clampScore(100 - (inputs.overdueOwnerPaymentsCount / Math.max(1, inputs.activeOwnerPaymentsCount)) * 100);

  const contractPenalty = inputs.contractsPanel.expired.length + 0.5 * inputs.contractsPanel.expiringWithin30.length;
  const contractsScore = clampScore(100 - (contractPenalty / Math.max(1, inputs.activeContractsCount)) * 100);

  const readinessBase =
    (100 * inputs.activePropertiesCount) / Math.max(1, inputs.activePropertiesCount + inputs.onboardingPropertiesCount);
  const propertyReadinessScore = clampScore(
    readinessBase - (inputs.blockedPropertiesCount / Math.max(1, inputs.activePropertiesCount)) * 100
  );

  const score = clampScore(
    0.2 * reservationsScore +
      0.15 * cleaningScore +
      0.15 * maintenanceScore +
      0.2 * financeScore +
      0.15 * contractsScore +
      0.15 * propertyReadinessScore
  );

  return {
    score,
    breakdown: { reservationsScore, cleaningScore, maintenanceScore, financeScore, contractsScore, propertyReadinessScore },
  };
}

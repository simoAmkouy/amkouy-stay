import { supabase } from '@/lib/supabase';
import { getPaymentsOverview } from '@/lib/queries/payments';
import { DateRange, toDateOnlyString } from '@/utils/date-range';

export type DashboardMetrics = {
  revenueAccommodation: number;
  revenueConcierge: number;
  revenueTotal: number;
  expenses: number;
  profit: number;
  reservationsCount: number;
  checkIns: number;
  checkOuts: number;
  occupancyRate: number; // 0-100
  occupiedPropertiesCount: number;
  availablePropertiesCount: number;
  averageDailyRate: number;
  ownerPaymentsDueCount: number;
  cleaningTasksDueCount: number;
  maintenanceOpenCount: number;
  maintenanceCost: number;
  maintenanceUrgentCount: number;
  maintenanceInProgressCount: number;
  maintenanceCompletedCount: number;
  maintenanceAvgResolutionHours: number | null;
  conciergeCost: number;
  conciergeProfit: number;
  conciergeServicesSold: number;
  conciergeServicesPending: number;
  conciergeServicesCompleted: number;
  conciergeTopService: string | null;
  conciergeTopProvider: string | null;
  // Module 9 — guest payments, sourced from the get_payments_overview RPC (server-side
  // aggregation, not recomputed from raw reservation/payment rows here).
  cashReceived: number;
  outstandingBalances: number;
  pendingDeposits: number;
  refundsTotal: number;
  collectionRate: number;
  avgCollectionDelayDays: number | null;
  // Command Center (Mission D): real count, replacing a previously hardcoded `0` on the Home tile.
  contractsExpiringCount: number;
};

const NON_BILLABLE_STATUSES = new Set(['cancelled', 'no_show']);

/**
 * Occupancy Rate — Financial Truth Remediation, Phase 1. The ONE app-wide standard: booked
 * nights ÷ available room-nights (days in range × active properties), rounded to 1 decimal and
 * clamped to 100 — matches report_portfolio_summary/report_property_performance/
 * report_owner_statement's SQL formula exactly (see docs/KPI_REGISTRY.md "Occupancy Rate"). Every
 * screen showing an occupancy percentage must call this, not recompute its own version — the
 * "properties booked at least once" formula that used to live here and in operations-center.ts is
 * retired; that headcount is still useful (see `occupiedPropertiesCount`) but is no longer called
 * "Occupancy Rate".
 */
export function computeOccupancyRate(occupiedNights: number, range: DateRange, activePropertiesCount: number): number {
  if (activePropertiesCount <= 0) return 0;
  const startMs = new Date(`${toDateOnlyString(range.start)}T00:00:00Z`).getTime();
  const endMs = new Date(`${toDateOnlyString(range.end)}T00:00:00Z`).getTime();
  const daysInRange = (endMs - startMs) / 86_400_000 + 1;
  if (daysInRange <= 0) return 0;
  const rate = (occupiedNights / (daysInRange * activePropertiesCount)) * 100;
  return Math.min(100, Math.round(rate * 10) / 10);
}

/** Arrivals in this period — deliberately check-in-date-only (Convention A): "arrivals" and
 * "reservations count" are inherently about which stays *start* in the window, not revenue
 * attribution, so this one query keeps its original convention even though Revenue below no
 * longer does (Financial Truth Remediation, Phase 3 — see docs/KPI_REGISTRY.md). */
async function fetchReservationsInRange(range: DateRange) {
  const { data, error } = await supabase
    .from('reservations')
    .select('id, property_id, nights, total_amount, status')
    .is('deleted_at', null)
    .gte('check_in_date', toDateOnlyString(range.start))
    .lte('check_in_date', toDateOnlyString(range.end));
  if (error) throw error;
  return data ?? [];
}

/** Revenue (Financial Truth Remediation, Phase 3): stay-overlap window, prorated to the nights
 * that actually fall inside [start, end] — matches report_portfolio_summary's SQL formula exactly
 * (the app-wide Revenue Attribution Policy standard), so the Home tab can never disagree with
 * Finance/Reports again. Concierge revenue is intentionally read from this same reservation set,
 * unprorated — matching the SQL RPCs' documented choice not to prorate concierge (a service is
 * delivered on a specific date, not spread across the stay). */
async function fetchRevenueInRange(range: DateRange): Promise<{ revenue: number; nights: number; reservationIds: string[] }> {
  const { data, error } = await supabase
    .from('reservations')
    .select('id, total_amount, status, check_in_date, check_out_date')
    .is('deleted_at', null)
    .lte('check_in_date', toDateOnlyString(range.end))
    .gte('check_out_date', toDateOnlyString(range.start));
  if (error) throw error;

  const rangeStartMs = new Date(`${toDateOnlyString(range.start)}T00:00:00Z`).getTime();
  const rangeEndMs = new Date(`${toDateOnlyString(range.end)}T00:00:00Z`).getTime();
  let revenue = 0;
  let nights = 0;
  const reservationIds: string[] = [];
  for (const r of data ?? []) {
    if (NON_BILLABLE_STATUSES.has(r.status)) continue;
    reservationIds.push(r.id);
    const checkInMs = new Date(`${r.check_in_date}T00:00:00Z`).getTime();
    const checkOutMs = new Date(`${r.check_out_date}T00:00:00Z`).getTime();
    const totalNights = (checkOutMs - checkInMs) / 86_400_000;
    const overlapStart = Math.max(checkInMs, rangeStartMs);
    const overlapEnd = Math.min(checkOutMs, rangeEndMs);
    const overlapNights = overlapEnd > overlapStart ? (overlapEnd - overlapStart) / 86_400_000 : 0;
    const frac = totalNights > 0 ? overlapNights / totalNights : 0;
    revenue += r.total_amount * frac;
    nights += overlapNights;
  }
  return { revenue, nights, reservationIds };
}

async function fetchCheckOutsCount(range: DateRange): Promise<number> {
  const { count, error } = await supabase
    .from('reservations')
    .select('id', { count: 'exact', head: true })
    .is('deleted_at', null)
    .gte('check_out_date', toDateOnlyString(range.start))
    .lte('check_out_date', toDateOnlyString(range.end));
  if (error) throw error;
  return count ?? 0;
}

type OccupancyRaw = {
  /** Distinct active properties with ≥1 overlapping booking — a headcount, not a rate. Feeds the
   * "Occupied"/"Available" property-count tiles only; NOT the Occupancy Rate percentage (see
   * `occupiedNights` below for that — Financial Truth Remediation, Phase 1: the two were
   * previously conflated under one "Occupancy" formula, disagreeing by as much as 11x with the
   * Finance/Reports nights-based rate for the same range). */
  occupiedPropertiesCount: number;
  /** Total booked nights across active properties, clipped to the queried range — the numerator
   * of the app-wide Occupancy Rate standard (see docs/KPI_REGISTRY.md "Occupancy Rate"),
   * matching report_portfolio_summary's SQL formula exactly so the Home tab and the Finance/
   * Reports screens can never disagree again. */
  occupiedNights: number;
};

async function fetchOccupancyRaw(range: DateRange): Promise<OccupancyRaw> {
  const { data, error } = await supabase
    .from('reservations')
    .select('property_id, status, check_in_date, check_out_date, property:properties!inner(status)')
    .is('deleted_at', null)
    .eq('property.status', 'active')
    .lte('check_in_date', toDateOnlyString(range.end))
    .gte('check_out_date', toDateOnlyString(range.start));
  if (error) throw error;
  const active = (data ?? []).filter((r) => !NON_BILLABLE_STATUSES.has(r.status));

  const rangeStartMs = new Date(`${toDateOnlyString(range.start)}T00:00:00Z`).getTime();
  const rangeEndMs = new Date(`${toDateOnlyString(range.end)}T00:00:00Z`).getTime();
  let occupiedNights = 0;
  for (const r of active) {
    const checkInMs = new Date(`${r.check_in_date}T00:00:00Z`).getTime();
    const checkOutMs = new Date(`${r.check_out_date}T00:00:00Z`).getTime();
    const overlapStart = Math.max(checkInMs, rangeStartMs);
    const overlapEnd = Math.min(checkOutMs, rangeEndMs);
    if (overlapEnd > overlapStart) occupiedNights += (overlapEnd - overlapStart) / 86_400_000;
  }

  return {
    occupiedPropertiesCount: new Set(active.map((r) => r.property_id)).size,
    occupiedNights,
  };
}

async function fetchActivePropertiesCount(): Promise<number> {
  const { count, error } = await supabase
    .from('properties')
    .select('id', { count: 'exact', head: true })
    .is('deleted_at', null)
    .eq('status', 'active');
  if (error) throw error;
  return count ?? 0;
}

const CONCIERGE_PENDING_STATUSES = new Set(['offered', 'accepted', 'scheduled', 'in_progress']);

type ConciergeMetrics = {
  revenue: number;
  cost: number;
  profit: number;
  servicesSold: number;
  servicesPending: number;
  servicesCompleted: number;
  topService: string | null;
  topProvider: string | null;
};

/** Revenue/cost/profit are read straight from the stored `total_price`/`cost_amount`/`profit`
 * columns (profit is a generated column) — never recomputed here. */
async function fetchConciergeMetrics(reservationIds: string[]): Promise<ConciergeMetrics> {
  if (reservationIds.length === 0) {
    return { revenue: 0, cost: 0, profit: 0, servicesSold: 0, servicesPending: 0, servicesCompleted: 0, topService: null, topProvider: null };
  }
  const { data, error } = await supabase
    .from('reservation_services')
    .select('total_price, cost_amount, profit, status, service:services(name), provider:service_providers(name)')
    .in('reservation_id', reservationIds)
    .is('deleted_at', null)
    .neq('status', 'cancelled')
    .neq('status', 'refunded');
  if (error) throw error;
  const rows = (data ?? []) as unknown as {
    total_price: number | null;
    cost_amount: number | null;
    profit: number | null;
    status: string;
    service: { name: string } | null;
    provider: { name: string } | null;
  }[];

  const serviceProfitByName = new Map<string, number>();
  const providerProfitByName = new Map<string, number>();
  for (const row of rows) {
    if (row.service?.name) {
      serviceProfitByName.set(row.service.name, (serviceProfitByName.get(row.service.name) ?? 0) + (row.profit ?? 0));
    }
    if (row.provider?.name) {
      providerProfitByName.set(row.provider.name, (providerProfitByName.get(row.provider.name) ?? 0) + (row.profit ?? 0));
    }
  }
  const topOf = (map: Map<string, number>): string | null =>
    map.size > 0 ? Array.from(map.entries()).sort((a, b) => b[1] - a[1])[0][0] : null;

  return {
    revenue: rows.reduce((sum, r) => sum + (r.total_price ?? 0), 0),
    cost: rows.reduce((sum, r) => sum + (r.cost_amount ?? 0), 0),
    profit: rows.reduce((sum, r) => sum + (r.profit ?? 0), 0),
    servicesSold: rows.length,
    servicesPending: rows.filter((r) => CONCIERGE_PENDING_STATUSES.has(r.status)).length,
    servicesCompleted: rows.filter((r) => r.status === 'delivered').length,
    topService: topOf(serviceProfitByName),
    topProvider: topOf(providerProfitByName),
  };
}

/** Excludes expenses generated from a cleaning task or maintenance ticket
 * (related_cleaning_task_id / related_maintenance_ticket_id) — those costs are already
 * counted via fetchCleaningCostTotal/fetchMaintenance, so including them here too would
 * double-subtract the same cost from Profit. Matches report_portfolio_summary's `exp` CTE. */
async function fetchExpensesTotal(range: DateRange): Promise<number> {
  const { data, error } = await supabase
    .from('expenses')
    .select('amount')
    .is('deleted_at', null)
    .is('related_cleaning_task_id', null)
    .is('related_maintenance_ticket_id', null)
    .gte('expense_date', toDateOnlyString(range.start))
    .lte('expense_date', toDateOnlyString(range.end));
  if (error) throw error;
  return (data ?? []).reduce((sum, e) => sum + e.amount, 0);
}

/** Mirrors report_portfolio_summary's `cleaning` CTE — same filter (scheduled_date in range,
 * status <> 'cancelled') and same column (cost_amount) — so the Dashboard's Profit figure
 * reconciles with the Portfolio Report's instead of silently omitting cleaning costs. */
async function fetchCleaningCostTotal(range: DateRange): Promise<number> {
  const { data, error } = await supabase
    .from('cleaning_tasks')
    .select('cost_amount')
    .is('deleted_at', null)
    .neq('status', 'cancelled')
    .gte('scheduled_date', toDateOnlyString(range.start))
    .lte('scheduled_date', toDateOnlyString(range.end));
  if (error) throw error;
  return (data ?? []).reduce((sum, t) => sum + (t.cost_amount ?? 0), 0);
}

/** Counts not-yet-paid payments whose `due_date` falls in range — matches the Upcoming/Due/
 * Overdue model introduced alongside `due_date` in the Owner Payments module. */
async function fetchOwnerPaymentsDueCount(range: DateRange): Promise<number> {
  const { count, error } = await supabase
    .from('owner_payments')
    .select('id', { count: 'exact', head: true })
    .is('deleted_at', null)
    .eq('status', 'pending')
    .gte('due_date', toDateOnlyString(range.start))
    .lte('due_date', toDateOnlyString(range.end));
  if (error) throw error;
  return count ?? 0;
}

async function fetchCleaningTasksDueCount(range: DateRange): Promise<number> {
  const { count, error } = await supabase
    .from('cleaning_tasks')
    .select('id', { count: 'exact', head: true })
    .is('deleted_at', null)
    .in('status', ['unassigned', 'scheduled', 'in_progress'])
    .gte('scheduled_date', toDateOnlyString(range.start))
    .lte('scheduled_date', toDateOnlyString(range.end));
  if (error) throw error;
  return count ?? 0;
}

const OPEN_MAINTENANCE_STATUSES = new Set(['open', 'assigned', 'in_progress', 'on_hold']);

type MaintenanceMetrics = {
  openCount: number;
  cost: number;
  urgentCount: number;
  inProgressCount: number;
  completedCount: number;
  avgResolutionHours: number | null;
};

async function fetchMaintenance(range: DateRange): Promise<MaintenanceMetrics> {
  const { data, error } = await supabase
    .from('maintenance_tickets')
    .select('status, priority, actual_cost, estimated_cost, created_at, resolved_at')
    .is('deleted_at', null)
    .gte('created_at', range.start.toISOString())
    .lte('created_at', range.end.toISOString());
  if (error) throw error;
  const rows = data ?? [];

  const resolvedInRange = rows.filter((r) => r.resolved_at && (r.status === 'resolved' || r.status === 'closed'));
  const totalResolutionHours = resolvedInRange.reduce(
    (sum, r) => sum + (new Date(r.resolved_at as string).getTime() - new Date(r.created_at).getTime()) / 3_600_000,
    0
  );

  return {
    openCount: rows.filter((r) => OPEN_MAINTENANCE_STATUSES.has(r.status)).length,
    // Excludes cancelled tickets from cost, matching report_portfolio_summary's `maintenance` CTE.
    cost: rows.filter((r) => r.status !== 'cancelled').reduce((sum, r) => sum + (r.actual_cost ?? r.estimated_cost ?? 0), 0),
    urgentCount: rows.filter((r) => r.priority === 'urgent' && OPEN_MAINTENANCE_STATUSES.has(r.status)).length,
    inProgressCount: rows.filter((r) => r.status === 'in_progress').length,
    completedCount: rows.filter((r) => r.status === 'resolved' || r.status === 'closed').length,
    avgResolutionHours: resolvedInRange.length > 0 ? totalResolutionHours / resolvedInRange.length : null,
  };
}

/** Active contracts with a real end_date expiring within 30 days — same bucket the Operations
 * Center's Contracts panel labels "expire sous 30 jours", just as a plain head-count here since
 * the Home dashboard only ever needs the number, not the list. */
async function fetchContractsExpiringCount(): Promise<number> {
  const today = new Date();
  const in30Days = new Date(today);
  in30Days.setDate(in30Days.getDate() + 30);
  const { count, error } = await supabase
    .from('contracts')
    .select('id', { count: 'exact', head: true })
    .is('deleted_at', null)
    .eq('status', 'active')
    .not('end_date', 'is', null)
    .gte('end_date', toDateOnlyString(today))
    .lte('end_date', toDateOnlyString(in30Days));
  if (error) throw error;
  return count ?? 0;
}

export async function getDashboardMetrics(range: DateRange): Promise<DashboardMetrics> {
  const [
    reservationsInRange,
    checkOuts,
    occupancy,
    activeProperties,
    expenses,
    cleaningCost,
    ownerPaymentsDueCount,
    cleaningTasksDueCount,
    maintenance,
    paymentsOverview,
    contractsExpiringCount,
    revenueData,
  ] = await Promise.all([
    fetchReservationsInRange(range),
    fetchCheckOutsCount(range),
    fetchOccupancyRaw(range),
    fetchActivePropertiesCount(),
    fetchExpensesTotal(range),
    fetchCleaningCostTotal(range),
    fetchOwnerPaymentsDueCount(range),
    fetchCleaningTasksDueCount(range),
    fetchMaintenance(range),
    getPaymentsOverview(toDateOnlyString(range.start), toDateOnlyString(range.end)),
    fetchContractsExpiringCount(),
    fetchRevenueInRange(range),
  ]);

  const revenueAccommodation = revenueData.revenue;
  const totalNights = revenueData.nights;
  const concierge = await fetchConciergeMetrics(revenueData.reservationIds);
  const revenueConcierge = concierge.revenue;
  const revenueTotal = revenueAccommodation + revenueConcierge;
  // Financial Truth Remediation, Phase 4: refunds (already computed by get_payments_overview,
  // same overlap window) now flow into Profit — Revenue itself stays gross (see refundsTotal,
  // shown separately) so the Home tab's "Revenus" tile still reads as gross bookings.
  const netRevenueTotal = revenueTotal - paymentsOverview.totalRefunded;

  return {
    revenueAccommodation,
    revenueConcierge,
    revenueTotal,
    expenses,
    // Marge brute (Financial Truth Remediation, Phase 5 — this used to be labeled "Profit" with
    // no indication it's gross margin before the owner's settlement payout): net-of-refunds
    // revenue + concierge - expenses - cleaning - maintenance, matching report_portfolio_summary.
    profit: netRevenueTotal - expenses - cleaningCost - maintenance.cost,
    reservationsCount: reservationsInRange.length,
    checkIns: reservationsInRange.length,
    checkOuts,
    occupancyRate: computeOccupancyRate(occupancy.occupiedNights, range, activeProperties),
    occupiedPropertiesCount: occupancy.occupiedPropertiesCount,
    availablePropertiesCount: Math.max(0, activeProperties - occupancy.occupiedPropertiesCount),
    averageDailyRate: totalNights > 0 ? revenueAccommodation / totalNights : 0,
    ownerPaymentsDueCount,
    cleaningTasksDueCount,
    maintenanceOpenCount: maintenance.openCount,
    maintenanceCost: maintenance.cost,
    maintenanceUrgentCount: maintenance.urgentCount,
    maintenanceInProgressCount: maintenance.inProgressCount,
    maintenanceCompletedCount: maintenance.completedCount,
    maintenanceAvgResolutionHours: maintenance.avgResolutionHours,
    conciergeCost: concierge.cost,
    conciergeProfit: concierge.profit,
    conciergeServicesSold: concierge.servicesSold,
    conciergeServicesPending: concierge.servicesPending,
    conciergeServicesCompleted: concierge.servicesCompleted,
    conciergeTopService: concierge.topService,
    conciergeTopProvider: concierge.topProvider,
    cashReceived: paymentsOverview.totalCollected,
    outstandingBalances: paymentsOverview.totalOutstanding,
    pendingDeposits: paymentsOverview.depositsMissingCount,
    refundsTotal: paymentsOverview.totalRefunded,
    collectionRate: paymentsOverview.collectionRate,
    avgCollectionDelayDays: paymentsOverview.avgCollectionDelayDays,
    contractsExpiringCount,
  };
}

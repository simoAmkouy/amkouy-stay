import { getTopServicesAndProvidersInRange, TopEntry } from '@/lib/queries/concierge-reports';
import { ContractWithRelations, computeContractHealth, computeDaysRemaining, listContracts } from '@/lib/queries/contracts';
import { supabase } from '@/lib/supabase';
import { logAppError } from '@/utils/errors';
import { DateRange, toDateOnlyString } from '@/utils/date-range';

// ============================================================================
// All heavy aggregation happens in Postgres (report_owner_statement /
// report_portfolio_summary / report_property_performance RPCs, Phase 13) —
// this file only shapes the single summary row each RPC returns and combines
// it with the handful of pure client-side compute functions that already
// exist (contract health, top concierge service/provider ranking). Nothing
// here re-derives a formula that's computed somewhere else.
// ============================================================================

export type OwnerStatement = {
  reservationsCount: number;
  occupiedNights: number;
  occupancyRate: number;
  revenue: number;
  /** Financial Truth Remediation, Phase 4: refunds issued against this owner's reservations in
   * the period, already netted out of `netRevenue`/`ownerShare` — shown separately so a refund's
   * impact is visible, not just silently absorbed. */
  refunds: number;
  conciergeRevenue: number;
  expenses: number;
  cleaningCosts: number;
  maintenanceCosts: number;
  netRevenue: number;
  commissionPct: number;
  ownerShare: number;
  amkouyShare: number;
  ownerPaymentsTotal: number;
  pendingPaymentsTotal: number;
  contractStatus: string;
};

export async function getOwnerStatement(ownerId: string, range: DateRange): Promise<OwnerStatement> {
  const { data, error } = await supabase.rpc('report_owner_statement', {
    p_owner_id: ownerId,
    p_start: toDateOnlyString(range.start),
    p_end: toDateOnlyString(range.end),
  });
  if (error) {
    logAppError('reports.getOwnerStatement', error);
    throw error;
  }
  const row = data?.[0];
  return {
    reservationsCount: row?.reservations_count ?? 0,
    occupiedNights: row?.occupied_nights ?? 0,
    occupancyRate: Number(row?.occupancy_rate ?? 0),
    revenue: Number(row?.revenue ?? 0),
    refunds: Number(row?.refunds ?? 0),
    conciergeRevenue: Number(row?.concierge_revenue ?? 0),
    expenses: Number(row?.expenses ?? 0),
    cleaningCosts: Number(row?.cleaning_costs ?? 0),
    maintenanceCosts: Number(row?.maintenance_costs ?? 0),
    netRevenue: Number(row?.net_revenue ?? 0),
    commissionPct: Number(row?.commission_pct ?? 0),
    ownerShare: Number(row?.owner_share ?? 0),
    amkouyShare: Number(row?.amkouy_share ?? 0),
    ownerPaymentsTotal: Number(row?.owner_payments_total ?? 0),
    pendingPaymentsTotal: Number(row?.pending_payments_total ?? 0),
    contractStatus: row?.contract_status ?? 'none',
  };
}

export type OwnerStatementTimelinePoint = {
  month: string;
  revenue: number;
  conciergeRevenue: number;
  reservationsCount: number;
};

export async function getOwnerStatementTimeline(ownerId: string, range: DateRange): Promise<OwnerStatementTimelinePoint[]> {
  const { data, error } = await supabase.rpc('report_owner_statement_timeline', {
    p_owner_id: ownerId,
    p_start: toDateOnlyString(range.start),
    p_end: toDateOnlyString(range.end),
  });
  if (error) {
    logAppError('reports.getOwnerStatementTimeline', error);
    throw error;
  }
  return (data ?? []).map((row) => ({
    month: row.month as string,
    revenue: Number(row.revenue ?? 0),
    conciergeRevenue: Number(row.concierge_revenue ?? 0),
    reservationsCount: row.reservations_count ?? 0,
  }));
}

export type PortfolioSummary = {
  totalRevenue: number;
  /** Financial Truth Remediation, Phase 4: refunds already netted out of totalNetRevenue/totalProfit. */
  totalRefunds: number;
  totalNetRevenue: number;
  totalConciergeRevenue: number;
  totalExpenses: number;
  totalCleaningCosts: number;
  totalMaintenanceCosts: number;
  totalProfit: number;
  totalReservations: number;
  cancelledReservations: number;
  totalNights: number;
  activeProperties: number;
  occupancyRate: number;
  avgStay: number;
  adr: number;
  totalOwnerPayments: number;
};

export async function getPortfolioSummary(range: DateRange): Promise<PortfolioSummary> {
  const { data, error } = await supabase.rpc('report_portfolio_summary', {
    p_start: toDateOnlyString(range.start),
    p_end: toDateOnlyString(range.end),
  });
  if (error) {
    logAppError('reports.getPortfolioSummary', error);
    throw error;
  }
  const row = data?.[0];
  return {
    totalRevenue: Number(row?.total_revenue ?? 0),
    totalRefunds: Number(row?.total_refunds ?? 0),
    totalNetRevenue: Number(row?.total_net_revenue ?? 0),
    totalConciergeRevenue: Number(row?.total_concierge_revenue ?? 0),
    totalExpenses: Number(row?.total_expenses ?? 0),
    totalCleaningCosts: Number(row?.total_cleaning_costs ?? 0),
    totalMaintenanceCosts: Number(row?.total_maintenance_costs ?? 0),
    totalProfit: Number(row?.total_profit ?? 0),
    totalReservations: row?.total_reservations ?? 0,
    cancelledReservations: row?.cancelled_reservations ?? 0,
    totalNights: row?.total_nights ?? 0,
    activeProperties: row?.active_properties ?? 0,
    occupancyRate: Number(row?.occupancy_rate ?? 0),
    avgStay: Number(row?.avg_stay ?? 0),
    adr: Number(row?.adr ?? 0),
    totalOwnerPayments: Number(row?.total_owner_payments ?? 0),
  };
}

export type PropertyPerformance = {
  propertyId: string;
  propertyName: string;
  city: string;
  revenue: number;
  refunds: number;
  netRevenue: number;
  profit: number;
  occupancyRate: number;
  adr: number;
  avgStay: number;
  reservationsCount: number;
  cancelledCount: number;
  conciergeRevenue: number;
  cleaningCosts: number;
  maintenanceCosts: number;
  ownerPaymentsTotal: number;
  contractStatus: string;
};

export async function getPropertyPerformance(range: DateRange): Promise<PropertyPerformance[]> {
  const { data, error } = await supabase.rpc('report_property_performance', {
    p_start: toDateOnlyString(range.start),
    p_end: toDateOnlyString(range.end),
  });
  if (error) {
    logAppError('reports.getPropertyPerformance', error);
    throw error;
  }
  return (data ?? []).map((row) => ({
    propertyId: row.property_id,
    propertyName: row.property_name,
    city: row.city,
    revenue: Number(row.revenue ?? 0),
    refunds: Number(row.refunds ?? 0),
    netRevenue: Number(row.net_revenue ?? 0),
    profit: Number(row.profit ?? 0),
    occupancyRate: Number(row.occupancy_rate ?? 0),
    adr: Number(row.adr ?? 0),
    avgStay: Number(row.avg_stay ?? 0),
    reservationsCount: row.reservations_count ?? 0,
    cancelledCount: row.cancelled_count ?? 0,
    conciergeRevenue: Number(row.concierge_revenue ?? 0),
    cleaningCosts: Number(row.cleaning_costs ?? 0),
    maintenanceCosts: Number(row.maintenance_costs ?? 0),
    ownerPaymentsTotal: Number(row.owner_payments_total ?? 0),
    contractStatus: row.contract_status,
  }));
}

export type PortfolioTimelinePoint = {
  month: string;
  revenue: number;
  refunds: number;
  conciergeRevenue: number;
  profit: number;
  reservationsCount: number;
  nights: number;
  cleaningTasksCount: number;
  maintenanceTicketsCount: number;
  ownerPaymentsTotal: number;
};

/** Phase 9 (Executive Dashboard Reporting) — every "Evolution" chart reads from this one
 * monthly-bucketed RPC rather than each chart running its own query. */
export async function getPortfolioTimeline(range: DateRange): Promise<PortfolioTimelinePoint[]> {
  const { data, error } = await supabase.rpc('report_portfolio_timeline', {
    p_start: toDateOnlyString(range.start),
    p_end: toDateOnlyString(range.end),
  });
  if (error) {
    logAppError('reports.getPortfolioTimeline', error);
    throw error;
  }
  return (data ?? []).map((row) => ({
    month: row.month as string,
    revenue: Number(row.revenue ?? 0),
    refunds: Number(row.refunds ?? 0),
    conciergeRevenue: Number(row.concierge_revenue ?? 0),
    profit: Number(row.profit ?? 0),
    reservationsCount: row.reservations_count ?? 0,
    nights: row.nights ?? 0,
    cleaningTasksCount: row.cleaning_tasks_count ?? 0,
    maintenanceTicketsCount: row.maintenance_tickets_count ?? 0,
    ownerPaymentsTotal: Number(row.owner_payments_total ?? 0),
  }));
}

// ============================================================================
// PORTFOLIO REPORT (Phase 6) — combines the two RPCs above with the previous
// period's property performance (for "fastest growing") and the existing
// concierge top-service/provider ranking. No formula is reimplemented here.
// ============================================================================

export type PortfolioReport = {
  summary: PortfolioSummary;
  properties: PropertyPerformance[];
  bestByRevenue: PropertyPerformance | null;
  worstByRevenue: PropertyPerformance | null;
  fastestGrowing: { property: PropertyPerformance; growthPct: number } | null;
  topServices: TopEntry[];
  topProviders: TopEntry[];
};

export async function getPortfolioReport(range: DateRange, previousRange: DateRange | null): Promise<PortfolioReport> {
  const [summary, properties, concierge, previousProperties] = await Promise.all([
    getPortfolioSummary(range),
    getPropertyPerformance(range),
    getTopServicesAndProvidersInRange(toDateOnlyString(range.start), toDateOnlyString(range.end)),
    previousRange ? getPropertyPerformance(previousRange) : Promise.resolve<PropertyPerformance[]>([]),
  ]);

  const ranked = [...properties].sort((a, b) => b.revenue - a.revenue);
  const bestByRevenue = ranked[0] ?? null;
  const worstByRevenue = ranked.length > 0 ? ranked[ranked.length - 1] : null;

  let fastestGrowing: PortfolioReport['fastestGrowing'] = null;
  if (previousProperties.length > 0) {
    const previousByProperty = new Map(previousProperties.map((p) => [p.propertyId, p.revenue]));
    let best: { property: PropertyPerformance; growthPct: number } | null = null;
    for (const property of properties) {
      const previousRevenue = previousByProperty.get(property.propertyId) ?? 0;
      if (previousRevenue <= 0) continue;
      const growthPct = ((property.revenue - previousRevenue) / previousRevenue) * 100;
      if (!best || growthPct > best.growthPct) best = { property, growthPct };
    }
    fastestGrowing = best;
  }

  return {
    summary,
    properties: ranked,
    bestByRevenue,
    worstByRevenue,
    fastestGrowing,
    topServices: concierge.topServices,
    topProviders: concierge.topProviders,
  };
}

// ============================================================================
// CONTRACT REPORTING (Phase 11) — reuses the exact `computeContractHealth`/
// `computeDaysRemaining` functions from Module 7, never recomputed here.
// ============================================================================

export type ContractReportingSummary = {
  active: ContractWithRelations[];
  expiringWithin90: ContractWithRelations[];
  expiringWithin30: ContractWithRelations[];
  expired: ContractWithRelations[];
  renewalPipeline: ContractWithRelations[];
  contractRevenueImpact: number;
};

export async function getContractReportingSummary(properties: PropertyPerformance[]): Promise<ContractReportingSummary> {
  const contracts = await listContracts();
  const today = new Date();
  const active = contracts.filter((c) => c.status === 'active');
  const expiringWithin90: ContractWithRelations[] = [];
  const expiringWithin30: ContractWithRelations[] = [];
  const expired: ContractWithRelations[] = [];
  const renewalPipeline: ContractWithRelations[] = [];

  for (const contract of active) {
    const health = computeContractHealth(contract, today);
    const days = computeDaysRemaining(contract.end_date, today);
    if (health === 'expired') expired.push(contract);
    else if (health === 'urgent') expiringWithin30.push(contract);
    else if (health === 'expiring_soon') expiringWithin90.push(contract);
    if (contract.auto_renew && days !== null && days <= 90 && days >= 0) renewalPipeline.push(contract);
  }

  // Contract Revenue Impact: the commission Amkouy earns from properties currently under an
  // active contract, for the same range the property performance rows already cover — reuses
  // `revenue`/`profit` already computed by `report_property_performance`, just weighted by each
  // property's own contract commission_pct instead of recomputing revenue.
  const propertyById = new Map(properties.map((p) => [p.propertyId, p]));
  let contractRevenueImpact = 0;
  for (const contract of active) {
    const property = propertyById.get(contract.property_id);
    if (property) contractRevenueImpact += property.revenue * (contract.commission_pct / 100);
  }

  return { active, expiringWithin90, expiringWithin30, expired, renewalPipeline, contractRevenueImpact };
}

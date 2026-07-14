import { supabase } from '@/lib/supabase';
import { logAppError } from '@/utils/errors';

export type ConciergeSummary = {
  revenue: number;
  cost: number;
  profit: number;
  servicesSold: number;
  servicesPending: number;
  servicesCompleted: number;
};

const PENDING_STATUSES = new Set(['offered', 'accepted', 'scheduled', 'in_progress']);

type ReportRow = {
  total_price: number | null;
  cost_amount: number | null;
  profit: number | null;
  status: string;
  service_id: string | null;
  provider_id: string | null;
  service: { id: string; name: string } | null;
  provider: { id: string; name: string } | null;
};

async function fetchAllRows(): Promise<ReportRow[]> {
  const { data, error } = await supabase
    .from('reservation_services')
    .select('total_price, cost_amount, profit, status, service_id, provider_id, service:services(id, name), provider:service_providers(id, name)')
    .is('deleted_at', null)
    .neq('status', 'cancelled')
    .neq('status', 'refunded');
  if (error) {
    logAppError('concierge-reports.fetchAllRows', error);
    throw error;
  }
  return (data ?? []) as unknown as ReportRow[];
}

/** Revenue/cost/profit are read straight from the stored columns (profit is a generated
 * column) — never recomputed here, so reports can't drift from what's actually stored. */
export async function getConciergeSummary(): Promise<ConciergeSummary> {
  const rows = await fetchAllRows();
  const revenue = rows.reduce((sum, r) => sum + (r.total_price ?? 0), 0);
  const cost = rows.reduce((sum, r) => sum + (r.cost_amount ?? 0), 0);
  const profit = rows.reduce((sum, r) => sum + (r.profit ?? 0), 0);
  return {
    revenue,
    cost,
    profit,
    servicesSold: rows.length,
    servicesPending: rows.filter((r) => PENDING_STATUSES.has(r.status)).length,
    servicesCompleted: rows.filter((r) => r.status === 'delivered').length,
  };
}

export type TopEntry = { id: string; name: string; revenue: number; profit: number; count: number };

function topBy(rows: ReportRow[], key: 'service_id' | 'provider_id', relation: 'service' | 'provider'): TopEntry[] {
  const byId = new Map<string, TopEntry>();
  for (const row of rows) {
    const id = row[key];
    if (!id) continue;
    const name = row[relation]?.name ?? '—';
    const existing = byId.get(id);
    const revenue = row.total_price ?? 0;
    const profit = row.profit ?? 0;
    if (existing) {
      existing.revenue += revenue;
      existing.profit += profit;
      existing.count += 1;
    } else {
      byId.set(id, { id, name, revenue, profit, count: 1 });
    }
  }
  return Array.from(byId.values()).sort((a, b) => b.profit - a.profit);
}

export async function getTopServicesAndProviders(): Promise<{ topServices: TopEntry[]; topProviders: TopEntry[] }> {
  const rows = await fetchAllRows();
  return {
    topServices: topBy(rows, 'service_id', 'service').slice(0, 5),
    topProviders: topBy(rows, 'provider_id', 'provider').slice(0, 5),
  };
}

/** Module 8 (Portfolio Report, Phase 6) — same ranking logic as `getTopServicesAndProviders`
 * (reused via `topBy`, not reimplemented), but date-filtered by the reservation's check-in date
 * instead of fetching the whole table unbounded. */
async function fetchRowsInRange(startIso: string, endIso: string): Promise<ReportRow[]> {
  const { data, error } = await supabase
    .from('reservation_services')
    .select(
      'total_price, cost_amount, profit, status, service_id, provider_id, service:services(id, name), provider:service_providers(id, name), reservation:reservations!inner(check_in_date)'
    )
    .is('deleted_at', null)
    .neq('status', 'cancelled')
    .neq('status', 'refunded')
    .gte('reservation.check_in_date', startIso)
    .lte('reservation.check_in_date', endIso);
  if (error) {
    logAppError('concierge-reports.fetchRowsInRange', error);
    throw error;
  }
  return (data ?? []) as unknown as ReportRow[];
}

export async function getTopServicesAndProvidersInRange(
  startIso: string,
  endIso: string
): Promise<{ topServices: TopEntry[]; topProviders: TopEntry[] }> {
  const rows = await fetchRowsInRange(startIso, endIso);
  return {
    topServices: topBy(rows, 'service_id', 'service').slice(0, 5),
    topProviders: topBy(rows, 'provider_id', 'provider').slice(0, 5),
  };
}

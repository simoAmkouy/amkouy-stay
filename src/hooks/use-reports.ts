import { useQuery } from '@tanstack/react-query';

import * as reportsApi from '@/lib/queries/reports';
import { DateRange, toDateOnlyString } from '@/utils/date-range';

const KEY = ['reports'] as const;

export function useOwnerStatement(ownerId: string | undefined, range: DateRange) {
  return useQuery({
    queryKey: [...KEY, 'owner-statement', ownerId, toDateOnlyString(range.start), toDateOnlyString(range.end)],
    queryFn: () => reportsApi.getOwnerStatement(ownerId as string, range),
    enabled: !!ownerId,
  });
}

export function useOwnerStatementTimeline(ownerId: string | undefined, range: DateRange) {
  return useQuery({
    queryKey: [...KEY, 'owner-statement-timeline', ownerId, toDateOnlyString(range.start), toDateOnlyString(range.end)],
    queryFn: () => reportsApi.getOwnerStatementTimeline(ownerId as string, range),
    enabled: !!ownerId,
  });
}

export function usePortfolioSummary(range: DateRange) {
  return useQuery({
    queryKey: [...KEY, 'portfolio-summary', toDateOnlyString(range.start), toDateOnlyString(range.end)],
    queryFn: () => reportsApi.getPortfolioSummary(range),
  });
}

export function usePortfolioReport(range: DateRange, previousRange: DateRange | null) {
  return useQuery({
    queryKey: [
      ...KEY,
      'portfolio',
      toDateOnlyString(range.start),
      toDateOnlyString(range.end),
      previousRange ? toDateOnlyString(previousRange.start) : null,
    ],
    queryFn: () => reportsApi.getPortfolioReport(range, previousRange),
  });
}

export function usePortfolioTimeline(range: DateRange) {
  return useQuery({
    queryKey: [...KEY, 'portfolio-timeline', toDateOnlyString(range.start), toDateOnlyString(range.end)],
    queryFn: () => reportsApi.getPortfolioTimeline(range),
  });
}

export function useContractReportingSummary(properties: reportsApi.PropertyPerformance[] | undefined) {
  // Bug fix (found during Module 8 live verification): keying on `properties.length` alone meant
  // switching date ranges never invalidated this query when the property count stayed the same
  // (e.g. always 1 property) but its revenue changed — `contractRevenueImpact` kept computing
  // against a stale cached property list. Key on each property's id+revenue instead, so any
  // change to the underlying numbers (not just the row count) busts the cache.
  const contentKey = (properties ?? []).map((p) => `${p.propertyId}:${p.revenue}`).join(',');
  return useQuery({
    queryKey: [...KEY, 'contract-reporting', contentKey],
    queryFn: () => reportsApi.getContractReportingSummary(properties ?? []),
    enabled: !!properties,
  });
}

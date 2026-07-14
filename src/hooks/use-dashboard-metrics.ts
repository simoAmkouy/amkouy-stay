import { useQuery } from '@tanstack/react-query';

import { listRecentActivity } from '@/lib/queries/activity-log';
import { getDashboardMetrics } from '@/lib/queries/dashboard-metrics';
import { DateRange, toDateOnlyString } from '@/utils/date-range';

function rangeKey(range: DateRange) {
  return [toDateOnlyString(range.start), toDateOnlyString(range.end)] as const;
}

export function useDashboardMetrics(range: DateRange) {
  return useQuery({
    queryKey: ['dashboard-metrics', ...rangeKey(range)],
    queryFn: () => getDashboardMetrics(range),
  });
}

export function useRecentActivity(range: DateRange, limit = 8) {
  return useQuery({
    queryKey: ['activity-log', 'recent', ...rangeKey(range), limit],
    queryFn: () => listRecentActivity(range, limit),
  });
}

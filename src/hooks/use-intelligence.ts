// Intelligence-layer hooks — read-only wrappers over Core queries and the intelligence query layer.
// NO mutations. Uses existing React Query cache infrastructure.

import { useQuery } from '@tanstack/react-query';

import { getPropertyReservationHistory } from '@/lib/queries/intelligence';
import { getPropertyPerformance } from '@/lib/queries/reports';
import { DateRange } from '@/utils/date-range';

const KEY = ['intelligence'] as const;

/** All-time reservation history for a property, used for pricing/lead-time/pattern analytics. */
export function usePropertyReservationHistory(propertyId: string | undefined) {
  return useQuery({
    queryKey: [...KEY, 'history', propertyId],
    queryFn: () => getPropertyReservationHistory(propertyId as string),
    enabled: !!propertyId,
    staleTime: 5 * 60 * 1000,
  });
}

/** Per-property performance from the Core RPC, client-filtered by propertyId. */
export function usePropertyPerformanceReport(propertyId: string | undefined, range: DateRange) {
  return useQuery({
    queryKey: [...KEY, 'perf', propertyId, range.start.toISOString(), range.end.toISOString()],
    queryFn: async () => {
      const all = await getPropertyPerformance(range);
      return all.find((p) => p.propertyId === propertyId) ?? null;
    },
    enabled: !!propertyId,
    staleTime: 5 * 60 * 1000,
  });
}

import { useQuery } from '@tanstack/react-query';

import { fetchOperationsCenterRaw } from '@/lib/queries/operations-center';

/** One consolidated fetch backing every panel in the Executive Operations Center — refetches
 * on the same interval as the rest of the app's React Query defaults, no polling added here. */
export function useOperationsCenterRaw() {
  return useQuery({ queryKey: ['operations-center', 'raw'], queryFn: fetchOperationsCenterRaw });
}

import { useQuery } from '@tanstack/react-query';

import * as reportsApi from '@/lib/queries/concierge-reports';

export function useConciergeSummary() {
  return useQuery({ queryKey: ['concierge-reports', 'summary'], queryFn: reportsApi.getConciergeSummary });
}

export function useTopServicesAndProviders() {
  return useQuery({ queryKey: ['concierge-reports', 'top'], queryFn: reportsApi.getTopServicesAndProviders });
}

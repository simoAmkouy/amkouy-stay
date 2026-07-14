import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import * as commissionsApi from '@/lib/queries/commercial-commissions';

const KEY = ['commercial-commissions'] as const;

export function useCommissions() {
  return useQuery({ queryKey: KEY, queryFn: commissionsApi.listCommissions });
}

export function useCreateCommission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: commissionsApi.CommissionInput) => commissionsApi.createCommission(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateCommissionStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: commissionsApi.CommissionStatus }) => commissionsApi.updateCommissionStatus(id, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}

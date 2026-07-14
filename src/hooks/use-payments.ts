import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import * as paymentsApi from '@/lib/queries/payments';

const KEY = ['payments'] as const;

export function usePayments(reservationId: string | undefined) {
  return useQuery({
    queryKey: [...KEY, 'reservation', reservationId],
    queryFn: () => paymentsApi.listPayments(reservationId as string),
    enabled: !!reservationId,
  });
}

export function useReservationPaymentSummary(reservationId: string | undefined) {
  return useQuery({
    queryKey: [...KEY, 'summary', reservationId],
    queryFn: () => paymentsApi.getReservationPaymentSummary(reservationId as string),
    enabled: !!reservationId,
  });
}

function invalidateReservationPayments(queryClient: ReturnType<typeof useQueryClient>, reservationId: string) {
  queryClient.invalidateQueries({ queryKey: [...KEY, 'reservation', reservationId] });
  queryClient.invalidateQueries({ queryKey: [...KEY, 'summary', reservationId] });
  queryClient.invalidateQueries({ queryKey: [...KEY, 'overview'] });
  queryClient.invalidateQueries({ queryKey: [...KEY, 'outstanding'] });
  queryClient.invalidateQueries({ queryKey: [...KEY, 'ledger'] });
}

export function useCreatePayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: paymentsApi.PaymentCreateInput) => paymentsApi.createPayment(input),
    onSuccess: (_data, variables) => invalidateReservationPayments(queryClient, variables.reservationId),
  });
}

export function useUpdatePayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Parameters<typeof paymentsApi.updatePayment>[1] }) =>
      paymentsApi.updatePayment(id, input),
    onSuccess: (data) => invalidateReservationPayments(queryClient, data.reservation_id),
  });
}

export function useRefundPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: Parameters<typeof paymentsApi.refundPayment>[0]) => paymentsApi.refundPayment(params),
    onSuccess: (_data, variables) => invalidateReservationPayments(queryClient, variables.reservationId),
  });
}

export function usePaymentsOverview(startIso: string, endIso: string, largeThreshold?: number) {
  return useQuery({
    queryKey: [...KEY, 'overview', startIso, endIso, largeThreshold],
    queryFn: () => paymentsApi.getPaymentsOverview(startIso, endIso, largeThreshold),
  });
}

export function useOutstandingBalances(startIso: string, endIso: string) {
  return useQuery({
    queryKey: [...KEY, 'outstanding', startIso, endIso],
    queryFn: () => paymentsApi.getOutstandingBalances(startIso, endIso),
  });
}

export function useLedgerEntries(params: { startIso?: string; endIso?: string; propertyId?: string; entityType?: string; limit?: number }) {
  return useQuery({
    queryKey: [...KEY, 'ledger', params],
    queryFn: () => paymentsApi.getLedgerEntries(params),
  });
}

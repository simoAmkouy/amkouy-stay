import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import * as ownerPaymentsApi from '@/lib/queries/owner-payments';

const KEY = ['owner-payments'] as const;

export function useOwnerPayments() {
  return useQuery({ queryKey: KEY, queryFn: ownerPaymentsApi.listOwnerPayments });
}

export function useOwnerPayment(id: string | undefined) {
  return useQuery({
    queryKey: [...KEY, id],
    queryFn: () => ownerPaymentsApi.getOwnerPayment(id as string),
    enabled: !!id,
  });
}

export function useCreateOwnerPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ownerPaymentsApi.OwnerPaymentCreateInput) => ownerPaymentsApi.createOwnerPayment(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}

/** Financial Truth Remediation, Phase 2: not a query cached by property/period — always a fresh
 * on-demand computation, called from the create form as the user picks a property/period. */
export function usePreviewOwnerSettlement() {
  return useMutation({
    mutationFn: ({ propertyId, periodStart, periodEnd }: { propertyId: string; periodStart: string; periodEnd: string }) =>
      ownerPaymentsApi.previewOwnerSettlement(propertyId, periodStart, periodEnd),
  });
}

export function useUpdateOwnerPaymentMetadata() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ownerPaymentsApi.OwnerPaymentMetadataInput }) =>
      ownerPaymentsApi.updateOwnerPaymentMetadata(id, input),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: KEY });
      queryClient.invalidateQueries({ queryKey: [...KEY, variables.id] });
      queryClient.invalidateQueries({ queryKey: ['activity-log', 'owner_payment', variables.id] });
    },
  });
}

export function useMarkOwnerPaymentAsPaid() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: { paidAt: string; paymentMethod: ownerPaymentsApi.PayoutMethod; paymentReference?: string };
    }) => ownerPaymentsApi.markOwnerPaymentAsPaid(id, input),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: KEY });
      queryClient.invalidateQueries({ queryKey: [...KEY, variables.id] });
    },
  });
}

export function useApproveOwnerPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => ownerPaymentsApi.approveOwnerPayment(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: KEY });
      queryClient.invalidateQueries({ queryKey: [...KEY, id] });
    },
  });
}

export function useGenerateOwnerSettlements() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ periodStart, periodEnd, dueDate }: { periodStart: string; periodEnd: string; dueDate?: string }) =>
      ownerPaymentsApi.generateOwnerSettlements(periodStart, periodEnd, dueDate),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}

export function useCancelOwnerPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => ownerPaymentsApi.cancelOwnerPayment(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: KEY });
      queryClient.invalidateQueries({ queryKey: [...KEY, id] });
    },
  });
}

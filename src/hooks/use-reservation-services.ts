import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import * as reservationServicesApi from '@/lib/queries/reservation-services';

const KEY = ['reservation-services'] as const;
const ACTIVITY_KEY = ['activity-log', 'reservation'] as const;

export function useReservationServices(reservationId: string | undefined) {
  return useQuery({
    queryKey: [...KEY, reservationId],
    queryFn: () => reservationServicesApi.listReservationServices(reservationId as string),
    enabled: !!reservationId,
  });
}

/** Cross-reservation feed for the Operations screen — active (non-terminal) requests only. */
export function useActiveReservationServices() {
  return useQuery({ queryKey: [...KEY, 'active-all'], queryFn: reservationServicesApi.listActiveReservationServices });
}

function invalidateReservationServices(
  queryClient: ReturnType<typeof useQueryClient>,
  reservationId: string
) {
  queryClient.invalidateQueries({ queryKey: [...KEY, reservationId] });
  queryClient.invalidateQueries({ queryKey: [...ACTIVITY_KEY, reservationId] });
}

export function useCreateReservationService(reservationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: reservationServicesApi.ReservationServiceFormInput) =>
      reservationServicesApi.createReservationService(reservationId, input),
    onSuccess: () => invalidateReservationServices(queryClient, reservationId),
  });
}

export function useUpdateReservationService(reservationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: reservationServicesApi.ReservationServiceFormInput;
    }) => reservationServicesApi.updateReservationService(id, reservationId, input),
    onSuccess: () => invalidateReservationServices(queryClient, reservationId),
  });
}

export function useConfirmReservationService(reservationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => reservationServicesApi.confirmReservationService(id, reservationId),
    onSuccess: () => invalidateReservationServices(queryClient, reservationId),
  });
}

export function useStartReservationService(reservationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => reservationServicesApi.startReservationService(id, reservationId),
    onSuccess: () => invalidateReservationServices(queryClient, reservationId),
  });
}

export function useRefundReservationService(reservationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => reservationServicesApi.refundReservationService(id, reservationId),
    onSuccess: () => invalidateReservationServices(queryClient, reservationId),
  });
}

export function useAssignServiceProvider(reservationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, providerId }: { id: string; providerId: string }) =>
      reservationServicesApi.assignProvider(id, reservationId, providerId),
    onSuccess: () => invalidateReservationServices(queryClient, reservationId),
  });
}

export function useScheduleReservationService(reservationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: { scheduledDate: string; scheduledTime?: string | null };
    }) => reservationServicesApi.scheduleReservationService(id, reservationId, input),
    onSuccess: () => invalidateReservationServices(queryClient, reservationId),
  });
}

export function useCompleteReservationService(reservationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => reservationServicesApi.completeReservationService(id, reservationId),
    onSuccess: () => invalidateReservationServices(queryClient, reservationId),
  });
}

export function useCancelReservationService(reservationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => reservationServicesApi.cancelReservationService(id, reservationId),
    onSuccess: () => invalidateReservationServices(queryClient, reservationId),
  });
}

export function useDeleteReservationService(reservationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, requestNumber }: { id: string; requestNumber: string }) =>
      reservationServicesApi.softDeleteReservationService(id, reservationId, requestNumber),
    onSuccess: () => invalidateReservationServices(queryClient, reservationId),
  });
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import * as reservationsApi from '@/lib/queries/reservations';

const KEY = ['reservations'] as const;
const CHANNELS_KEY = ['channels'] as const;

export function useReservations(filters: reservationsApi.ReservationListFilters = {}) {
  const { statuses, dateRange } = filters;
  return useQuery({
    queryKey: [...KEY, 'list', statuses ?? [], dateRange ?? null],
    queryFn: () => reservationsApi.listReservations(filters),
  });
}

export function useReservation(id: string | undefined) {
  return useQuery({
    queryKey: [...KEY, id],
    queryFn: () => reservationsApi.getReservation(id as string),
    enabled: !!id,
  });
}

export function useUpcomingReservations(limit?: number) {
  return useQuery({
    queryKey: [...KEY, 'upcoming', limit ?? 5],
    queryFn: () => reservationsApi.listUpcomingReservations(limit),
  });
}

export function useUpcomingCheckouts(limit?: number) {
  return useQuery({
    queryKey: [...KEY, 'upcoming-checkouts', limit ?? 5],
    queryFn: () => reservationsApi.listUpcomingCheckouts(limit),
  });
}

export function useChannels() {
  return useQuery({ queryKey: CHANNELS_KEY, queryFn: reservationsApi.listChannels });
}

export function useCreateReservation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: reservationsApi.ReservationFormInput) =>
      reservationsApi.createReservation(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateReservation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: reservationsApi.ReservationFormInput }) =>
      reservationsApi.updateReservation(id, input),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: KEY });
      queryClient.invalidateQueries({ queryKey: [...KEY, variables.id] });
      // updateReservation also logs a 'reservation.updated' activity entry — refresh the Timeline too.
      queryClient.invalidateQueries({ queryKey: ['activity-log', 'reservation', variables.id] });
    },
  });
}

export function useDeleteReservation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => reservationsApi.softDeleteReservation(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}

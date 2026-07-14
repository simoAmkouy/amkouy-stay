import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import * as leadsApi from '@/lib/queries/reservation-leads';

const KEY = ['reservation-leads'] as const;

export function useReservationLeads() {
  return useQuery({ queryKey: KEY, queryFn: leadsApi.listReservationLeads });
}

export function useReservationLead(id: string | undefined) {
  return useQuery({
    queryKey: [...KEY, id],
    queryFn: () => leadsApi.getReservationLead(id as string),
    enabled: !!id,
  });
}

function invalidateLead(queryClient: ReturnType<typeof useQueryClient>, id: string) {
  queryClient.invalidateQueries({ queryKey: KEY });
  queryClient.invalidateQueries({ queryKey: [...KEY, id] });
}

export function useCreateReservationLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: leadsApi.ReservationLeadInput) => leadsApi.createReservationLead(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateReservationLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<leadsApi.ReservationLeadInput> }) => leadsApi.updateReservationLead(id, input),
    onSuccess: (_data, variables) => invalidateLead(queryClient, variables.id),
  });
}

export function useUpdateReservationLeadStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: leadsApi.ReservationLeadStatus }) => leadsApi.updateReservationLeadStatus(id, status),
    onSuccess: (_data, variables) => invalidateLead(queryClient, variables.id),
  });
}

export function useCreateReservationAsAgent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: leadsApi.CreateReservationAsAgentInput) => leadsApi.createReservationAsAgent(input),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: KEY });
      if (variables.reservationLeadId) invalidateLead(queryClient, variables.reservationLeadId);
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
    },
  });
}

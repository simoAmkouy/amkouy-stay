import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import * as leadsApi from '@/lib/queries/commercial-leads';

const KEY = ['commercial-leads'] as const;

export function useCommercialLeads(filters: leadsApi.CommercialLeadListFilters = {}) {
  const { statuses } = filters;
  return useQuery({
    queryKey: [...KEY, 'list', statuses ?? []],
    queryFn: () => leadsApi.listCommercialLeads(filters),
  });
}

export function useCommercialLead(id: string | undefined) {
  return useQuery({
    queryKey: [...KEY, id],
    queryFn: () => leadsApi.getCommercialLead(id as string),
    enabled: !!id,
  });
}

function invalidateLead(queryClient: ReturnType<typeof useQueryClient>, id: string) {
  queryClient.invalidateQueries({ queryKey: KEY });
  queryClient.invalidateQueries({ queryKey: [...KEY, id] });
}

export function useCreateCommercialLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: leadsApi.CommercialLeadInput) => leadsApi.createCommercialLead(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateCommercialLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<leadsApi.CommercialLeadInput> }) => leadsApi.updateCommercialLead(id, input),
    onSuccess: (_data, variables) => invalidateLead(queryClient, variables.id),
  });
}

export function useUpdateLeadStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: leadsApi.LeadStatus }) => leadsApi.updateLeadStatus(id, status),
    onSuccess: (_data, variables) => invalidateLead(queryClient, variables.id),
  });
}

export function useReassignCommercialLeadAgent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, newAgentId }: { id: string; newAgentId: string }) => leadsApi.reassignCommercialLeadAgent(id, newAgentId),
    onSuccess: (_data, variables) => invalidateLead(queryClient, variables.id),
  });
}

export function useConvertLeadToOwner() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (leadId: string) => leadsApi.convertLeadToOwner(leadId),
    onSuccess: (_data, leadId) => {
      invalidateLead(queryClient, leadId);
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      queryClient.invalidateQueries({ queryKey: ['owners'] });
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
    },
  });
}

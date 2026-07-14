import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import * as documentsApi from '@/lib/queries/documents';
import * as maintenanceApi from '@/lib/queries/maintenance-tickets';
import * as usersApi from '@/lib/queries/users';

const KEY = ['maintenance-tickets'] as const;

export function useMaintenanceTickets(filters: maintenanceApi.MaintenanceTicketListFilters = {}) {
  const { statuses, propertyId } = filters;
  return useQuery({
    queryKey: [...KEY, 'list', statuses ?? [], propertyId ?? null],
    queryFn: () => maintenanceApi.listMaintenanceTickets(filters),
  });
}

export function useMaintenanceTicket(id: string | undefined) {
  return useQuery({
    queryKey: [...KEY, id],
    queryFn: () => maintenanceApi.getMaintenanceTicket(id as string),
    enabled: !!id,
  });
}

export function useTechnicians() {
  return useQuery({ queryKey: ['users', 'technician'], queryFn: () => usersApi.listUsersByRole('technician') });
}

export function usePropertiesUnderMaintenance() {
  return useQuery({ queryKey: [...KEY, 'under-maintenance'], queryFn: maintenanceApi.listPropertiesUnderMaintenance });
}

function invalidateTicket(queryClient: ReturnType<typeof useQueryClient>, id: string) {
  queryClient.invalidateQueries({ queryKey: KEY });
  queryClient.invalidateQueries({ queryKey: [...KEY, id] });
}

export function useCreateMaintenanceTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: maintenanceApi.MaintenanceTicketCreateInput) => maintenanceApi.createMaintenanceTicket(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}

export function useAssignTechnician() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, userId }: { id: string; userId: string }) => maintenanceApi.assignTechnician(id, userId),
    onSuccess: (_data, variables) => invalidateTicket(queryClient, variables.id),
  });
}

export function useStartWork() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => maintenanceApi.startWork(id),
    onSuccess: (_data, id) => invalidateTicket(queryClient, id),
  });
}

export function useHoldForParts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) => maintenanceApi.holdForParts(id, notes),
    onSuccess: (_data, variables) => invalidateTicket(queryClient, variables.id),
  });
}

export function useCompleteTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: { actualCost: number | null; notes?: string } }) =>
      maintenanceApi.completeTicket(id, input),
    onSuccess: (_data, variables) => invalidateTicket(queryClient, variables.id),
  });
}

export function useVerifyTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => maintenanceApi.verifyTicket(id),
    onSuccess: (_data, id) => invalidateTicket(queryClient, id),
  });
}

export function useCancelTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => maintenanceApi.cancelTicket(id),
    onSuccess: (_data, id) => invalidateTicket(queryClient, id),
  });
}

export function useMaintenanceTicketPhotos(maintenanceTicketId: string | undefined) {
  return useQuery({
    queryKey: ['documents', 'maintenance-ticket', maintenanceTicketId],
    queryFn: () => documentsApi.listDocumentsForMaintenanceTicket(maintenanceTicketId as string),
    enabled: !!maintenanceTicketId,
  });
}

export function useUploadMaintenancePhoto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: Parameters<typeof documentsApi.uploadMaintenancePhoto>[0]) =>
      documentsApi.uploadMaintenancePhoto(params),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['documents', 'maintenance-ticket', variables.maintenanceTicketId] });
    },
  });
}

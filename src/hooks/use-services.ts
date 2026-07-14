import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import * as servicesApi from '@/lib/queries/services';

const KEY = ['services'] as const;

export function useServices() {
  return useQuery({ queryKey: KEY, queryFn: servicesApi.listServices });
}

export function useActiveServices() {
  return useQuery({ queryKey: [...KEY, 'active'], queryFn: servicesApi.listActiveServices });
}

export function useService(id: string | undefined) {
  return useQuery({
    queryKey: [...KEY, id],
    queryFn: () => servicesApi.getService(id as string),
    enabled: !!id,
  });
}

export function useCreateService() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: servicesApi.ServiceFormInput) => servicesApi.createService(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateService() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: servicesApi.ServiceFormInput }) =>
      servicesApi.updateService(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}

export function useArchiveService() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => servicesApi.archiveService(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}

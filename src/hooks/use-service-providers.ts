import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import * as providersApi from '@/lib/queries/service-providers';

const KEY = ['service-providers'] as const;

export function useServiceProviders() {
  return useQuery({ queryKey: KEY, queryFn: providersApi.listServiceProviders });
}

export function useServiceProvider(id: string | undefined) {
  return useQuery({
    queryKey: [...KEY, id],
    queryFn: () => providersApi.getServiceProvider(id as string),
    enabled: !!id,
  });
}

export function useProviderKpis(id: string | undefined) {
  return useQuery({
    queryKey: [...KEY, id, 'kpis'],
    queryFn: () => providersApi.getProviderKpis(id as string),
    enabled: !!id,
  });
}

export function useCreateServiceProvider() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: providersApi.ServiceProviderFormInput) => providersApi.createServiceProvider(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateServiceProvider() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: providersApi.ServiceProviderFormInput }) =>
      providersApi.updateServiceProvider(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}

export function useArchiveServiceProvider() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => providersApi.archiveServiceProvider(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}

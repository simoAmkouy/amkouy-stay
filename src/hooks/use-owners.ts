import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import * as ownersApi from '@/lib/queries/owners';

const KEY = ['owners'] as const;

export function useOwners() {
  return useQuery({ queryKey: KEY, queryFn: ownersApi.listOwners });
}

export function useOwner(id: string | undefined) {
  return useQuery({
    queryKey: [...KEY, id],
    queryFn: () => ownersApi.getOwner(id as string),
    enabled: !!id,
  });
}

export function useMyOwnerId(userId: string | undefined) {
  return useQuery({
    queryKey: [...KEY, 'mine', userId],
    queryFn: () => ownersApi.getMyOwnerId(userId as string),
    enabled: !!userId,
  });
}

export function useOwnerAggregates() {
  return useQuery({ queryKey: [...KEY, 'aggregates'], queryFn: ownersApi.listOwnerAggregates });
}

export function useOwnerProperties(ownerId: string | undefined) {
  return useQuery({
    queryKey: [...KEY, ownerId, 'properties'],
    queryFn: () => ownersApi.listOwnerProperties(ownerId as string),
    enabled: !!ownerId,
  });
}

export function useCreateOwner() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ownersApi.OwnerInsert) => ownersApi.createOwner(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateOwner() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ownersApi.OwnerUpdate }) =>
      ownersApi.updateOwner(id, input),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: KEY });
      queryClient.invalidateQueries({ queryKey: [...KEY, variables.id] });
    },
  });
}

export function useDeleteOwner() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => ownersApi.softDeleteOwner(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}

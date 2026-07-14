import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import * as propertiesApi from '@/lib/queries/properties';

const KEY = ['properties'] as const;

export function useProperties(filters: propertiesApi.PropertyListFilters = {}) {
  const { statuses } = filters;
  return useQuery({
    queryKey: [...KEY, 'list', statuses ?? []],
    queryFn: () => propertiesApi.listProperties(filters),
  });
}

export function usePropertyAggregates() {
  return useQuery({ queryKey: [...KEY, 'aggregates'], queryFn: propertiesApi.listPropertyAggregates });
}

export function useProperty(id: string | undefined) {
  return useQuery({
    queryKey: [...KEY, id],
    queryFn: () => propertiesApi.getProperty(id as string),
    enabled: !!id,
  });
}

export function useCreateProperty() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      input,
      ownerId,
    }: {
      input: propertiesApi.PropertyInsert;
      ownerId: string | null;
    }) => propertiesApi.createProperty(input, ownerId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateProperty() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      input,
      ownerId,
    }: {
      id: string;
      input: propertiesApi.PropertyUpdate;
      ownerId: string | null;
    }) => propertiesApi.updateProperty(id, input, ownerId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: KEY });
      queryClient.invalidateQueries({ queryKey: [...KEY, variables.id] });
    },
  });
}

export function useDeleteProperty() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => propertiesApi.softDeleteProperty(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}

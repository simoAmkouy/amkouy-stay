import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import * as archivedItemsApi from '@/lib/queries/archived-items';

const KEY = ['archived-items'] as const;

export function useArchivedItems() {
  return useQuery({ queryKey: KEY, queryFn: archivedItemsApi.listArchivedItems });
}

export function useRestoreItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ entityType, entityId }: { entityType: archivedItemsApi.ArchivedEntityType; entityId: string }) =>
      archivedItemsApi.restoreItem(entityType, entityId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}

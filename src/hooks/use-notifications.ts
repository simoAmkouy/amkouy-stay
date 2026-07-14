import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import * as notificationsApi from '@/lib/queries/notifications';

const KEY = ['notifications'] as const;

export function useNotifications() {
  return useQuery({ queryKey: KEY, queryFn: notificationsApi.listNotifications });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notificationsApi.markNotificationRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}

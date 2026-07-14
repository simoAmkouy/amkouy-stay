import { useQuery } from '@tanstack/react-query';

import { listActivity } from '@/lib/queries/activity-log';

export function useActivityLog(entityType: string, entityId: string | undefined) {
  return useQuery({
    queryKey: ['activity-log', entityType, entityId],
    queryFn: () => listActivity(entityType, entityId as string),
    enabled: !!entityId,
  });
}

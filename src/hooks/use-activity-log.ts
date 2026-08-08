import { useQuery } from '@tanstack/react-query';

import { listActivity } from '@/lib/queries/activity-log';
import { listReservationAuditTrail, ReservationAuditFilters } from '@/lib/queries/reservation-audit';

export function useActivityLog(entityType: string, entityId: string | undefined) {
  return useQuery({
    queryKey: ['activity-log', entityType, entityId],
    queryFn: () => listActivity(entityType, entityId as string),
    enabled: !!entityId,
  });
}

export function useReservationAuditTrail(filters: ReservationAuditFilters) {
  return useQuery({
    queryKey: [
      'reservation-audit',
      filters.currentUserRole,
      filters.currentUserId,
      filters.dateStart ?? null,
      filters.dateEnd ?? null,
    ],
    queryFn: () => listReservationAuditTrail(filters),
  });
}

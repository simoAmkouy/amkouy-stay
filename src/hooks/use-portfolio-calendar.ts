import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { useProperties } from '@/hooks/use-properties';
import {
  buildPortfolioCalendarData,
  listCalendarCleaningTasks,
  listCalendarMaintenanceTickets,
  listCalendarReservations,
  type PortfolioCalendarData,
} from '@/lib/queries/portfolio-calendar';

// Shared query keys — same key for reservations lets portfolio and apartment calendar
// share the underlying cache when navigating between screens.
const calResKey = (y: number, m: number) => ['calendar-reservations', y, m] as const;
const calCleanKey = (y: number, m: number) => ['calendar-cleaning', y, m] as const;
const calMaintKey = (y: number, m: number) => ['calendar-maintenance', y, m] as const;

// ---------------------------------------------------------------------------
// Portfolio calendar hook — all properties for the given month
// ---------------------------------------------------------------------------

export function usePortfolioCalendar(year: number, month: number) {
  const propertiesQuery = useProperties({ statuses: ['active', 'onboarding', 'maintenance'] });

  const reservationsQuery = useQuery({
    queryKey: calResKey(year, month),
    queryFn: () => listCalendarReservations(year, month),
    staleTime: 2 * 60 * 1000, // 2 min
  });

  const cleaningQuery = useQuery({
    queryKey: calCleanKey(year, month),
    queryFn: () => listCalendarCleaningTasks(year, month),
    staleTime: 2 * 60 * 1000,
  });

  const maintenanceQuery = useQuery({
    queryKey: calMaintKey(year, month),
    queryFn: () => listCalendarMaintenanceTickets(year, month),
    staleTime: 2 * 60 * 1000,
  });

  const data = useMemo<PortfolioCalendarData | null>(() => {
    if (!propertiesQuery.data || !reservationsQuery.data) return null;
    return buildPortfolioCalendarData(
      propertiesQuery.data,
      reservationsQuery.data,
      cleaningQuery.data ?? [],
      maintenanceQuery.data ?? [],
      year,
      month
    );
  }, [
    propertiesQuery.data,
    reservationsQuery.data,
    cleaningQuery.data,
    maintenanceQuery.data,
    year,
    month,
  ]);

  return {
    data,
    isLoading: propertiesQuery.isLoading || reservationsQuery.isLoading,
    error: propertiesQuery.error ?? reservationsQuery.error ?? null,
    refetch: () => {
      propertiesQuery.refetch();
      reservationsQuery.refetch();
      cleaningQuery.refetch();
      maintenanceQuery.refetch();
    },
  };
}

// ---------------------------------------------------------------------------
// Apartment calendar hook — single property for the given month
// ---------------------------------------------------------------------------

export function useApartmentCalendar(
  propertyId: string | undefined,
  year: number,
  month: number
) {
  const propertiesQuery = useProperties();

  const reservationsQuery = useQuery({
    queryKey: calResKey(year, month),
    queryFn: () => listCalendarReservations(year, month),
    staleTime: 2 * 60 * 1000,
  });

  const cleaningQuery = useQuery({
    queryKey: calCleanKey(year, month),
    queryFn: () => listCalendarCleaningTasks(year, month),
    staleTime: 2 * 60 * 1000,
  });

  const maintenanceQuery = useQuery({
    queryKey: calMaintKey(year, month),
    queryFn: () => listCalendarMaintenanceTickets(year, month),
    staleTime: 2 * 60 * 1000,
  });

  const property = useMemo(
    () => propertiesQuery.data?.find((p) => p.id === propertyId) ?? null,
    [propertiesQuery.data, propertyId]
  );

  const data = useMemo<PortfolioCalendarData | null>(() => {
    if (!property || !reservationsQuery.data) return null;
    return buildPortfolioCalendarData(
      [property],
      reservationsQuery.data,
      cleaningQuery.data ?? [],
      maintenanceQuery.data ?? [],
      year,
      month
    );
  }, [property, reservationsQuery.data, cleaningQuery.data, maintenanceQuery.data, year, month]);

  return {
    data,
    property,
    isLoading: propertiesQuery.isLoading || reservationsQuery.isLoading,
    error: propertiesQuery.error ?? reservationsQuery.error ?? null,
    refetch: () => {
      propertiesQuery.refetch();
      reservationsQuery.refetch();
      cleaningQuery.refetch();
      maintenanceQuery.refetch();
    },
  };
}

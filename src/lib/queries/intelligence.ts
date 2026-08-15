// Intelligence-layer read-only queries.
// These analytical queries supplement Core RPCs — they never write and never replace Core data.
// Existing Supabase RLS (reservations_select policy) applies to every query here.

import { supabase } from '@/lib/supabase';
import { logAppError } from '@/utils/errors';

export type PropertyReservationRecord = {
  id: string;
  checkInDate: string;
  checkOutDate: string;
  computedNights: number;   // nights column when set, else derived from date diff
  nightlyRate: number;
  status: string;
  createdAt: string;        // booking timestamp — used for lead-time computation
  cancelledAt: string | null;
  adults: number;
  children: number;
  channelName: string | null;
  channelCode: string | null;
};

export async function getPropertyReservationHistory(propertyId: string): Promise<PropertyReservationRecord[]> {
  const { data, error } = await supabase
    .from('reservations')
    .select('id, check_in_date, check_out_date, nights, nightly_rate, status, created_at, cancelled_at, adults, children, channel:channels(name, code)')
    .eq('property_id', propertyId)
    .is('deleted_at', null)
    .order('check_in_date', { ascending: false });

  if (error) {
    logAppError('intelligence.getPropertyReservationHistory', error);
    throw error;
  }

  return (data ?? []).map((row) => {
    const checkIn = new Date((row as any).check_in_date + 'T12:00:00');
    const checkOut = new Date((row as any).check_out_date + 'T12:00:00');
    const daysDiff = Math.max(1, Math.round((checkOut.getTime() - checkIn.getTime()) / 86_400_000));
    return {
      id: (row as any).id as string,
      checkInDate: (row as any).check_in_date as string,
      checkOutDate: (row as any).check_out_date as string,
      computedNights: ((row as any).nights ?? daysDiff) as number,
      nightlyRate: Number((row as any).nightly_rate ?? 0),
      status: (row as any).status as string,
      createdAt: (row as any).created_at as string,
      cancelledAt: ((row as any).cancelled_at ?? null) as string | null,
      adults: ((row as any).adults ?? 0) as number,
      children: ((row as any).children ?? 0) as number,
      channelName: ((row as any).channel as any)?.name ?? null,
      channelCode: ((row as any).channel as any)?.code ?? null,
    };
  });
}

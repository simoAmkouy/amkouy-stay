import { useQueries } from '@tanstack/react-query';
import { StyleSheet, Text, View } from 'react-native';

import { AccessGuard } from '@/components/amkouy/access-guard';
import { Card } from '@/components/amkouy/card';
import { EmptyState } from '@/components/amkouy/empty-state';
import { ErrorState } from '@/components/amkouy/error-state';
import { LoadingState } from '@/components/amkouy/loading-state';
import { Screen } from '@/components/amkouy/screen';
import { ScreenHeader } from '@/components/amkouy/screen-header';
import { AmkouyColors } from '@/constants/amkouy-theme';
import { robotoText } from '@/constants/typography';
import { useReservations } from '@/hooks/use-reservations';
import { computePaymentStatus, getReservationPaymentSummary } from '@/lib/queries/payments';
import { formatMAD } from '@/utils/format';

/** Phase 7 color rules, mapped onto the read-time payment status engine already built in
 * Module 9 (`computePaymentStatus`) rather than a second, calendar-specific status calculation. */
const COLOR: Record<string, string> = {
  paid: AmkouyColors.success,
  partially_paid: '#B45309',
  deposit_paid: '#B45309',
  unpaid: AmkouyColors.error,
  overdue: AmkouyColors.error,
  refunded: AmkouyColors.textFainter,
};

export default function CommercialCalendarScreen() {
  return (
    <AccessGuard resource="commercial_dashboard">
      <CommercialCalendarContent />
    </AccessGuard>
  );
}

function CommercialCalendarContent() {
  // RLS already restricts reservations_select to this agent's own commercial_agent_id — no
  // extra filter needed here, same pattern as the Owner Portal's "no extra filter" comments.
  const { data: reservations, isLoading, isError, refetch } = useReservations();

  const summaries = useQueries({
    queries: (reservations ?? []).map((r) => ({
      queryKey: ['payments', 'summary', r.id],
      queryFn: () => getReservationPaymentSummary(r.id),
      enabled: !!reservations,
    })),
  });

  if (isLoading) return <LoadingState label="Chargement de votre calendrier…" />;
  if (isError) return <ErrorState message="Impossible de charger vos réservations." onRetry={refetch} />;
  if ((reservations ?? []).length === 0) return <EmptyState icon="calendar_month" message="Aucune réservation vous appartient pour le moment." />;

  return (
    <Screen>
      <ScreenHeader title="Mon calendrier" subtitle={`${reservations?.length ?? 0} réservations`} showBack fallbackHref="/more/commercial" />
      <View style={styles.list}>
        {reservations?.map((r, index) => {
          const summary = summaries[index]?.data;
          const status = r.status === 'cancelled' || r.status === 'no_show' ? 'refunded' : summary ? computePaymentStatus(summary, r.check_in_date) : null;
          const color = status ? COLOR[status] : AmkouyColors.textFaint;
          return (
            <Card key={r.id} style={styles.row}>
              <View style={[styles.dot, { backgroundColor: color }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.guest}>{r.guest?.full_name ?? '—'}</Text>
                <Text style={styles.sub}>
                  {r.property?.name ?? '—'} · {r.check_in_date} → {r.check_out_date}
                </Text>
              </View>
              <Text style={styles.amount}>{formatMAD(r.total_amount)}</Text>
            </Card>
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 22, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  guest: { ...robotoText(600, 13, { color: AmkouyColors.text }) },
  sub: { ...robotoText(400, 11, { color: AmkouyColors.textFaint, marginTop: 2 }) },
  amount: { ...robotoText(700, 13, { color: AmkouyColors.primary }) },
});

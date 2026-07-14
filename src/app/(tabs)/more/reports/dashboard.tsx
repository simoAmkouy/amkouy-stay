import { StyleSheet, Text, View } from 'react-native';

import { AccessGuard } from '@/components/amkouy/access-guard';
import { BarChart } from '@/components/amkouy/bar-chart';
import { Card } from '@/components/amkouy/card';
import { DateFilterBar } from '@/components/amkouy/date-filter-bar';
import { ErrorState } from '@/components/amkouy/error-state';
import { LoadingState } from '@/components/amkouy/loading-state';
import { Screen } from '@/components/amkouy/screen';
import { ScreenHeader } from '@/components/amkouy/screen-header';
import { AmkouyColors } from '@/constants/amkouy-theme';
import { robotoText } from '@/constants/typography';
import { DateFilterProvider, useDateFilter } from '@/hooks/use-date-filter';
import { useContractReportingSummary, usePortfolioReport, usePortfolioTimeline } from '@/hooks/use-reports';
import { PortfolioTimelinePoint } from '@/lib/queries/reports';
import { REPORT_QUICK_FILTERS, formatRangeLabel } from '@/utils/date-range';
import { formatMAD } from '@/utils/format';

export default function ReportingDashboardScreen() {
  return (
    <AccessGuard resource="reports">
      <DateFilterProvider initialFilter="this_year">
        <ReportingDashboardContent />
      </DateFilterProvider>
    </AccessGuard>
  );
}

function monthLabel(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { month: 'short' });
}

function seriesToBars(points: PortfolioTimelinePoint[], key: keyof PortfolioTimelinePoint, color: string) {
  const values = points.map((p) => Number(p[key]));
  const max = Math.max(1, ...values);
  return points.map((p) => ({
    m: monthLabel(p.month),
    h: `${Math.max(4, Math.round((Number(p[key]) / max) * 100))}%`,
    color,
  }));
}

function EvolutionChart({ title, points, dataKey, color, formatTotal }: {
  title: string;
  points: PortfolioTimelinePoint[];
  dataKey: keyof PortfolioTimelinePoint;
  color: string;
  formatTotal?: (value: number) => string;
}) {
  const total = points.reduce((sum, p) => sum + Number(p[dataKey]), 0);
  return (
    <>
      <View style={styles.chartHeader}>
        <Text style={styles.chartTitle}>{title}</Text>
        <Text style={styles.chartTotal}>{formatTotal ? formatTotal(total) : total}</Text>
      </View>
      <Card style={styles.chartCard}>
        <BarChart data={seriesToBars(points, dataKey, color)} />
      </Card>
    </>
  );
}

function ReportingDashboardContent() {
  const { range } = useDateFilter();
  const { data: timeline, isLoading, isError, refetch } = usePortfolioTimeline(range);
  const { data: portfolio } = usePortfolioReport(range, null);
  const { data: contractSummary } = useContractReportingSummary(portfolio?.properties);

  if (isLoading || !timeline) return <LoadingState label="Calcul des courbes…" />;
  if (isError) return <ErrorState message="Impossible de charger le tableau de bord." onRetry={refetch} />;

  return (
    <Screen>
      <ScreenHeader title="Tableau de bord reporting" subtitle={formatRangeLabel(range)} showBack fallbackHref="/more/reports" />
      <DateFilterBar filters={REPORT_QUICK_FILTERS} />

      <View style={styles.content}>
        <EvolutionChart title="Évolution du revenu" points={timeline} dataKey="revenue" color={AmkouyColors.primaryContainer} formatTotal={formatMAD} />
        <EvolutionChart title="Évolution des remboursements" points={timeline} dataKey="refunds" color={AmkouyColors.error} formatTotal={formatMAD} />
        <EvolutionChart title="Évolution de la marge brute" points={timeline} dataKey="profit" color={AmkouyColors.success} formatTotal={formatMAD} />
        <EvolutionChart title="Évolution des réservations" points={timeline} dataKey="reservationsCount" color="#6D4FC9" />
        <EvolutionChart title="Évolution des nuits occupées" points={timeline} dataKey="nights" color="#0C5C8A" />
        <EvolutionChart title="Évolution des versements propriétaires" points={timeline} dataKey="ownerPaymentsTotal" color="#B45309" formatTotal={formatMAD} />
        <EvolutionChart title="Évolution du revenu concierge" points={timeline} dataKey="conciergeRevenue" color="#8a6d1c" formatTotal={formatMAD} />
        <EvolutionChart title="Évolution du ménage" points={timeline} dataKey="cleaningTasksCount" color={AmkouyColors.primaryContainer} />
        <EvolutionChart title="Évolution de la maintenance" points={timeline} dataKey="maintenanceTicketsCount" color={AmkouyColors.error} />

        {contractSummary && (
          <>
            <Text style={styles.sectionTitle}>Échéancier des contrats</Text>
            <Card style={styles.timelineCard}>
              <TimelineRow label="Actifs" count={contractSummary.active.length} color={AmkouyColors.success} />
              <TimelineRow label="Expire sous 90 jours" count={contractSummary.expiringWithin90.length} color="#B45309" />
              <TimelineRow label="Expire sous 30 jours" count={contractSummary.expiringWithin30.length} color={AmkouyColors.error} />
              <TimelineRow label="Expirés" count={contractSummary.expired.length} color={AmkouyColors.textFainter} />
            </Card>
          </>
        )}
      </View>
    </Screen>
  );
}

function TimelineRow({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <View style={styles.timelineRow}>
      <View style={[styles.timelineDot, { backgroundColor: color }]} />
      <Text style={styles.timelineLabel}>{label}</Text>
      <Text style={[styles.timelineCount, { color }]}>{count}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 22,
    paddingTop: 8,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 8,
  },
  chartTitle: {
    ...robotoText(700, 14, { color: AmkouyColors.primary }),
  },
  chartTotal: {
    ...robotoText(700, 13, { color: AmkouyColors.text }),
  },
  chartCard: {
    padding: 16,
  },
  sectionTitle: {
    ...robotoText(700, 15, { color: AmkouyColors.primary, marginTop: 22, marginBottom: 10 }),
  },
  timelineCard: {
    paddingHorizontal: 16,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: AmkouyColors.hairline,
  },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  timelineLabel: {
    flex: 1,
    ...robotoText(500, 13, { color: AmkouyColors.text }),
  },
  timelineCount: {
    ...robotoText(700, 14),
  },
});

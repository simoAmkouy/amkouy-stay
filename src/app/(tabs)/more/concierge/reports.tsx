import { StyleSheet, Text, View } from 'react-native';

import { AccessGuard } from '@/components/amkouy/access-guard';
import { Card } from '@/components/amkouy/card';
import { EmptyState } from '@/components/amkouy/empty-state';
import { LoadingState } from '@/components/amkouy/loading-state';
import { Screen } from '@/components/amkouy/screen';
import { ScreenHeader } from '@/components/amkouy/screen-header';
import { AmkouyColors } from '@/constants/amkouy-theme';
import { robotoText } from '@/constants/typography';
import { useConciergeSummary, useTopServicesAndProviders } from '@/hooks/use-concierge-reports';
import { TopEntry } from '@/lib/queries/concierge-reports';
import { formatMAD } from '@/utils/format';

export default function ConciergeReportsScreen() {
  return (
    <AccessGuard resource="concierge_reports">
      <ConciergeReportsContent />
    </AccessGuard>
  );
}

function ConciergeReportsContent() {
  const { data: summary, isLoading } = useConciergeSummary();
  const { data: top } = useTopServicesAndProviders();

  return (
    <Screen contentPadding={false}>
      <ScreenHeader title="Rapports concierge" subtitle="Revenus, profit et performance — historique complet" showBack fallbackHref="/more" />

      {isLoading && <LoadingState label="Chargement des rapports…" />}

      {!isLoading && summary && (
        <>
          <View style={styles.summaryRow}>
            <View style={[styles.summaryCard, styles.summaryRevenue]}>
              <Text style={styles.summaryLabelDark}>Revenu</Text>
              <Text style={styles.summaryValueDark}>{formatMAD(summary.revenue)}</Text>
            </View>
            <View style={[styles.summaryCard, styles.summaryCost]}>
              <Text style={styles.summaryLabelLight}>Coût</Text>
              <Text style={[styles.summaryValueLight, { color: AmkouyColors.error }]}>{formatMAD(summary.cost)}</Text>
            </View>
            <View style={[styles.summaryCard, styles.summaryProfit]}>
              <Text style={[styles.summaryLabelLight, { color: '#8a6d1c' }]}>Profit</Text>
              <Text style={[styles.summaryValueLight, { color: AmkouyColors.secondary }]}>{formatMAD(summary.profit)}</Text>
            </View>
          </View>

          <View style={styles.countRow}>
            <CountBox label="Vendus" value={summary.servicesSold} />
            <CountBox label="En attente" value={summary.servicesPending} />
            <CountBox label="Terminés" value={summary.servicesCompleted} />
          </View>

          <Text style={styles.sectionTitle}>Services les plus rentables</Text>
          {(top?.topServices.length ?? 0) === 0 ? (
            <EmptyState icon="room_service" message="Aucune donnée pour le moment." />
          ) : (
            <Card style={styles.listCard}>
              {top?.topServices.map((entry, index) => (
                <TopRow key={entry.id} entry={entry} border={index < (top.topServices.length ?? 0) - 1} />
              ))}
            </Card>
          )}

          <Text style={styles.sectionTitle}>Prestataires les plus actifs</Text>
          {(top?.topProviders.length ?? 0) === 0 ? (
            <EmptyState icon="groups" message="Aucune donnée pour le moment." />
          ) : (
            <Card style={styles.listCard}>
              {top?.topProviders.map((entry, index) => (
                <TopRow key={entry.id} entry={entry} border={index < (top.topProviders.length ?? 0) - 1} />
              ))}
            </Card>
          )}
        </>
      )}
    </Screen>
  );
}

function CountBox({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.countBox}>
      <Text style={styles.countValue}>{value}</Text>
      <Text style={styles.countLabel}>{label}</Text>
    </View>
  );
}

function TopRow({ entry, border }: { entry: TopEntry; border: boolean }) {
  return (
    <View style={[styles.topRow, border && styles.topRowBorder]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.topName}>{entry.name}</Text>
        <Text style={styles.topMeta}>
          {entry.count} vente(s) · revenu {formatMAD(entry.revenue)}
        </Text>
      </View>
      <Text style={styles.topProfit}>{formatMAD(entry.profit)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  summaryRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 22,
  },
  summaryCard: {
    flex: 1,
    borderRadius: 15,
    padding: 15,
  },
  summaryRevenue: {
    backgroundColor: AmkouyColors.primary,
  },
  summaryCost: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: AmkouyColors.hairline,
  },
  summaryProfit: {
    backgroundColor: 'rgba(201,168,76,.14)',
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,.3)',
  },
  summaryLabelDark: {
    ...robotoText(400, 11, { color: AmkouyColors.onPrimaryMuted }),
  },
  summaryValueDark: {
    ...robotoText(900, 18, { color: '#fff', marginTop: 5 }),
  },
  summaryLabelLight: {
    ...robotoText(400, 11, { color: AmkouyColors.textFaint }),
  },
  summaryValueLight: {
    ...robotoText(900, 18, { marginTop: 5 }),
  },
  countRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 22,
    paddingTop: 12,
  },
  countBox: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: AmkouyColors.hairline,
    borderRadius: 13,
    padding: 12,
    alignItems: 'center',
  },
  countValue: {
    ...robotoText(900, 18, { color: AmkouyColors.text }),
  },
  countLabel: {
    ...robotoText(500, 10.5, { color: AmkouyColors.textFaint, marginTop: 2 }),
  },
  sectionTitle: {
    ...robotoText(700, 15, { color: AmkouyColors.primary, paddingHorizontal: 22, marginTop: 22, marginBottom: 10 }),
  },
  listCard: {
    marginHorizontal: 22,
    overflow: 'hidden',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 13,
    paddingHorizontal: 15,
  },
  topRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: AmkouyColors.hairline,
  },
  topName: {
    ...robotoText(600, 13, { color: AmkouyColors.text }),
  },
  topMeta: {
    ...robotoText(400, 11, { color: AmkouyColors.textFaint, marginTop: 2 }),
  },
  topProfit: {
    ...robotoText(700, 13, { color: AmkouyColors.primary }),
  },
});

import { StyleSheet, Text, View } from 'react-native';

import { AccessGuard } from '@/components/amkouy/access-guard';
import { Card } from '@/components/amkouy/card';
import { DateFilterBar } from '@/components/amkouy/date-filter-bar';
import { EmptyState } from '@/components/amkouy/empty-state';
import { ErrorState } from '@/components/amkouy/error-state';
import { LoadingState } from '@/components/amkouy/loading-state';
import { Screen } from '@/components/amkouy/screen';
import { ScreenHeader } from '@/components/amkouy/screen-header';
import { AmkouyColors } from '@/constants/amkouy-theme';
import { robotoText } from '@/constants/typography';
import { DateFilterProvider, useDateFilter } from '@/hooks/use-date-filter';
import { useCommercialLeaderboard, useCommercialSourcePerformance } from '@/hooks/use-commercial-kpis';
import { CommercialLeaderboardEntry } from '@/lib/queries/commercial-kpis';
import { REPORT_QUICK_FILTERS, formatRangeLabel, toDateOnlyString } from '@/utils/date-range';
import { formatMAD } from '@/utils/format';

export default function CommercialLeaderboardScreen() {
  return (
    <AccessGuard resource="commercial_management">
      <DateFilterProvider initialFilter="this_month">
        <CommercialLeaderboardContent />
      </DateFilterProvider>
    </AccessGuard>
  );
}

function CommercialLeaderboardContent() {
  const { range } = useDateFilter();
  const startIso = toDateOnlyString(range.start);
  const endIso = toDateOnlyString(range.end);
  const { data: leaderboard, isLoading, isError, refetch } = useCommercialLeaderboard(startIso, endIso);
  const { data: sources } = useCommercialSourcePerformance(startIso, endIso);

  if (isLoading) return <LoadingState label="Calcul du classement…" />;
  if (isError) return <ErrorState message="Impossible de charger le classement." onRetry={refetch} />;

  const ranked = [...(leaderboard ?? [])].sort((a, b) => b.revenueGenerated - a.revenueGenerated);
  const bySourcePerf = [...(sources ?? [])].sort((a, b) => b.ownerLeadsWon + b.guestLeadsConfirmed - (a.ownerLeadsWon + a.guestLeadsConfirmed));

  return (
    <Screen>
      <ScreenHeader title="Classement commercial" subtitle={formatRangeLabel(range)} showBack fallbackHref="/more/commercial" />
      <DateFilterBar filters={REPORT_QUICK_FILTERS} />

      <View style={styles.content}>
        <Text style={styles.sectionTitle}>Agents (par revenu généré)</Text>
        {ranked.length === 0 && <EmptyState icon="leaderboard" message="Aucun agent commercial enregistré." />}
        <View style={styles.list}>
          {ranked.map((agent, index) => (
            <AgentRow key={agent.agentId} rank={index + 1} agent={agent} />
          ))}
        </View>

        {bySourcePerf.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Performance par source</Text>
            <Card style={styles.sourceCard}>
              {bySourcePerf.map((s) => (
                <View key={s.source} style={styles.sourceRow}>
                  <Text style={styles.sourceLabel}>{s.source}</Text>
                  <Text style={styles.sourceValue}>
                    {s.ownerLeadsWon}/{s.ownerLeadsCount} propriétaires · {s.guestLeadsConfirmed}/{s.guestLeadsCount} réservations
                  </Text>
                </View>
              ))}
            </Card>
          </>
        )}
      </View>
    </Screen>
  );
}

function AgentRow({ rank, agent }: { rank: number; agent: CommercialLeaderboardEntry }) {
  return (
    <Card style={styles.agentRow}>
      <Text style={styles.rank}>#{rank}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.agentName}>{agent.agentName}</Text>
        <Text style={styles.agentSub}>
          {agent.propertiesAcquired} biens ({agent.propertiesActivated} activés · {agent.activationRate}%) · {agent.reservationsGenerated} réservations · {agent.conversionRate}% conversion
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={styles.agentRevenue}>{formatMAD(agent.revenueGenerated)}</Text>
        <Text style={styles.agentCommission}>Comm. {formatMAD(agent.commissionsEarned)}</Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { padding: 22, paddingTop: 8 },
  sectionTitle: { ...robotoText(700, 15, { color: AmkouyColors.primary, marginTop: 20, marginBottom: 10 }) },
  list: { gap: 8 },
  agentRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  rank: { ...robotoText(700, 13, { color: AmkouyColors.textFainter, width: 24 }) },
  agentName: { ...robotoText(600, 13, { color: AmkouyColors.text }) },
  agentSub: { ...robotoText(400, 11, { color: AmkouyColors.textFaint, marginTop: 2 }) },
  agentRevenue: { ...robotoText(700, 13, { color: AmkouyColors.primary }) },
  agentCommission: { ...robotoText(400, 10.5, { color: AmkouyColors.textFainter, marginTop: 2 }) },
  sourceCard: { paddingHorizontal: 16 },
  sourceRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: AmkouyColors.hairline },
  sourceLabel: { ...robotoText(600, 13, { color: AmkouyColors.text }) },
  sourceValue: { ...robotoText(400, 11, { color: AmkouyColors.textFaint, marginTop: 2 }) },
});

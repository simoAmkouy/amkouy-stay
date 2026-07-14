import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AccessGuard } from '@/components/amkouy/access-guard';
import { Badge } from '@/components/amkouy/badge';
import { Card } from '@/components/amkouy/card';
import { DateFilterBar } from '@/components/amkouy/date-filter-bar';
import { ErrorState } from '@/components/amkouy/error-state';
import { FilterChipRow } from '@/components/amkouy/filter-chip-row';
import { LoadingState } from '@/components/amkouy/loading-state';
import { Screen } from '@/components/amkouy/screen';
import { ScreenHeader } from '@/components/amkouy/screen-header';
import { AmkouyColors } from '@/constants/amkouy-theme';
import { robotoText } from '@/constants/typography';
import { DateFilterProvider, useDateFilter } from '@/hooks/use-date-filter';
import { usePaymentsOverview } from '@/hooks/use-payments';
import { useCommercialLeaderboard } from '@/hooks/use-commercial-kpis';
import { useActivationFunnelReport } from '@/hooks/use-property-activation';
import { useContractReportingSummary, usePortfolioReport } from '@/hooks/use-reports';
import { PROPERTY_TYPE_OPTIONS } from '@/lib/validation/property';
import { PropertyPerformance } from '@/lib/queries/reports';
import { REPORT_QUICK_FILTERS, formatRangeLabel, toDateOnlyString } from '@/utils/date-range';
import { formatMAD } from '@/utils/format';

type SortKey = 'revenue' | 'profit' | 'occupancyRate';
const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'revenue', label: 'Revenu' },
  { value: 'profit', label: 'Marge brute' },
  { value: 'occupancyRate', label: 'Occupation' },
];

export default function PortfolioReportScreen() {
  return (
    <AccessGuard resource="reports">
      <DateFilterProvider initialFilter="this_month">
        <PortfolioReportContent />
      </DateFilterProvider>
    </AccessGuard>
  );
}

function PortfolioReportContent() {
  const { range, comparisonRange } = useDateFilter();
  const { data, isLoading, isError, refetch } = usePortfolioReport(range, comparisonRange);
  const { data: contractSummary } = useContractReportingSummary(data?.properties);
  // Module 9 (Phase 13): extends Module 8 reporting with guest-payment collection metrics —
  // same RPC already powering the Dashboard/Operations Center, not a new formula.
  const { data: paymentsOverview } = usePaymentsOverview(toDateOnlyString(range.start), toDateOnlyString(range.end));
  // Module 10 (Phase 13): extends Module 8 reporting with commercial performance — same
  // leaderboard RPC already powering the Commercial Leaderboard and Operations Center.
  const { data: commercialLeaderboard } = useCommercialLeaderboard(toDateOnlyString(range.start), toDateOnlyString(range.end));
  // Module 11 (Phase 13): Activation Funnel Report, filterable by the same date range plus an
  // optional commercial agent (reusing the leaderboard's agent list) and property type.
  const [funnelAgentId, setFunnelAgentId] = useState('all');
  const [funnelPropertyType, setFunnelPropertyType] = useState('all');
  const { data: activationFunnel } = useActivationFunnelReport(
    toDateOnlyString(range.start),
    toDateOnlyString(range.end),
    funnelAgentId === 'all' ? undefined : funnelAgentId,
    funnelPropertyType === 'all' ? undefined : funnelPropertyType
  );
  const [sortKey, setSortKey] = useState<SortKey>('revenue');

  if (isLoading || !data) return <LoadingState label="Calcul du portefeuille…" />;
  if (isError) return <ErrorState message="Impossible de charger le rapport de portefeuille." onRetry={refetch} />;

  const sortedProperties = [...data.properties].sort((a, b) => b[sortKey] - a[sortKey]);

  return (
    <Screen>
      <ScreenHeader title="Performance & portefeuille" subtitle={formatRangeLabel(range)} showBack fallbackHref="/more/reports" />
      <DateFilterBar filters={REPORT_QUICK_FILTERS} />

      <View style={styles.content}>
        <Text style={styles.sectionTitle}>Résumé du portefeuille</Text>
        <View style={styles.kpiGrid}>
          <KpiTile label="Revenu total" value={formatMAD(data.summary.totalRevenue)} />
          <KpiTile label="Remboursements" value={formatMAD(data.summary.totalRefunds)} color={AmkouyColors.error} />
          <KpiTile label="Revenu net" value={formatMAD(data.summary.totalNetRevenue)} />
          <KpiTile label="Marge brute totale" value={formatMAD(data.summary.totalProfit)} color={AmkouyColors.success} />
          <KpiTile label="Réservations" value={String(data.summary.totalReservations)} />
          <KpiTile label="Nuits totales" value={String(data.summary.totalNights)} />
          <KpiTile label="Occupation" value={`${data.summary.occupancyRate}%`} />
          <KpiTile label="Séjour moyen" value={`${data.summary.avgStay} nuits`} />
          <KpiTile label="ADR" value={formatMAD(data.summary.adr)} />
          <KpiTile label="Dépenses" value={formatMAD(data.summary.totalExpenses)} color={AmkouyColors.error} />
          <KpiTile label="Versements" value={formatMAD(data.summary.totalOwnerPayments)} />
          <KpiTile label="Revenu concierge" value={formatMAD(data.summary.totalConciergeRevenue)} />
          <KpiTile label="Coûts ménage" value={formatMAD(data.summary.totalCleaningCosts)} />
          <KpiTile label="Coûts maintenance" value={formatMAD(data.summary.totalMaintenanceCosts)} />
        </View>

        <Text style={styles.sectionTitle}>Points clés</Text>
        <View style={styles.calloutRow}>
          <Callout label="Meilleur bien" value={data.bestByRevenue?.propertyName ?? '—'} sub={data.bestByRevenue ? formatMAD(data.bestByRevenue.revenue) : ''} color={AmkouyColors.success} />
          <Callout label="Bien le plus faible" value={data.worstByRevenue?.propertyName ?? '—'} sub={data.worstByRevenue ? formatMAD(data.worstByRevenue.revenue) : ''} color={AmkouyColors.error} />
          <Callout
            label="Croissance la plus rapide"
            value={data.fastestGrowing?.property.propertyName ?? '—'}
            sub={data.fastestGrowing ? `+${data.fastestGrowing.growthPct.toFixed(0)}%` : 'Comparaison indisponible'}
            color={AmkouyColors.primaryContainer}
          />
        </View>

        <Text style={styles.sectionTitle}>Classement des biens</Text>
        <FilterChipRow options={SORT_OPTIONS.map((o) => o.value)} active={sortKey} onChange={setSortKey} getLabel={(v) => SORT_OPTIONS.find((o) => o.value === v)?.label ?? v} />
        <View style={styles.propertyList}>
          {sortedProperties.map((property, index) => (
            <PropertyRow key={property.propertyId} rank={index + 1} property={property} sortKey={sortKey} />
          ))}
        </View>

        {(data.topServices.length > 0 || data.topProviders.length > 0) && (
          <>
            <Text style={styles.sectionTitle}>Top concierge</Text>
            <Card style={styles.sectionCard}>
              {data.topServices.slice(0, 3).map((s) => (
                <Row key={s.id} label={s.name} value={formatMAD(s.revenue)} />
              ))}
              {data.topServices.length === 0 && <Text style={styles.emptyText}>Aucune donnée concierge sur cette période.</Text>}
            </Card>
            {data.topProviders.length > 0 && (
              <Card style={[styles.sectionCard, { marginTop: 10 }]}>
                {data.topProviders.slice(0, 3).map((p) => (
                  <Row key={p.id} label={p.name} value={formatMAD(p.profit)} />
                ))}
              </Card>
            )}
          </>
        )}

        {contractSummary && (
          <>
            <Text style={styles.sectionTitle}>Contrats (Module 7)</Text>
            <View style={styles.kpiGrid}>
              <KpiTile label="Actifs" value={String(contractSummary.active.length)} color={AmkouyColors.success} />
              <KpiTile label="Expire &lt; 90j" value={String(contractSummary.expiringWithin90.length)} color="#B45309" />
              <KpiTile label="Expire &lt; 30j" value={String(contractSummary.expiringWithin30.length)} color={AmkouyColors.error} />
              <KpiTile label="Expirés" value={String(contractSummary.expired.length)} color={AmkouyColors.error} />
              <KpiTile label="Pipeline renouvellement" value={String(contractSummary.renewalPipeline.length)} />
              <KpiTile label="Impact revenu contrats" value={formatMAD(contractSummary.contractRevenueImpact)} />
            </View>
          </>
        )}

        {paymentsOverview && (
          <>
            <Text style={styles.sectionTitle}>Paiements clients (Module 9)</Text>
            <View style={styles.kpiGrid}>
              <KpiTile label="Encaissé" value={formatMAD(paymentsOverview.totalCollected)} color={AmkouyColors.success} />
              <KpiTile label="Reste dû" value={formatMAD(paymentsOverview.totalOutstanding)} color="#B45309" />
              <KpiTile label="Remboursé" value={formatMAD(paymentsOverview.totalRefunded)} color={AmkouyColors.error} />
              <KpiTile label="Taux d'encaissement" value={`${paymentsOverview.collectionRate}%`} />
              <KpiTile label="Acomptes encaissés" value={formatMAD(paymentsOverview.totalDepositsCollected)} />
              <KpiTile
                label="Délai moyen"
                value={paymentsOverview.avgCollectionDelayDays != null ? `${paymentsOverview.avgCollectionDelayDays}j` : '—'}
              />
            </View>
          </>
        )}

        {commercialLeaderboard && commercialLeaderboard.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Performance commerciale (Module 10)</Text>
            <View style={styles.kpiGrid}>
              <KpiTile label="Agents actifs" value={String(commercialLeaderboard.length)} />
              <KpiTile label="Biens acquis" value={String(commercialLeaderboard.reduce((s, a) => s + a.propertiesAcquired, 0))} color={AmkouyColors.success} />
              <KpiTile label="Réservations générées" value={String(commercialLeaderboard.reduce((s, a) => s + a.reservationsGenerated, 0))} />
              <KpiTile label="Revenu attribué" value={formatMAD(commercialLeaderboard.reduce((s, a) => s + a.revenueGenerated, 0))} color={AmkouyColors.primaryContainer} />
              <KpiTile label="Commissions" value={formatMAD(commercialLeaderboard.reduce((s, a) => s + a.commissionsEarned, 0))} color="#B45309" />
              <KpiTile
                label="Meilleur agent"
                value={[...commercialLeaderboard].sort((a, b) => b.revenueGenerated - a.revenueGenerated)[0]?.agentName ?? '—'}
              />
            </View>
          </>
        )}

        <Text style={styles.sectionTitle}>Entonnoir d&apos;activation (Module 11)</Text>
        <FilterChipRow
          options={['all', ...(commercialLeaderboard ?? []).map((a) => a.agentId)]}
          active={funnelAgentId}
          onChange={setFunnelAgentId}
          getLabel={(v) => (v === 'all' ? 'Tous les agents' : (commercialLeaderboard ?? []).find((a) => a.agentId === v)?.agentName ?? v)}
        />
        <FilterChipRow
          options={['all', ...PROPERTY_TYPE_OPTIONS.map((o) => o.value)]}
          active={funnelPropertyType}
          onChange={setFunnelPropertyType}
          getLabel={(v) => (v === 'all' ? 'Tous les types' : PROPERTY_TYPE_OPTIONS.find((o) => o.value === v)?.label ?? v)}
        />
        {activationFunnel && (
          <View style={[styles.kpiGrid, { marginTop: 10 }]}>
            <KpiTile label="Biens acquis" value={String(activationFunnel.propertiesAcquired)} />
            <KpiTile label="Biens activés" value={String(activationFunnel.propertiesActivated)} color={AmkouyColors.success} />
            <KpiTile label="Taux d'activation" value={`${activationFunnel.activationRate}%`} color={AmkouyColors.primaryContainer} />
            <KpiTile label="Délai moyen d'activation" value={activationFunnel.avgActivationDays != null ? `${activationFunnel.avgActivationDays}j` : '—'} />
            <KpiTile label="Délai jusqu'à 1ère résa" value={activationFunnel.avgDaysToFirstBooking != null ? `${activationFunnel.avgDaysToFirstBooking}j` : '—'} />
          </View>
        )}
      </View>
    </Screen>
  );
}

function KpiTile({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.kpiTile}>
      <Text style={[styles.kpiValue, color ? { color } : null]}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

function Callout({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <Card style={styles.calloutCard}>
      <Text style={styles.calloutLabel}>{label}</Text>
      <Text style={styles.calloutValue}>{value}</Text>
      <Text style={[styles.calloutSub, { color }]}>{sub}</Text>
    </Card>
  );
}

function PropertyRow({ rank, property, sortKey }: { rank: number; property: PropertyPerformance; sortKey: SortKey }) {
  const value = sortKey === 'occupancyRate' ? `${property.occupancyRate}%` : formatMAD(property[sortKey]);
  return (
    <Card style={styles.propertyRow}>
      <Text style={styles.rank}>#{rank}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.propertyName}>{property.propertyName}</Text>
        <Text style={styles.propertyCity}>{property.city} · {property.reservationsCount} réservations</Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={styles.propertyValue}>{value}</Text>
        <Badge label={property.contractStatus} bg="#E3E9F4" color={AmkouyColors.primaryContainer} size="sm" />
      </View>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 22,
    paddingTop: 8,
  },
  sectionTitle: {
    ...robotoText(700, 15, { color: AmkouyColors.primary, marginTop: 20, marginBottom: 10 }),
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  kpiTile: {
    flexGrow: 0,
    flexBasis: '31%',
    width: '31%',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: AmkouyColors.hairline,
    borderRadius: 14,
    padding: 12,
  },
  kpiValue: {
    ...robotoText(700, 15, { color: AmkouyColors.text }),
  },
  kpiLabel: {
    ...robotoText(400, 10, { color: AmkouyColors.textFaint, marginTop: 3 }),
  },
  calloutRow: {
    gap: 10,
  },
  calloutCard: {
    padding: 14,
  },
  calloutLabel: {
    ...robotoText(500, 11, { color: AmkouyColors.textMuted }),
  },
  calloutValue: {
    ...robotoText(700, 15, { color: AmkouyColors.text, marginTop: 2 }),
  },
  calloutSub: {
    ...robotoText(600, 12, { marginTop: 2 }),
  },
  propertyList: {
    gap: 8,
    marginTop: 10,
  },
  propertyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
  },
  rank: {
    ...robotoText(700, 13, { color: AmkouyColors.textFainter, width: 24 }),
  },
  propertyName: {
    ...robotoText(600, 13, { color: AmkouyColors.text }),
  },
  propertyCity: {
    ...robotoText(400, 11, { color: AmkouyColors.textFaint, marginTop: 2 }),
  },
  propertyValue: {
    ...robotoText(700, 13, { color: AmkouyColors.primary, marginBottom: 4 }),
  },
  sectionCard: {
    paddingHorizontal: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: AmkouyColors.hairline,
  },
  rowLabel: {
    ...robotoText(400, 13, { color: AmkouyColors.textMuted }),
  },
  rowValue: {
    ...robotoText(600, 13, { color: AmkouyColors.text }),
  },
  emptyText: {
    ...robotoText(400, 12, { color: AmkouyColors.textFaint, paddingVertical: 10 }),
  },
});

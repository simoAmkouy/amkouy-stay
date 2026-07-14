import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AccessGuard } from '@/components/amkouy/access-guard';
import { BarChart } from '@/components/amkouy/bar-chart';
import { Card } from '@/components/amkouy/card';
import { DateFilterBar } from '@/components/amkouy/date-filter-bar';
import { EmptyState } from '@/components/amkouy/empty-state';
import { ErrorState } from '@/components/amkouy/error-state';
import { LoadingState } from '@/components/amkouy/loading-state';
import { Screen } from '@/components/amkouy/screen';
import { ScreenHeader } from '@/components/amkouy/screen-header';
import { Icon } from '@/components/icon';
import { AmkouyColors } from '@/constants/amkouy-theme';
import { robotoText } from '@/constants/typography';
import { growthLabel } from '@/app/(tabs)/dashboard';
import { useArchivedItems } from '@/hooks/use-archived-items';
import { useCommercialLeaderboard, useCommercialSourcePerformance } from '@/hooks/use-commercial-kpis';
import { DateFilterProvider, useDateFilter } from '@/hooks/use-date-filter';
import { useOperationsCenterRaw } from '@/hooks/use-operations-center';
import { useOwnerPayments } from '@/hooks/use-owner-payments';
import { useActivationCenterSummary, useActivationFunnelReport } from '@/hooks/use-property-activation';
import { usePortfolioReport, usePortfolioSummary, usePortfolioTimeline } from '@/hooks/use-reports';
import { useRecentActivity } from '@/hooks/use-dashboard-metrics';
import { computeDisplayStatus } from '@/lib/queries/owner-payments';
import {
  computeAlertCenter,
  computeArrivals,
  computeArrivalsNext7,
  computeBusinessHealthScore,
  computeCleaningPanel,
  computeContractsPanel,
  computeMaintenancePanel,
  computeOwnerPaymentsPanel,
  computePropertyHealthPanel,
  computePropertyStatuses,
  computeReservationRisks,
  computeRiskCenter,
  OperationsAlert,
  PropertyStatusInfo,
} from '@/lib/queries/operations-center';
import { PortfolioTimelinePoint, PropertyPerformance } from '@/lib/queries/reports';
import { REPORT_QUICK_FILTERS, toDateOnlyString } from '@/utils/date-range';
import { formatMAD } from '@/utils/format';

/** Recent-activity action prefixes an executive actually cares about — everything else on the
 * shared `activity_logs` feed (cleaning/maintenance/concierge day-to-day churn) is noise at this
 * altitude. Same table, same query as Home/Operations Center — just a narrower client filter. */
const HIGH_SIGNAL_PREFIXES = ['property.reassigned', 'owner_payment.', 'contract.', 'user.role_changed'];

function monthLabel(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { month: 'short' });
}

function seriesToBars(points: PortfolioTimelinePoint[], valueOf: (p: PortfolioTimelinePoint) => number, color: string) {
  const values = points.map(valueOf);
  const max = Math.max(1, ...values.map((v) => Math.abs(v)));
  return points.map((p) => ({
    m: monthLabel(p.month),
    h: `${Math.max(4, Math.round((Math.abs(valueOf(p)) / max) * 100))}%`,
    color,
  }));
}

export default function ExecutiveCommandCenterScreen() {
  return (
    <AccessGuard resource="executive_command_center">
      <DateFilterProvider initialFilter="this_month">
        <ExecutiveCommandCenterContent />
      </DateFilterProvider>
    </AccessGuard>
  );
}

function ExecutiveCommandCenterContent() {
  const { range, comparisonRange, comparisonMode } = useDateFilter();
  const startIso = toDateOnlyString(range.start);
  const endIso = toDateOnlyString(range.end);

  // ==========================================================================
  // DATA — every hook below is already used by another screen (Operations
  // Center, Finance, Reporting Dashboard, Portfolio Report, Owner Payments,
  // Commercial Leaderboard, Home, Recovery Center). Nothing here is a new
  // query; this screen only aggregates and re-slices what already exists.
  // ==========================================================================
  const { data: raw, isLoading: rawLoading, isError: rawError, refetch: refetchRaw } = useOperationsCenterRaw();
  const { data: summary, isLoading: summaryLoading } = usePortfolioSummary(range);
  const { data: previousSummary } = usePortfolioSummary(comparisonRange ?? range);
  const { data: timeline } = usePortfolioTimeline(range);
  const { data: portfolioReport } = usePortfolioReport(range, comparisonRange);
  const { data: ownerPayments } = useOwnerPayments();
  const { data: activationProperties } = useActivationCenterSummary();
  const { data: commercialLeaderboard } = useCommercialLeaderboard(startIso, endIso);
  const { data: commercialSources } = useCommercialSourcePerformance(startIso, endIso);
  const { data: activationFunnel } = useActivationFunnelReport(startIso, endIso);
  const { data: recentActivity } = useRecentActivity(range, 100);
  const { data: archivedItems } = useArchivedItems();

  const showGrowth = comparisonMode !== 'none' && !!comparisonRange && !!previousSummary;

  const today = new Date();
  const todayStr = toDateOnlyString(today);
  const tomorrowStr = toDateOnlyString(new Date(today.getTime() + 86_400_000));

  // ==========================================================================
  // DERIVED — every function called below is the exact same pure function
  // Operations Center already calls against the same raw payload (Mission D:
  // Operational Command Center). Recomputed here, not reimplemented.
  // ==========================================================================
  const derived = useMemo(() => {
    if (!raw) return null;
    const statuses: PropertyStatusInfo[] = computePropertyStatuses(raw, today);
    const reservationRisks = computeReservationRisks(raw, todayStr);
    const cleaningPanel = computeCleaningPanel(raw, range, todayStr);
    const maintenancePanel = computeMaintenancePanel(raw, today);
    const contractsPanel = computeContractsPanel(raw, today);
    const paymentsPanel = computeOwnerPaymentsPanel(raw, todayStr);
    const risk = computeRiskCenter(raw, statuses);
    const propertyHealth = computePropertyHealthPanel(raw, activationProperties ?? []);
    const arrivalsToday = computeArrivals(raw, todayStr);
    const arrivalsTomorrow = computeArrivals(raw, tomorrowStr);
    const arrivalsNext7 = computeArrivalsNext7(raw, todayStr);
    const activePropertiesCount = raw.properties.filter((p) => p.status === 'active').length;
    const onboardingPropertiesCount = (activationProperties ?? []).length;
    const underMaintenanceCount = statuses.filter((s) => s.status === 'under_maintenance').length;
    const activeOwnerPayments = raw.ownerPayments.filter((p) => p.status !== 'paid' && p.status !== 'cancelled');
    const activeContracts = raw.contracts.filter((c) => c.status === 'active');

    const businessHealth = computeBusinessHealthScore({
      reservationRisks: { missingGuestInfo: reservationRisks.missingGuestInfo, pendingConfirmation: reservationRisks.pendingConfirmation },
      upcoming7dReservationsCount: Math.max(arrivalsToday.length + arrivalsTomorrow.length + arrivalsNext7, 1),
      cleaningPanel: { overdue: cleaningPanel.overdue },
      openCleaningCount: raw.cleaningTasks.filter((t) => ['unassigned', 'scheduled', 'in_progress'].includes(t.status)).length,
      maintenancePanel: { urgent: maintenancePanel.urgent, olderThan7Days: maintenancePanel.olderThan7Days },
      openMaintenanceCount: maintenancePanel.open.length,
      overdueOwnerPaymentsCount: paymentsPanel.overdue.length,
      activeOwnerPaymentsCount: activeOwnerPayments.length,
      contractsPanel: { expired: contractsPanel.expired, expiringWithin30: contractsPanel.expiringWithin30 },
      activeContractsCount: activeContracts.length,
      activePropertiesCount,
      onboardingPropertiesCount,
      blockedPropertiesCount: risk.propertiesBlocked,
    });

    const alerts: OperationsAlert[] = computeAlertCenter(raw, todayStr, tomorrowStr)
      .filter((a) => a.severity === 'urgent')
      .slice(0, 10);

    return {
      statuses,
      reservationRisks,
      cleaningPanel,
      maintenancePanel,
      contractsPanel,
      paymentsPanel,
      risk,
      propertyHealth,
      arrivalsNext7,
      underMaintenanceCount,
      businessHealth,
      alerts,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raw, activationProperties, range]);

  const ownerIntegrity = useMemo(() => {
    const list = ownerPayments ?? [];
    return {
      manualAdjustments: list.filter((p) => p.is_manual_adjustment && p.status !== 'cancelled'),
      pending: list.filter((p) => p.status === 'pending'),
      approved: list.filter((p) => p.status === 'approved' || p.status === 'processing'),
      overdue: list.filter((p) => computeDisplayStatus(p) === 'overdue'),
    };
  }, [ownerPayments]);

  const filteredActivity = useMemo(() => {
    return (recentActivity ?? [])
      .filter((a) => HIGH_SIGNAL_PREFIXES.some((prefix) => a.action === prefix || a.action.startsWith(prefix)))
      .slice(0, 20);
  }, [recentActivity]);

  const isLoading = rawLoading || summaryLoading;
  const isError = rawError;

  if (isLoading || !raw || !derived) return <LoadingState label="Calcul de la vue exécutive…" />;
  if (isError) return <ErrorState message="Impossible de charger le centre exécutif." onRetry={refetchRaw} />;

  const { businessHealth, propertyHealth, risk, reservationRisks, cleaningPanel, maintenancePanel, contractsPanel, alerts, underMaintenanceCount } = derived;

  const topAgents = [...(commercialLeaderboard ?? [])].sort((a, b) => b.revenueGenerated - a.revenueGenerated).slice(0, 3);
  const topSources = [...(commercialSources ?? [])]
    .sort((a, b) => b.ownerLeadsWon + b.guestLeadsConfirmed - (a.ownerLeadsWon + a.guestLeadsConfirmed))
    .slice(0, 5);

  return (
    <Screen>
      <ScreenHeader title="Executive Command Center" subtitle="Vue stratégique globale" showBack fallbackHref="/more" />
      <DateFilterBar filters={REPORT_QUICK_FILTERS} />

      <View style={styles.content}>
        {/* ===== PHASE 3 — BUSINESS HEALTH ===== */}
        <SectionTitle title="Indice de santé opérationnelle" onPress={() => router.push('/operations')} />
        <Card style={styles.healthCard}>
          <View style={styles.healthScoreRow}>
            <View style={[styles.healthRing, { borderColor: healthColor(businessHealth.score) }]}>
              <Text style={[styles.healthScoreValue, { color: healthColor(businessHealth.score) }]}>{businessHealth.score}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <SubScoreRow label="Réservations" value={businessHealth.breakdown.reservationsScore} />
              <SubScoreRow label="Ménage" value={businessHealth.breakdown.cleaningScore} />
              <SubScoreRow label="Maintenance" value={businessHealth.breakdown.maintenanceScore} />
            </View>
            <View style={{ flex: 1 }}>
              <SubScoreRow label="Finance / Propriétaires" value={businessHealth.breakdown.financeScore} />
              <SubScoreRow label="Contrats" value={businessHealth.breakdown.contractsScore} />
              <SubScoreRow label="Biens prêts" value={businessHealth.breakdown.propertyReadinessScore} />
            </View>
          </View>
        </Card>

        {/* ===== PHASE 13 — URGENT ALERTS ===== */}
        {alerts.length > 0 && (
          <>
            <SectionTitle title="Alertes urgentes" />
            <View style={{ gap: 8 }}>
              {alerts.map((alert) => (
                <Pressable key={alert.id} onPress={() => router.push(alert.href as never)}>
                  <View style={styles.alertRow}>
                    <Icon name="error" size={19} color="#B91C1C" />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.alertTitle}>{alert.title}</Text>
                      <Text style={styles.alertSubtitle}>{alert.subtitle}</Text>
                    </View>
                    <Icon name="chevron_right" size={20} color={AmkouyColors.textFainter} />
                  </View>
                </Pressable>
              ))}
            </View>
          </>
        )}

        {/* ===== PHASE 4 — FINANCIAL TRUST ===== */}
        <SectionTitle title="Confiance financière" onPress={() => router.push('/more/finance')} />
        <View style={styles.kpiGrid}>
          <FinancialTile
            label="Revenu"
            value={formatMAD(summary?.totalRevenue ?? 0)}
            growth={showGrowth ? growthLabel(summary?.totalRevenue ?? 0, previousSummary?.totalRevenue ?? 0) : null}
          />
          <FinancialTile
            label="Remboursements"
            value={formatMAD(summary?.totalRefunds ?? 0)}
            color={AmkouyColors.error}
            growth={showGrowth ? growthLabel(summary?.totalRefunds ?? 0, previousSummary?.totalRefunds ?? 0) : null}
          />
          <FinancialTile
            label="Revenu net"
            value={formatMAD(summary?.totalNetRevenue ?? 0)}
            growth={showGrowth ? growthLabel(summary?.totalNetRevenue ?? 0, previousSummary?.totalNetRevenue ?? 0) : null}
          />
          <FinancialTile
            label="Marge brute"
            value={formatMAD(summary?.totalProfit ?? 0)}
            color={AmkouyColors.success}
            growth={showGrowth ? growthLabel(summary?.totalProfit ?? 0, previousSummary?.totalProfit ?? 0) : null}
          />
        </View>

        {/* ===== PHASE 5 — TREND ===== */}
        {timeline && timeline.length > 0 && (
          <>
            <SectionTitle title="Évolution" onPress={() => router.push('/more/reports/dashboard')} />
            <Card style={styles.chartCard}>
              <Text style={styles.chartTitle}>Revenu</Text>
              <BarChart data={seriesToBars(timeline, (p) => p.revenue, AmkouyColors.primaryContainer)} height={90} />
            </Card>
            <Card style={styles.chartCard}>
              <Text style={styles.chartTitle}>Revenu net</Text>
              <BarChart data={seriesToBars(timeline, (p) => p.revenue - p.refunds, AmkouyColors.primary)} height={90} />
            </Card>
            <Card style={styles.chartCard}>
              <Text style={styles.chartTitle}>Marge brute</Text>
              <BarChart data={seriesToBars(timeline, (p) => p.profit, AmkouyColors.success)} height={90} />
            </Card>
          </>
        )}

        {/* ===== PHASE 6 — OWNER PAYMENT INTEGRITY ===== */}
        <SectionTitle title="Intégrité des versements propriétaires" />
        <View style={styles.kpiGrid}>
          <Pressable style={styles.kpiTilePressable} onPress={() => router.push('/more/owner-payments?filter=manual')}>
            <KpiTile label="Ajustements manuels" value={ownerIntegrity.manualAdjustments.length} color="#B45309" />
          </Pressable>
          <Pressable style={styles.kpiTilePressable} onPress={() => router.push('/more/owner-payments')}>
            <KpiTile label="En attente" value={ownerIntegrity.pending.length} />
          </Pressable>
          <Pressable style={styles.kpiTilePressable} onPress={() => router.push('/more/owner-payments')}>
            <KpiTile label="Approuvés" value={ownerIntegrity.approved.length} color={AmkouyColors.primaryContainer} />
          </Pressable>
          <Pressable style={styles.kpiTilePressable} onPress={() => router.push('/more/owner-payments')}>
            <KpiTile label="En retard" value={ownerIntegrity.overdue.length} color={AmkouyColors.error} />
          </Pressable>
        </View>
        <Pressable onPress={() => router.push('/more/owner-payments')} style={styles.primaryButton}>
          <Icon name="account_balance_wallet" size={18} color="#fff" />
          <Text style={styles.primaryButtonText}>Ouvrir Paiements Propriétaires</Text>
        </Pressable>

        {/* ===== PHASE 7 — PORTFOLIO PERFORMANCE ===== */}
        <SectionTitle title="Performance du portefeuille" onPress={() => router.push('/more/reports/portfolio')} />
        <View style={styles.propertyCalloutRow}>
          <PropertyCallout label="Meilleur bien" property={portfolioReport?.bestByRevenue ?? null} color={AmkouyColors.success} />
          <PropertyCallout label="Bien le plus faible" property={portfolioReport?.worstByRevenue ?? null} color={AmkouyColors.error} />
        </View>
        {portfolioReport?.fastestGrowing && (
          <Card style={styles.fastestGrowingCard}>
            <Text style={styles.fastestGrowingLabel}>Croissance la plus rapide</Text>
            <Text style={styles.fastestGrowingName}>{portfolioReport.fastestGrowing.property.propertyName}</Text>
            <Text style={styles.fastestGrowingPct}>+{portfolioReport.fastestGrowing.growthPct.toFixed(0)}%</Text>
          </Card>
        )}

        {/* ===== PHASE 8 — PROPERTY HEALTH ===== */}
        <SectionTitle title="Santé du portefeuille" />
        <View style={styles.kpiGrid}>
          <Pressable style={styles.kpiTilePressable} onPress={() => router.push('/properties?status=onboarding')}>
            <KpiTile label="Activation en attente" value={propertyHealth.pendingActivation.length} color="#B45309" />
          </Pressable>
          <Pressable style={styles.kpiTilePressable} onPress={() => router.push('/properties')}>
            <KpiTile label="Propriétaire manquant" value={propertyHealth.missingOwner.length} color={AmkouyColors.error} />
          </Pressable>
          <Pressable style={styles.kpiTilePressable} onPress={() => router.push('/properties?status=onboarding')}>
            <KpiTile label="Tarification manquante" value={propertyHealth.missingPricing.length} color={AmkouyColors.error} />
          </Pressable>
          <Pressable style={styles.kpiTilePressable} onPress={() => router.push('/properties?status=onboarding')}>
            <KpiTile label="Photos manquantes" value={propertyHealth.missingPhotos.length} color={AmkouyColors.error} />
          </Pressable>
          <Pressable style={styles.kpiTilePressable} onPress={() => router.push('/properties?status=onboarding')}>
            <KpiTile label="Contrat manquant" value={propertyHealth.missingContract.length} color={AmkouyColors.error} />
          </Pressable>
          <Pressable style={styles.kpiTilePressable} onPress={() => router.push('/properties?status=maintenance')}>
            <KpiTile label="En maintenance" value={underMaintenanceCount} color="#8a6d1c" />
          </Pressable>
        </View>

        {/* ===== PHASE 9 — RISK CENTER ===== */}
        <SectionTitle title="Centre de risques" onPress={() => router.push('/operations')} />
        <View style={styles.kpiGrid}>
          <Pressable style={styles.kpiTilePressable} onPress={() => router.push('/more/cleaning?view=overdue')}>
            <KpiTile label="Ménage en retard" value={cleaningPanel.overdue.length} color={AmkouyColors.error} />
          </Pressable>
          <Pressable style={styles.kpiTilePressable} onPress={() => router.push('/more/maintenance?view=urgent')}>
            <KpiTile label="Maintenance urgente" value={maintenancePanel.urgent.length} color={AmkouyColors.error} />
          </Pressable>
          <Pressable style={styles.kpiTilePressable} onPress={() => router.push('/operations')}>
            <KpiTile label="Biens bloqués" value={risk.propertiesBlocked} color={AmkouyColors.error} />
          </Pressable>
          <Pressable style={styles.kpiTilePressable} onPress={() => router.push('/operations')}>
            <KpiTile
              label="Travaux non assignés"
              value={risk.unassignedCleaningTasks + risk.unassignedMaintenanceTickets + risk.unassignedConciergeRequests}
              color="#B45309"
            />
          </Pressable>
          <Pressable style={styles.kpiTilePressable} onPress={() => router.push('/reservations')}>
            <KpiTile label="Arrivée sous 48h, non confirmées" value={reservationRisks.startingWithin48h.length} color="#B45309" />
          </Pressable>
          <Pressable style={styles.kpiTilePressable} onPress={() => router.push('/reservations')}>
            <KpiTile label="Coordonnées client manquantes" value={reservationRisks.missingGuestInfo.length} color={AmkouyColors.error} />
          </Pressable>
        </View>

        {/* ===== PHASE 10 — CONTRACT MONITORING ===== */}
        <SectionTitle title="Suivi des contrats" onPress={() => router.push('/more/contracts')} />
        <View style={styles.kpiGrid}>
          <Pressable style={styles.kpiTilePressable} onPress={() => router.push('/more/contracts?health=expired')}>
            <KpiTile label="Expirés" value={contractsPanel.expired.length} color={AmkouyColors.error} />
          </Pressable>
          <Pressable style={styles.kpiTilePressable} onPress={() => router.push('/more/contracts?health=expiring')}>
            <KpiTile label="Expire sous 30j" value={contractsPanel.expiringWithin30.length} color={AmkouyColors.error} />
          </Pressable>
          <Pressable style={styles.kpiTilePressable} onPress={() => router.push('/more/contracts?health=expiring')}>
            <KpiTile label="Expire sous 60j" value={contractsPanel.expiringWithin60.length} color="#B45309" />
          </Pressable>
          <Pressable style={styles.kpiTilePressable} onPress={() => router.push('/more/contracts?health=expiring')}>
            <KpiTile label="Expire sous 90j" value={contractsPanel.expiringWithin90.length} />
          </Pressable>
        </View>

        {/* ===== PHASE 11 — COMMERCIAL PERFORMANCE ===== */}
        <SectionTitle title="Performance commerciale" onPress={() => router.push('/more/commercial/leaderboard')} />
        {topAgents.length > 0 ? (
          <View style={{ gap: 8 }}>
            {topAgents.map((agent, index) => (
              <Card key={agent.agentId} style={styles.agentRow}>
                <Text style={styles.agentRank}>#{index + 1}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.agentName}>{agent.agentName}</Text>
                  <Text style={styles.agentSub}>{agent.conversionRate}% de conversion</Text>
                </View>
                <Text style={styles.agentRevenue}>{formatMAD(agent.revenueGenerated)}</Text>
              </Card>
            ))}
          </View>
        ) : (
          <EmptyState icon="leaderboard" message="Aucun agent commercial actif sur cette période." />
        )}

        {topSources.length > 0 && (
          <>
            <Text style={styles.subsectionLabel}>Meilleures sources de leads</Text>
            <Card style={styles.sectionCard}>
              {topSources.map((source) => (
                <View key={source.source} style={styles.sourceRow}>
                  <Text style={styles.sourceLabel}>{source.source}</Text>
                  <Text style={styles.sourceValue}>
                    {source.ownerLeadsWon}/{source.ownerLeadsCount} · {source.guestLeadsConfirmed}/{source.guestLeadsCount}
                  </Text>
                </View>
              ))}
            </Card>
          </>
        )}

        {activationFunnel && (
          <View style={styles.kpiGrid}>
            <KpiTile label="Biens acquis" value={activationFunnel.propertiesAcquired} />
            <KpiTile label="Biens activés" value={activationFunnel.propertiesActivated} color={AmkouyColors.success} />
            <KpiTile label="Taux d'activation" value={`${activationFunnel.activationRate}%`} color={AmkouyColors.primaryContainer} />
            <KpiTile
              label="Délai 1ère résa"
              value={activationFunnel.avgDaysToFirstBooking != null ? `${activationFunnel.avgDaysToFirstBooking}j` : '—'}
            />
          </View>
        )}

        {/* ===== PHASE 12 — AUDIT & TRUST ===== */}
        <SectionTitle title="Audit & confiance" />
        <Card style={styles.sectionCard}>
          {filteredActivity.length === 0 ? (
            <Text style={styles.emptyText}>Aucune activité à forte signification récemment.</Text>
          ) : (
            filteredActivity.map((entry, index) => (
              <View key={entry.id} style={[styles.activityRow, index < filteredActivity.length - 1 && styles.activityRowBorder]}>
                <Icon name="history" size={17} color={AmkouyColors.textFaint} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.activityAction}>{entry.action}</Text>
                  <Text style={styles.activityTime}>
                    {new Date(entry.created_at).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
              </View>
            ))
          )}
        </Card>
        <Pressable onPress={() => router.push('/more/archived-items')} style={styles.archivedRow}>
          <Icon name="restore_from_trash" size={20} color={AmkouyColors.textMuted} />
          <Text style={styles.archivedText}>{(archivedItems ?? []).length} éléments archivés en attente de révision</Text>
          <Icon name="chevron_right" size={20} color={AmkouyColors.textFainter} />
        </Pressable>
      </View>
    </Screen>
  );
}

function healthColor(score: number): string {
  if (score >= 80) return AmkouyColors.success;
  if (score >= 60) return '#B45309';
  return AmkouyColors.error;
}

function SectionTitle({ title, onPress }: { title: string; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={styles.sectionTitleRow}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {onPress && <Icon name="chevron_right" size={18} color={AmkouyColors.textFainter} />}
    </Pressable>
  );
}

function SubScoreRow({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.subScoreRow}>
      <Text style={styles.subScoreLabel}>{label}</Text>
      <Text style={[styles.subScoreValue, { color: healthColor(value) }]}>{value}</Text>
    </View>
  );
}

function FinancialTile({ label, value, color, growth }: { label: string; value: string; color?: string; growth?: string | null }) {
  return (
    <View style={styles.kpiTile}>
      <Text style={[styles.kpiValue, color ? { color } : null]}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
      {growth && (
        <View style={styles.growthRow}>
          <Icon name="trending_up" size={12} color={AmkouyColors.success} />
          <Text style={styles.growthText}>{growth}</Text>
        </View>
      )}
    </View>
  );
}

function KpiTile({ label, value, color }: { label: string; value: number | string; color?: string }) {
  return (
    <View style={styles.kpiTile}>
      <Text style={[styles.kpiValue, color ? { color } : null]}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

function PropertyCallout({ label, property, color }: { label: string; property: PropertyPerformance | null; color: string }) {
  return (
    <Card style={styles.propertyCalloutCard}>
      <Text style={styles.calloutLabel}>{label}</Text>
      <Text style={styles.calloutName}>{property?.propertyName ?? '—'}</Text>
      {property && (
        <>
          <Text style={[styles.calloutValue, { color }]}>{formatMAD(property.revenue)}</Text>
          <View style={styles.calloutMetaRow}>
            <Text style={styles.calloutMeta}>Occ. {property.occupancyRate}%</Text>
            <Text style={styles.calloutMeta}>Net {formatMAD(property.netRevenue)}</Text>
            <Text style={styles.calloutMeta}>Marge {formatMAD(property.profit)}</Text>
          </View>
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 22,
    paddingTop: 8,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 24,
    marginBottom: 10,
  },
  sectionTitle: {
    ...robotoText(700, 16, { color: AmkouyColors.primary }),
  },
  healthCard: {
    padding: 16,
  },
  healthScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  healthRing: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  healthScoreValue: {
    ...robotoText(900, 22, {}),
  },
  subScoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  subScoreLabel: {
    ...robotoText(500, 11.5, { color: AmkouyColors.textMuted }),
  },
  subScoreValue: {
    ...robotoText(700, 12, {}),
  },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 13,
    backgroundColor: '#FDEBEB',
    borderWidth: 1,
    borderColor: '#f7caca',
  },
  alertTitle: {
    ...robotoText(600, 12.5, { color: AmkouyColors.text }),
  },
  alertSubtitle: {
    ...robotoText(400, 11, { color: AmkouyColors.textFaint, marginTop: 1 }),
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  kpiTilePressable: {
    flexGrow: 0,
    flexBasis: '31%',
    width: '31%',
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
    ...robotoText(900, 17, { color: AmkouyColors.text }),
  },
  kpiLabel: {
    ...robotoText(500, 10, { color: AmkouyColors.textFaint, marginTop: 3 }),
  },
  growthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 5,
  },
  growthText: {
    ...robotoText(700, 10.5, { color: AmkouyColors.success }),
  },
  primaryButton: {
    marginTop: 12,
    height: 48,
    borderRadius: 16,
    backgroundColor: AmkouyColors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryButtonText: {
    ...robotoText(700, 13, { color: '#fff' }),
  },
  chartCard: {
    padding: 14,
    marginBottom: 10,
  },
  chartTitle: {
    ...robotoText(700, 12.5, { color: AmkouyColors.primary, marginBottom: 10 }),
  },
  propertyCalloutRow: {
    flexDirection: 'row',
    gap: 10,
  },
  propertyCalloutCard: {
    flex: 1,
    padding: 14,
  },
  calloutLabel: {
    ...robotoText(500, 11, { color: AmkouyColors.textMuted }),
  },
  calloutName: {
    ...robotoText(700, 14, { color: AmkouyColors.text, marginTop: 3 }),
  },
  calloutValue: {
    ...robotoText(900, 15, { marginTop: 4 }),
  },
  calloutMetaRow: {
    marginTop: 6,
    gap: 2,
  },
  calloutMeta: {
    ...robotoText(400, 10, { color: AmkouyColors.textFaint }),
  },
  fastestGrowingCard: {
    marginTop: 10,
    padding: 14,
    backgroundColor: 'rgba(21,128,61,.08)',
    borderWidth: 1,
    borderColor: 'rgba(21,128,61,.2)',
  },
  fastestGrowingLabel: {
    ...robotoText(500, 11, { color: AmkouyColors.textMuted }),
  },
  fastestGrowingName: {
    ...robotoText(700, 14, { color: AmkouyColors.text, marginTop: 3 }),
  },
  fastestGrowingPct: {
    ...robotoText(900, 16, { color: AmkouyColors.success, marginTop: 3 }),
  },
  agentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    paddingHorizontal: 14,
  },
  agentRank: {
    ...robotoText(700, 13, { color: AmkouyColors.textFainter, width: 22 }),
  },
  agentName: {
    ...robotoText(600, 13, { color: AmkouyColors.text }),
  },
  agentSub: {
    ...robotoText(400, 11, { color: AmkouyColors.textFaint, marginTop: 2 }),
  },
  agentRevenue: {
    ...robotoText(700, 13, { color: AmkouyColors.primary }),
  },
  subsectionLabel: {
    ...robotoText(600, 12.5, { color: AmkouyColors.textMuted, marginTop: 14, marginBottom: 8 }),
  },
  sectionCard: {
    paddingHorizontal: 16,
  },
  sourceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: AmkouyColors.hairline,
  },
  sourceLabel: {
    ...robotoText(500, 12.5, { color: AmkouyColors.text }),
  },
  sourceValue: {
    ...robotoText(600, 11.5, { color: AmkouyColors.textMuted }),
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 11,
  },
  activityRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: AmkouyColors.hairline,
  },
  activityAction: {
    ...robotoText(500, 12.5, { color: AmkouyColors.text }),
  },
  activityTime: {
    ...robotoText(400, 10.5, { color: AmkouyColors.textFainter, marginTop: 1 }),
  },
  emptyText: {
    ...robotoText(400, 12.5, { color: AmkouyColors.textFaint, paddingVertical: 10 }),
  },
  archivedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
    padding: 13,
    borderRadius: 14,
    backgroundColor: AmkouyColors.hairline,
  },
  archivedText: {
    flex: 1,
    ...robotoText(500, 12, { color: AmkouyColors.textMuted }),
  },
});

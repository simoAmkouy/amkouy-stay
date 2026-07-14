import { router } from 'expo-router';
import { useEffect } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { AccessGuard } from '@/components/amkouy/access-guard';
import { Badge } from '@/components/amkouy/badge';
import { Card } from '@/components/amkouy/card';
import { DateFilterBar } from '@/components/amkouy/date-filter-bar';
import { EmptyState } from '@/components/amkouy/empty-state';
import { ErrorState } from '@/components/amkouy/error-state';
import { LoadingState } from '@/components/amkouy/loading-state';
import { OccupancyRing } from '@/components/amkouy/occupancy-ring';
import { Screen } from '@/components/amkouy/screen';
import { ScreenHeader } from '@/components/amkouy/screen-header';
import { Timeline } from '@/components/amkouy/timeline';
import { Icon } from '@/components/icon';
import { AmkouyColors } from '@/constants/amkouy-theme';
import { robotoText } from '@/constants/typography';
import { useDashboardMetrics, useRecentActivity } from '@/hooks/use-dashboard-metrics';
import { DateFilterProvider, useDateFilter } from '@/hooks/use-date-filter';
import { useOutstandingBalances, usePaymentsOverview } from '@/hooks/use-payments';
import { useCommercialLeaderboard, useCommercialSourcePerformance } from '@/hooks/use-commercial-kpis';
import { useCommercialLeads } from '@/hooks/use-commercial-leads';
import { useAuth } from '@/hooks/use-auth';
import { useSyncContractExpiryNotifications } from '@/hooks/use-contracts';
import { useTranslation } from '@/hooks/use-translation';
import { useActivationCenterSummary } from '@/hooks/use-property-activation';
import { computeDaysRemaining } from '@/lib/queries/contracts';
import { ActivationCenterEntry, ActivationStage } from '@/lib/queries/property-activation';
import {
  BusinessHealthResult,
  CleanerPerformance,
  computeAlertCenter,
  computeArrivals,
  computeArrivalsNext7,
  computeAvailableToday,
  computeBusinessHealthScore,
  computeCleaningPanel,
  computeCleaningTeamWorkload,
  computeConciergePanel,
  computeConciergeTeamWorkload,
  computeContractsPanel,
  computeDepartures,
  computeDeparturesNext7,
  computeMaintenancePanel,
  computeMaintenanceTeamWorkload,
  computeOccupancyControl,
  computeOccupiedToday,
  computeOwnerPaymentsPanel,
  computePerformanceInsights,
  computePropertyHealthPanel,
  computePropertyStatuses,
  computeReservationRisks,
  computeRiskCenter,
  computeUnassignedWork,
  OperationsAlert,
  PROPERTY_STATUS_COLOR,
  PROPERTY_STATUS_LABEL,
  ProviderPerformance,
  TechnicianPerformance,
} from '@/lib/queries/operations-center';
import { useOperationsCenterRaw } from '@/hooks/use-operations-center';
import { CLEANING_STATUS_OPTIONS } from '@/lib/validation/cleaning-task';
import { MAINTENANCE_STATUS_OPTIONS } from '@/lib/validation/maintenance-ticket';
import { DISPLAY_STATUS_OPTIONS } from '@/lib/validation/owner-payment';
import { SERVICE_STATUS_OPTIONS } from '@/lib/validation/reservation-service';
import { computeRangeForFilter, toDateOnlyString } from '@/utils/date-range';
import { formatMAD } from '@/utils/format';

const CLEANING_STATUS_LABEL = Object.fromEntries(CLEANING_STATUS_OPTIONS.map((o) => [o.value, o.label]));
const MAINTENANCE_STATUS_LABEL = Object.fromEntries(MAINTENANCE_STATUS_OPTIONS.map((o) => [o.value, o.label]));
const CONCIERGE_STATUS_LABEL = Object.fromEntries(SERVICE_STATUS_OPTIONS.map((o) => [o.value, o.label]));
const PAYMENT_STATUS_LABEL = Object.fromEntries(DISPLAY_STATUS_OPTIONS.map((o) => [o.value, o.label]));
const ACTIVATION_STAGE_LABEL: Record<ActivationStage, string> = {
  contract_pending: 'Contrat en attente',
  photos_pending: 'Photos en attente',
  property_setup_pending: 'Fiche incomplète',
  pricing_pending: 'Tarification en attente',
  ready_for_activation: 'Prêt à activer',
  active: 'Activé',
};
const ACTIVATION_STAGE_ORDER: ActivationStage[] = [
  'contract_pending',
  'photos_pending',
  'property_setup_pending',
  'pricing_pending',
  'ready_for_activation',
];

export default function OperationsScreen() {
  return (
    <AccessGuard resource="operations">
      <DateFilterProvider initialFilter="today">
        <OperationsContent />
      </DateFilterProvider>
    </AccessGuard>
  );
}

function OperationsContent() {
  // Read-only enforcement for accountants isn't done here: every Quick Action in this screen is
  // a navigation to an existing detail screen (Open Ticket/Task/Request/Payment), and each of
  // those already gates writes via its own AccessGuard/RLS (verified in Modules 3-5) — an
  // accountant clicking into e.g. a maintenance ticket simply hits the existing access boundary
  // there, since they don't hold the `maintenance`/`cleaning`/`concierge` resources.
  const { range } = useDateFilter();
  const { profile } = useAuth();
  const { t, locale } = useTranslation();
  const isStaff = profile?.role === 'admin' || profile?.role === 'super_admin' || profile?.role === 'manager';
  const { data: raw, isLoading, isError, refetch } = useOperationsCenterRaw();
  const syncContractExpiry = useSyncContractExpiryNotifications();

  const today = new Date();
  const todayStr = toDateOnlyString(today);
  const tomorrowStr = toDateOnlyString(new Date(today.getTime() + 86_400_000));

  // Revenue Control Center: four FIXED windows, independent of the top filter.
  const todayRange = computeRangeForFilter('today');
  const weekRange = computeRangeForFilter('this_week');
  const monthRange = computeRangeForFilter('this_month');
  const yearRange = computeRangeForFilter('this_year');
  const { data: revenueToday } = useDashboardMetrics(todayRange);
  const { data: revenueWeek } = useDashboardMetrics(weekRange);
  const { data: revenueMonth } = useDashboardMetrics(monthRange);
  const { data: revenueYear } = useDashboardMetrics(yearRange);
  const { data: recentActivity } = useRecentActivity(range, 10);
  // Module 9 (Phase 11): payment overview/outstanding list, same range as the top filter.
  const { data: paymentsOverview } = usePaymentsOverview(toDateOnlyString(range.start), toDateOnlyString(range.end));
  const { data: outstandingReservations } = useOutstandingBalances(toDateOnlyString(range.start), toDateOnlyString(range.end));
  // Module 10 (Phase 11): commercial KPIs, same range as the top filter, reusing the leaderboard/
  // source-performance RPCs already built for the Commercial module rather than new queries.
  const { data: commercialLeads } = useCommercialLeads();
  const { data: commercialLeaderboard } = useCommercialLeaderboard(toDateOnlyString(range.start), toDateOnlyString(range.end));
  const { data: commercialSources } = useCommercialSourcePerformance(toDateOnlyString(range.start), toDateOnlyString(range.end));
  // Module 11 (Phase 8): Property Activation section, reusing the same summary RPC as the
  // standalone Activation Center screen — no separate query.
  const { data: activationProperties } = useActivationCenterSummary();

  // Phase 13: no cron/scheduled worker exists — expiry alerts are computed and (idempotently)
  // fired whenever the Operations Center loads, staff-only (matches contracts_insert/update RLS).
  useEffect(() => {
    if (isStaff && raw && raw.contracts.length > 0) {
      syncContractExpiry.mutate(raw.contracts);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStaff, raw]);

  if (isLoading || !raw) return <LoadingState label="Chargement du centre d'opérations…" />;
  if (isError) return <ErrorState message="Impossible de charger le centre d'opérations." onRetry={refetch} />;

  const data = raw;
  // Reused as-is from data already loaded for Occupancy Control — not a new query.
  const activePropertiesCount = data.properties.filter((p) => p.status === 'active').length;
  const statuses = computePropertyStatuses(data, today);
  const statusByProperty = new Map(statuses.map((s) => [s.propertyId, s]));
  const baseAlerts = computeAlertCenter(data, todayStr, tomorrowStr);
  // Module 9 (Phase 11): guest-payment alerts, computed from the same `OutstandingReservation`
  // rows the Export Center / Reports reuse — same shape as every other alert (id/kind/severity/
  // title/subtitle/href), so it renders through the existing AlertRow with no new UI.
  const paymentAlerts: OperationsAlert[] = (outstandingReservations ?? [])
    .filter((r) => r.checkInDate <= todayStr)
    .map((r) => ({
      id: `payment-${r.reservationId}`,
      kind: 'payment' as const,
      severity: r.checkInDate < todayStr ? ('urgent' as const) : ('warning' as const),
      title: r.checkInDate < todayStr ? `Solde en retard · ${r.reservationCode}` : `Solde dû aujourd'hui · ${r.reservationCode}`,
      subtitle: `${r.guestName} — ${r.propertyName} — ${formatMAD(r.outstanding)} restant`,
      href: `/reservations/${r.reservationId}`,
    }));
  const alerts = [...baseAlerts, ...paymentAlerts].sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'urgent' ? -1 : 1));
  const unassigned = computeUnassignedWork(data);
  const occupancy = computeOccupancyControl(data, today);
  const arrivalsToday = computeArrivals(data, todayStr);
  const departuresToday = computeDepartures(data, todayStr);
  const arrivalsTomorrow = computeArrivals(data, tomorrowStr);
  const departuresTomorrow = computeDepartures(data, tomorrowStr);
  const occupiedToday = computeOccupiedToday(data, todayStr);
  const availableToday = computeAvailableToday(statuses);
  const cleaningPanel = computeCleaningPanel(data, range, todayStr);
  const maintenancePanel = computeMaintenancePanel(data);
  const conciergePanel = computeConciergePanel(data, range, todayStr);
  const paymentsPanel = computeOwnerPaymentsPanel(data, todayStr);
  const contractsPanel = computeContractsPanel(data, today);
  const cleaningTeam = computeCleaningTeamWorkload(data, todayStr);
  const maintenanceTeam = computeMaintenanceTeamWorkload(data);
  const conciergeTeam = computeConciergeTeamWorkload(data);
  const risk = computeRiskCenter(data, statuses);
  const insights = computePerformanceInsights(data, cleaningTeam, maintenanceTeam);
  const arrivalsNext7 = computeArrivalsNext7(data, todayStr);
  const departuresNext7 = computeDeparturesNext7(data, todayStr);
  const reservationRisks = computeReservationRisks(data, todayStr);
  const propertyHealth = computePropertyHealthPanel(data, activationProperties ?? []);
  const onboardingPropertiesCount = (activationProperties ?? []).length;
  const activeOwnerPayments = data.ownerPayments.filter((p) => p.status !== 'paid' && p.status !== 'cancelled');
  const activeContracts = data.contracts.filter((c) => c.status === 'active');
  const isCommandCenterViewer = profile?.role === 'super_admin' || profile?.role === 'admin' || profile?.role === 'manager';
  const businessHealth: BusinessHealthResult | null = isCommandCenterViewer
    ? computeBusinessHealthScore({
        reservationRisks: { missingGuestInfo: reservationRisks.missingGuestInfo, pendingConfirmation: reservationRisks.pendingConfirmation },
        upcoming7dReservationsCount: Math.max(arrivalsToday.length + arrivalsTomorrow.length + arrivalsNext7, 1),
        cleaningPanel: { overdue: cleaningPanel.overdue },
        openCleaningCount: data.cleaningTasks.filter((t) => ['unassigned', 'scheduled', 'in_progress'].includes(t.status)).length,
        maintenancePanel: { urgent: maintenancePanel.urgent, olderThan7Days: maintenancePanel.olderThan7Days },
        openMaintenanceCount: maintenancePanel.open.length,
        overdueOwnerPaymentsCount: paymentsPanel.overdue.length,
        activeOwnerPaymentsCount: activeOwnerPayments.length,
        contractsPanel: { expired: contractsPanel.expired, expiringWithin30: contractsPanel.expiringWithin30 },
        activeContractsCount: activeContracts.length,
        activePropertiesCount,
        onboardingPropertiesCount,
        blockedPropertiesCount: risk.propertiesBlocked,
      })
    : null;
  const topRisks: { label: string; value: number }[] = [
    { label: 'Ménages en retard', value: cleaningPanel.overdue.length },
    { label: 'Tickets urgents', value: maintenancePanel.urgent.length },
    { label: 'Versements en retard', value: paymentsPanel.overdue.length },
    { label: 'Contrats expirant sous 30j', value: contractsPanel.expiringWithin30.length },
    { label: 'Biens bloqués', value: risk.propertiesBlocked },
    { label: 'Réservations non confirmées (48h)', value: reservationRisks.pendingConfirmation.filter((r) => r.check_in_date <= tomorrowStr).length },
  ]
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  const conciergeCountFor = (reservationId: string) => data.concierge.filter((s) => s.reservation_id === reservationId).length;
  const activationByStage = (stage: ActivationStage) => (activationProperties ?? []).filter((p) => p.computedStage === stage);
  const activationItem = (p: ActivationCenterEntry) => ({
    key: p.propertyId,
    onPress: () => router.push(`/properties/${p.propertyId}`),
    left: (
      <View style={{ flex: 1 }}>
        <Text style={styles.itemTitle}>{p.propertyName}</Text>
        <Text style={styles.itemSub}>
          {p.city ?? '—'} · {p.activationScore}% · {p.daysInOnboarding} j en onboarding
        </Text>
      </View>
    ),
    right: <Badge label={ACTIVATION_STAGE_LABEL[p.computedStage]} bg="#E3E9F4" color="#1E3A6E" size="sm" />,
  });

  return (
    <Screen contentPadding={false}>
      <ScreenHeader
        title={t('operations.title')}
        subtitle={today.toLocaleDateString(locale === 'ar' ? 'ar-MA' : 'fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
      />

      <DateFilterBar />

      {/* ===== EXECUTIVE SUMMARY ===== */}
      <Text style={styles.sectionTitle}>{t('operations.executiveSummary')}</Text>
      <View style={styles.execSummaryGrid}>
        <KpiTile label="Propriétés gérées" value={activePropertiesCount} color={AmkouyColors.primary} style={styles.execTile} />
        <KpiTile label="Occupées aujourd'hui" value={occupancy.today.occupiedCount} color={AmkouyColors.primaryContainer} style={styles.execTile} />
        <KpiTile label="Disponibles aujourd'hui" value={occupancy.today.availableCount} color={AmkouyColors.success} style={styles.execTile} />
        <KpiTile label="Revenu ce mois" value={formatMAD(revenueMonth?.revenueTotal ?? 0)} color={AmkouyColors.text} style={styles.execTile} />
        <KpiTile label="Marge brute ce mois" value={formatMAD(revenueMonth?.profit ?? 0)} color={AmkouyColors.success} style={styles.execTile} />
        <KpiTile
          label="Ménage en attente"
          value={cleaningPanel.pendingCount}
          color={AmkouyColors.primaryContainer}
          style={styles.execTile}
          onPress={() => router.push('/more/cleaning?view=overdue')}
        />
        <KpiTile
          label="Maintenance ouverte"
          value={maintenancePanel.open.length}
          color={AmkouyColors.error}
          style={styles.execTile}
          onPress={() => router.push('/more/maintenance?view=urgent')}
        />
        <KpiTile label="Concierge actif" value={conciergePanel.activeCount} color="#8a6d1c" style={styles.execTile} />
        <KpiTile
          label="Versements dus"
          value={paymentsPanel.dueToday.length + paymentsPanel.overdue.length}
          color="#B45309"
          style={styles.execTile}
          onPress={() => router.push('/more/owner-payments')}
        />
        <KpiTile
          label="Contrats expirant"
          value={contractsPanel.expiringWithin90.length}
          color={contractsPanel.expiringWithin30.length > 0 ? AmkouyColors.error : AmkouyColors.textFaint}
          style={styles.execTile}
          onPress={() => router.push('/more/contracts?health=expiring')}
        />
        <KpiTile
          label="Soldes en retard"
          value={paymentsOverview?.balanceOverdueCount ?? 0}
          color={(paymentsOverview?.balanceOverdueCount ?? 0) > 0 ? AmkouyColors.error : AmkouyColors.textFaint}
          style={styles.execTile}
        />
      </View>

      {/* ===== BUSINESS HEALTH SCORE (Super Admin / Admin / Manager only) ===== */}
      {businessHealth && (
        <View style={styles.healthSection}>
          <Text style={styles.sectionTitle}>Indice de santé opérationnelle</Text>
          <Card style={styles.healthCard}>
            <View style={styles.healthScoreRow}>
              <View style={[styles.healthScoreRing, { borderColor: healthColor(businessHealth.score) }]}>
                <Text style={[styles.healthScoreValue, { color: healthColor(businessHealth.score) }]}>{businessHealth.score}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.healthBreakdownRow}>Réservations · {businessHealth.breakdown.reservationsScore}</Text>
                <Text style={styles.healthBreakdownRow}>Ménage · {businessHealth.breakdown.cleaningScore}</Text>
                <Text style={styles.healthBreakdownRow}>Maintenance · {businessHealth.breakdown.maintenanceScore}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.healthBreakdownRow}>Finance · {businessHealth.breakdown.financeScore}</Text>
                <Text style={styles.healthBreakdownRow}>Contrats · {businessHealth.breakdown.contractsScore}</Text>
                <Text style={styles.healthBreakdownRow}>Biens prêts · {businessHealth.breakdown.propertyReadinessScore}</Text>
              </View>
            </View>
            {topRisks.length > 0 && (
              <View style={styles.topRisksWrap}>
                <Text style={styles.topRisksTitle}>Principaux risques</Text>
                {topRisks.map((r) => (
                  <View key={r.label} style={styles.topRiskRow}>
                    <Icon name="warning" size={14} color="#B45309" />
                    <Text style={styles.topRiskLabel}>{r.label}</Text>
                    <Text style={styles.topRiskValue}>{r.value}</Text>
                  </View>
                ))}
              </View>
            )}
          </Card>
        </View>
      )}

      {/* ===== ALERT CENTER ===== */}
      {alerts.length > 0 && (
        <View style={styles.alertSection}>
          <Text style={styles.alertSectionTitle}>🔴 Alertes</Text>
          <View style={styles.alertList}>
            {alerts.slice(0, 12).map((alert) => (
              <AlertRow key={alert.id} alert={alert} />
            ))}
          </View>
        </View>
      )}

      {/* ===== UNASSIGNED WORK ===== */}
      <Text style={styles.sectionTitle}>{t('operations.unassignedWork')}</Text>
      <View style={styles.kpiRow}>
        <KpiTile label="Ménage" value={unassigned.cleaning} color={AmkouyColors.primaryContainer} />
        <KpiTile label="Maintenance" value={unassigned.maintenance} color={AmkouyColors.error} />
        <KpiTile label="Concierge" value={unassigned.concierge} color="#8a6d1c" />
      </View>

      {/* ===== REVENUE CONTROL CENTER ===== */}
      <Text style={styles.sectionTitle}>{t('operations.revenueControlCenter')}</Text>
      <View style={styles.revenueGrid}>
        <RevenueWindowCard label="Aujourd'hui" metrics={revenueToday} />
        <RevenueWindowCard label="Cette semaine" metrics={revenueWeek} />
        <RevenueWindowCard label="Ce mois" metrics={revenueMonth} />
        <RevenueWindowCard label="Cette année" metrics={revenueYear} />
      </View>

      {/* ===== OCCUPANCY CONTROL ===== */}
      <Text style={styles.sectionTitle}>{t('operations.occupancyControl')}</Text>
      <View style={styles.occupancyGrid}>
        <OccupancyCard label="Aujourd'hui" snapshot={occupancy.today} />
        <OccupancyCard label="7 jours" snapshot={occupancy.next7Days} />
        <OccupancyCard label="30 jours" snapshot={occupancy.next30Days} />
        <OccupancyCard label="90 jours" snapshot={occupancy.next90Days} />
      </View>

      {/* ===== TODAY'S OPERATIONS ===== */}
      <Text style={styles.sectionTitle}>{t('common.today')}</Text>

      <SubsectionLabel label="Arrivées" count={arrivalsToday.length} />
      <ListPanel
        emptyIcon="event_available"
        empty="Aucune arrivée aujourd'hui."
        items={arrivalsToday.map((r) => ({
          key: r.id,
          onPress: () => router.push(`/reservations/${r.id}`),
          left: (
            <View style={{ flex: 1 }}>
              <Text style={styles.itemTitle}>{r.guest?.full_name ?? '—'}</Text>
              <Text style={styles.itemSub}>
                {r.property?.name ?? '—'} · {conciergeCountFor(r.id)} service(s) concierge
              </Text>
            </View>
          ),
          right: (
            <View style={styles.rowActions}>
              {!!r.guest?.phone && <CallButton phone={r.guest.phone} />}
              <Badge label={r.status} bg="#E3E9F4" color="#1E3A6E" size="sm" />
            </View>
          ),
        }))}
      />

      <SubsectionLabel label="Départs" count={departuresToday.length} />
      <ListPanel
        emptyIcon="event_busy"
        empty="Aucun départ aujourd'hui."
        items={departuresToday.map((r) => ({
          key: r.id,
          onPress: () => router.push(`/reservations/${r.id}`),
          left: (
            <View style={{ flex: 1 }}>
              <Text style={styles.itemTitle}>{r.guest?.full_name ?? '—'}</Text>
              <Text style={styles.itemSub}>{r.property?.name ?? '—'}</Text>
            </View>
          ),
          right: <Badge label={r.status} bg="#E3E9F4" color="#1E3A6E" size="sm" />,
        }))}
      />

      <SubsectionLabel label="Propriétés occupées" count={occupiedToday.length} />
      <ListPanel
        emptyIcon="hotel"
        empty="Aucune propriété occupée."
        items={occupiedToday.map((o) => ({
          key: o.reservationId,
          onPress: () => router.push(`/reservations/${o.reservationId}`),
          left: (
            <View style={{ flex: 1 }}>
              <Text style={styles.itemTitle}>{o.propertyName}</Text>
              <Text style={styles.itemSub}>
                {o.guestName} · {o.checkIn} → {o.checkOut}
              </Text>
            </View>
          ),
          right: <PropertyStatusBadge status="occupied" />,
        }))}
      />

      <SubsectionLabel label="Disponibilité & prévisions" count={availableToday.length} />
      <ListPanel
        emptyIcon="meeting_room"
        empty="Aucune propriété disponible."
        items={availableToday.map((a) => ({
          key: a.propertyId,
          left: (
            <View style={{ flex: 1 }}>
              <Text style={styles.itemTitle}>{a.propertyName}</Text>
              <Text style={styles.itemSub}>
                {a.daysUntilNextReservation != null
                  ? `Prochaine réservation dans ${a.daysUntilNextReservation} j (${a.nextReservationCheckIn})`
                  : 'Aucune réservation prévue'}
              </Text>
            </View>
          ),
          right: <PropertyStatusBadge status={a.status} />,
        }))}
      />

      {/* ===== RESERVATION RISKS ===== */}
      <Text style={styles.sectionTitle}>Risques de réservation</Text>
      <View style={styles.kpiRow}>
        <KpiTile label="Coordonnées manquantes" value={reservationRisks.missingGuestInfo.length} color={AmkouyColors.error} />
        <KpiTile label="Non confirmées" value={reservationRisks.pendingConfirmation.length} color="#B45309" />
        <KpiTile label="Arrivée sous 48h" value={reservationRisks.startingWithin48h.length} color={AmkouyColors.primaryContainer} />
      </View>
      <SubsectionLabel label="Coordonnées client manquantes" count={reservationRisks.missingGuestInfo.length} />
      <ListPanel emptyIcon="badge" empty="Aucune réservation avec coordonnées manquantes." items={reservationRisks.missingGuestInfo.slice(0, 10).map(reservationRiskItem)} />
      <SubsectionLabel label="En attente de confirmation" count={reservationRisks.pendingConfirmation.length} />
      <ListPanel emptyIcon="hourglass_empty" empty="Aucune réservation en attente de confirmation." items={reservationRisks.pendingConfirmation.slice(0, 10).map(reservationRiskItem)} />

      {/* ===== TOMORROW OPERATIONS PANEL ===== */}
      <Text style={styles.sectionTitle}>{t('operations.tomorrow')}</Text>
      <View style={styles.kpiRow}>
        <KpiTile label="Arrivées" value={arrivalsTomorrow.length} color="#6D4FC9" />
        <KpiTile label="Départs" value={departuresTomorrow.length} color={AmkouyColors.error} />
        <KpiTile
          label="Ménages prévus"
          value={data.cleaningTasks.filter((c) => c.scheduled_date === tomorrowStr && c.status !== 'cancelled').length}
          color={AmkouyColors.primaryContainer}
        />
      </View>
      <Text style={styles.subsectionLabelStandalone}>7 prochains jours</Text>
      <View style={styles.kpiRow}>
        <KpiTile label="Arrivées" value={arrivalsNext7} color="#6D4FC9" />
        <KpiTile label="Départs" value={departuresNext7} color={AmkouyColors.error} />
      </View>

      {/* ===== CLEANING OPERATIONS PANEL ===== */}
      <Text style={styles.sectionTitle}>{t('operations.cleaningOps')}</Text>
      <SubsectionLabel label="Prévu (période)" count={cleaningPanel.dueInRange.length} />
      <ListPanel emptyIcon="cleaning_services" empty="Aucun ménage prévu." items={cleaningPanel.dueInRange.map(cleaningItem)} />
      <SubsectionLabel label="En cours" count={cleaningPanel.inProgress.length} />
      <ListPanel emptyIcon="cleaning_services" empty="Aucun ménage en cours." items={cleaningPanel.inProgress.map(cleaningItem)} />
      <SubsectionLabel label="En retard" count={cleaningPanel.overdue.length} />
      <ListPanel emptyIcon="cleaning_services" empty="Aucun ménage en retard." items={cleaningPanel.overdue.map(cleaningItem)} />
      <SubsectionLabel label="En attente de vérification" count={cleaningPanel.awaitingVerification.length} />
      <ListPanel
        emptyIcon="cleaning_services"
        empty="Aucun ménage à vérifier."
        items={cleaningPanel.awaitingVerification.map(cleaningItem)}
      />

      {/* ===== MAINTENANCE OPERATIONS PANEL ===== */}
      <Text style={styles.sectionTitle}>{t('operations.maintenanceOps')}</Text>
      <SubsectionLabel label="Ouverts" count={maintenancePanel.open.length} />
      <ListPanel emptyIcon="build" empty="Aucun ticket ouvert." items={maintenancePanel.open.map(maintenanceItem)} />
      <SubsectionLabel label="Urgents" count={maintenancePanel.urgent.length} />
      <ListPanel emptyIcon="build" empty="Aucun ticket urgent." items={maintenancePanel.urgent.map(maintenanceItem)} />
      <SubsectionLabel label="En cours" count={maintenancePanel.inProgress.length} />
      <ListPanel emptyIcon="build" empty="Aucun ticket en cours." items={maintenancePanel.inProgress.map(maintenanceItem)} />
      <SubsectionLabel label="En attente de vérification" count={maintenancePanel.awaitingVerification.length} />
      <ListPanel
        emptyIcon="build"
        empty="Aucun ticket à vérifier."
        items={maintenancePanel.awaitingVerification.map(maintenanceItem)}
      />
      <SubsectionLabel label="En attente de pièces" count={maintenancePanel.waitingParts.length} />
      <ListPanel emptyIcon="build" empty="Aucun ticket en attente de pièces." items={maintenancePanel.waitingParts.map(maintenanceItem)} />
      <SubsectionLabel label="Ouverts depuis plus de 7 jours" count={maintenancePanel.olderThan7Days.length} />
      <ListPanel emptyIcon="build" empty="Aucun ticket ouvert depuis plus de 7 jours." items={maintenancePanel.olderThan7Days.map(maintenanceItem)} />

      {/* ===== CONCIERGE OPERATIONS PANEL ===== */}
      <Text style={styles.sectionTitle}>{t('operations.concierge')}</Text>
      <SubsectionLabel label="Aujourd'hui" count={conciergePanel.today.length} />
      <ListPanel emptyIcon="room_service" empty="Aucun service aujourd'hui." items={conciergePanel.today.map(conciergeItem)} />
      <SubsectionLabel label="En attente" count={conciergePanel.pending.length} />
      <ListPanel emptyIcon="room_service" empty="Aucun service en attente." items={conciergePanel.pending.map(conciergeItem)} />
      <SubsectionLabel label="Planifiés (période)" count={conciergePanel.scheduledInRange.length} />
      <ListPanel emptyIcon="room_service" empty="Aucun service planifié." items={conciergePanel.scheduledInRange.map(conciergeItem)} />
      <SubsectionLabel label="En cours" count={conciergePanel.inProgress.length} />
      <ListPanel emptyIcon="room_service" empty="Aucun service en cours." items={conciergePanel.inProgress.map(conciergeItem)} />
      <SubsectionLabel label="Terminés aujourd'hui" count={conciergePanel.completedToday.length} />
      <ListPanel
        emptyIcon="room_service"
        empty="Aucun service terminé aujourd'hui."
        items={conciergePanel.completedToday.map(conciergeItem)}
      />

      {/* ===== OWNER PAYMENT OPERATIONS ===== */}
      <Text style={styles.sectionTitle}>{t('operations.ownerPayments')}</Text>
      <SubsectionLabel label="Dus aujourd'hui" count={paymentsPanel.dueToday.length} />
      <ListPanel emptyIcon="payments" empty="Aucun versement dû aujourd'hui." items={paymentsPanel.dueToday.map(paymentItem)} />
      <SubsectionLabel label="Dus cette semaine" count={paymentsPanel.dueThisWeek.length} />
      <ListPanel emptyIcon="payments" empty="Aucun versement dû cette semaine." items={paymentsPanel.dueThisWeek.map(paymentItem)} />
      <SubsectionLabel label="En retard" count={paymentsPanel.overdue.length} />
      <ListPanel emptyIcon="payments" empty="Aucun versement en retard." items={paymentsPanel.overdue.map(paymentItem)} />

      {/* ===== CONTRACTS (Module 7 / Phase 12) ===== */}
      <Text style={styles.sectionTitle}>{t('operations.contracts')}</Text>
      <SubsectionLabel label="Expire sous 90 jours" count={contractsPanel.expiringWithin90.length} />
      <ListPanel emptyIcon="description" empty="Aucun contrat n'expire sous 90 jours." items={contractsPanel.expiringWithin90.map(contractItem)} />
      <SubsectionLabel label="Expire sous 60 jours" count={contractsPanel.expiringWithin60.length} />
      <ListPanel emptyIcon="description" empty="Aucun contrat n'expire sous 60 jours." items={contractsPanel.expiringWithin60.map(contractItem)} />
      <SubsectionLabel label="Expire sous 30 jours" count={contractsPanel.expiringWithin30.length} />
      <ListPanel emptyIcon="description" empty="Aucun contrat n'expire sous 30 jours." items={contractsPanel.expiringWithin30.map(contractItem)} />
      <SubsectionLabel label="Expirés" count={contractsPanel.expired.length} />
      <ListPanel emptyIcon="description" empty="Aucun contrat expiré." items={contractsPanel.expired.map(contractItem)} />

      {/* ===== GUEST PAYMENTS (Module 9) ===== */}
      <Text style={styles.sectionTitle}>{t('operations.guestPayments')}</Text>
      <View style={styles.kpiRow}>
        <KpiTile label="Dû aujourd'hui" value={paymentsOverview?.balanceDueTodayCount ?? 0} color="#B45309" />
        <KpiTile label="En retard" value={paymentsOverview?.balanceOverdueCount ?? 0} color={AmkouyColors.error} />
        <KpiTile label="Acompte manquant" value={paymentsOverview?.depositsMissingCount ?? 0} color="#8a6d1c" />
      </View>
      <View style={styles.kpiRow}>
        <KpiTile label="Remboursement en attente" value={paymentsOverview?.refundPendingCount ?? 0} color="#6D4FC9" />
        <KpiTile label="Solde important" value={paymentsOverview?.largeOutstandingCount ?? 0} color={AmkouyColors.primaryContainer} />
      </View>
      <SubsectionLabel label="Soldes en cours" count={(outstandingReservations ?? []).length} />
      <ListPanel
        emptyIcon="payments"
        empty="Aucun solde en cours sur cette période."
        items={(outstandingReservations ?? []).map((r) => ({
          key: r.reservationId,
          onPress: () => router.push(`/reservations/${r.reservationId}`),
          left: (
            <View style={{ flex: 1 }}>
              <Text style={styles.itemTitle}>{r.reservationCode}</Text>
              <Text style={styles.itemSub}>
                {r.guestName} · {r.propertyName} · dû {formatMAD(r.outstanding)}
              </Text>
            </View>
          ),
          right: <Badge label={r.checkInDate < todayStr ? 'En retard' : 'À venir'} bg={r.checkInDate < todayStr ? '#FAD9D9' : '#E3E9F4'} color={r.checkInDate < todayStr ? '#B91C1C' : AmkouyColors.primaryContainer} size="sm" />,
        }))}
      />

      {/* ===== COMMERCIAL CRM (Module 10) ===== */}
      <Text style={styles.sectionTitle}>{t('operations.commercial')}</Text>
      <View style={styles.kpiRow}>
        <KpiTile label="Nouveaux leads" value={(commercialLeads ?? []).filter((l) => l.status === 'new').length} color={AmkouyColors.primaryContainer} />
        <KpiTile label="Visites planifiées" value={(commercialLeads ?? []).filter((l) => l.status === 'visit_scheduled').length} color="#B45309" />
        <KpiTile label="Négociations" value={(commercialLeads ?? []).filter((l) => l.status === 'negotiation').length} color="#8a6d1c" />
      </View>
      <View style={styles.kpiRow}>
        <KpiTile label="Gagnés (période)" value={(commercialLeads ?? []).filter((l) => l.status === 'won').length} color={AmkouyColors.success} />
        <KpiTile label="Perdus (période)" value={(commercialLeads ?? []).filter((l) => l.status === 'lost').length} color={AmkouyColors.error} />
      </View>
      {(commercialLeaderboard ?? []).length > 0 && (
        <>
          <SubsectionLabel label="Revenu par agent" count={commercialLeaderboard?.length ?? 0} />
          <ListPanel
            emptyIcon="leaderboard"
            empty="Aucun agent commercial."
            items={[...(commercialLeaderboard ?? [])]
              .sort((a, b) => b.revenueGenerated - a.revenueGenerated)
              .slice(0, 5)
              .map((agent) => ({
                key: agent.agentId,
                onPress: () => router.push('/more/commercial/leaderboard'),
                left: (
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemTitle}>{agent.agentName}</Text>
                    <Text style={styles.itemSub}>
                      {agent.propertiesAcquired} biens · {agent.reservationsGenerated} réservations
                    </Text>
                  </View>
                ),
                right: <Text style={{ ...robotoText(700, 13, { color: AmkouyColors.primary }) }}>{formatMAD(agent.revenueGenerated)}</Text>,
              }))}
          />
        </>
      )}
      {(commercialSources ?? []).length > 0 && (
        <>
          <SubsectionLabel label="Top sources" count={commercialSources?.length ?? 0} />
          <ListPanel
            emptyIcon="insights"
            empty="Aucune source enregistrée."
            items={[...(commercialSources ?? [])]
              .sort((a, b) => b.ownerLeadsWon + b.guestLeadsConfirmed - (a.ownerLeadsWon + a.guestLeadsConfirmed))
              .slice(0, 5)
              .map((source) => ({
                key: source.source,
                left: (
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemTitle}>{source.source}</Text>
                    <Text style={styles.itemSub}>
                      {source.ownerLeadsWon}/{source.ownerLeadsCount} propriétaires · {source.guestLeadsConfirmed}/{source.guestLeadsCount} réservations
                    </Text>
                  </View>
                ),
                right: <Icon name="trending_up" size={18} color={AmkouyColors.textFainter} />,
              }))}
          />
        </>
      )}

      {/* ===== PROPERTY HEALTH ===== */}
      <Text style={styles.sectionTitle}>Santé du portefeuille</Text>
      <View style={styles.execSummaryGrid}>
        <KpiTile
          label="Activation en attente"
          value={propertyHealth.pendingActivation.length}
          color="#B45309"
          style={styles.execTile}
          onPress={() => router.push('/properties?status=onboarding')}
        />
        <KpiTile
          label="Photos manquantes"
          value={propertyHealth.missingPhotos.length}
          color={AmkouyColors.error}
          style={styles.execTile}
          onPress={() => router.push('/properties?status=onboarding')}
        />
        <KpiTile
          label="Tarification manquante"
          value={propertyHealth.missingPricing.length}
          color={AmkouyColors.error}
          style={styles.execTile}
          onPress={() => router.push('/properties?status=onboarding')}
        />
        <KpiTile
          label="Contrat manquant"
          value={propertyHealth.missingContract.length}
          color={AmkouyColors.error}
          style={styles.execTile}
          onPress={() => router.push('/properties?status=onboarding')}
        />
        <KpiTile
          label="Propriétaire non assigné"
          value={propertyHealth.missingOwner.length}
          color={AmkouyColors.error}
          style={styles.execTile}
          onPress={() => router.push('/properties')}
        />
      </View>
      <SubsectionLabel label="Propriétaire non assigné" count={propertyHealth.missingOwner.length} />
      <ListPanel
        emptyIcon="person_off"
        empty="Tous les biens ont un propriétaire assigné."
        items={propertyHealth.missingOwner.map((p) => ({
          key: p.id,
          onPress: () => router.push(`/properties/${p.id}`),
          left: (
            <View style={{ flex: 1 }}>
              <Text style={styles.itemTitle}>{p.name}</Text>
              <Text style={styles.itemSub}>{p.city}</Text>
            </View>
          ),
          right: <Badge label="Sans propriétaire" bg="#FAD9D9" color="#B91C1C" size="sm" />,
        }))}
      />

      {/* ===== PROPERTY ACTIVATION (Module 11) ===== */}
      {(activationProperties ?? []).length > 0 && (
        <>
          <Text style={styles.sectionTitle}>{t('operations.propertyActivation')}</Text>
          {ACTIVATION_STAGE_ORDER.map((stage) => {
            const items = activationByStage(stage);
            if (items.length === 0) return null;
            return (
              <View key={stage}>
                <SubsectionLabel label={ACTIVATION_STAGE_LABEL[stage]} count={items.length} />
                <ListPanel emptyIcon="rocket_launch" empty="Aucun bien à ce stade." items={items.map(activationItem)} />
              </View>
            );
          })}
        </>
      )}

      {/* ===== TEAM WORKLOAD + PERFORMANCE ===== */}
      <Text style={styles.sectionTitle}>{t('operations.teamWorkload')}</Text>
      <SubsectionLabel label="Équipe ménage" count={cleaningTeam.length} />
      <View style={styles.teamList}>
        {cleaningTeam.length === 0 && <Text style={styles.emptySectionText}>Aucun agent de ménage.</Text>}
        {cleaningTeam.map((c) => (
          <CleanerTeamRow key={c.userId} cleaner={c} />
        ))}
      </View>
      <SubsectionLabel label="Équipe maintenance" count={maintenanceTeam.length} />
      <View style={styles.teamList}>
        {maintenanceTeam.length === 0 && <Text style={styles.emptySectionText}>Aucun technicien.</Text>}
        {maintenanceTeam.map((t) => (
          <TechnicianTeamRow key={t.userId} technician={t} />
        ))}
      </View>
      <SubsectionLabel label="Prestataires concierge" count={conciergeTeam.length} />
      <View style={styles.teamList}>
        {conciergeTeam.length === 0 && <Text style={styles.emptySectionText}>Aucun prestataire.</Text>}
        {conciergeTeam.map((p) => (
          <ProviderTeamRow key={p.providerId} provider={p} />
        ))}
      </View>

      {/* ===== BUSINESS RISK CENTER ===== */}
      <Text style={styles.sectionTitle}>{t('operations.riskCenter')}</Text>
      <View style={styles.riskGrid}>
        <RiskTile label="Sans réservation" value={risk.propertiesWithoutReservation} />
        <RiskTile label="Ménage requis" value={risk.propertiesNeedingCleaning} />
        <RiskTile label="Bloquées" value={risk.propertiesBlocked} />
        <RiskTile label="Tickets non assignés" value={risk.unassignedMaintenanceTickets} />
        <RiskTile label="Ménages non assignés" value={risk.unassignedCleaningTasks} />
        <RiskTile label="Concierge non assigné" value={risk.unassignedConciergeRequests} />
        <RiskTile label="Versements en retard" value={risk.overdueOwnerPayments} />
      </View>

      {/* ===== PERFORMANCE INSIGHTS ===== */}
      <Text style={styles.sectionTitle}>{t('operations.performance')}</Text>
      <View style={styles.insightGrid}>
        <InsightTile label="Meilleur revenu" entry={insights.topRevenueProperty} format="mad" />
        <InsightTile label="Meilleure occupation" entry={insights.topOccupancyProperty} format="nights" />
        <InsightTile label="Plus rentable" entry={insights.mostProfitableProperty} format="mad" />
        <InsightTile label="Service concierge top" entry={insights.topConciergeService} format="mad" />
        <InsightTile label="Prestataire top" entry={insights.topConciergeProvider} format="mad" />
        <InsightTile label="Meilleur agent ménage" entry={insights.bestCleaner} format="count" />
        <InsightTile label="Meilleur technicien" entry={insights.bestTechnician} format="count" />
      </View>

      {/* ===== OPERATIONS TIMELINE ===== */}
      <Text style={styles.sectionTitle}>{t('operations.timeline')}</Text>
      <View style={styles.timelineWrap}>
        {(recentActivity ?? []).length === 0 ? (
          <EmptyState icon="history" message="Aucune activité récente." />
        ) : (
          <Timeline
            items={(recentActivity ?? []).map((a) => ({
              dot: AmkouyColors.primaryContainer,
              ring: AmkouyColors.hairline,
              label: a.action,
              time: new Date(a.created_at).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }),
            }))}
          />
        )}
      </View>
    </Screen>
  );

  function reservationRiskItem(r: (typeof data.reservations)[number]) {
    return {
      key: r.id,
      onPress: () => router.push(`/reservations/${r.id}`),
      left: (
        <View style={{ flex: 1 }}>
          <Text style={styles.itemTitle}>{r.guest?.full_name ?? '—'}</Text>
          <Text style={styles.itemSub}>
            {r.property?.name ?? '—'} · arrivée {r.check_in_date}
          </Text>
        </View>
      ),
      right: <Badge label={r.guest?.phone ? 'Non confirmée' : 'Coordonnées manquantes'} bg="#FDEBC8" color="#B45309" size="sm" />,
    };
  }

  function cleaningItem(c: (typeof data.cleaningTasks)[number]) {
    const status = statusByProperty.get(c.property_id);
    return {
      key: c.id,
      onPress: () => router.push(`/more/cleaning/${c.id}`),
      left: (
        <View style={{ flex: 1 }}>
          <Text style={styles.itemTitle}>{c.property?.name ?? '—'}</Text>
          <Text style={styles.itemSub}>
            {c.cleaner?.full_name ?? 'Non assigné'} · {c.scheduled_date}
          </Text>
        </View>
      ),
      right: (
        <View style={styles.rowActions}>
          {status && <PropertyStatusBadge status={status.status} />}
          <Badge label={CLEANING_STATUS_LABEL[c.status] ?? c.status} bg="#EEF0F4" color={AmkouyColors.textMuted} size="sm" />
        </View>
      ),
    };
  }

  function maintenanceItem(t: (typeof data.maintenanceTickets)[number]) {
    const daysOpen = Math.max(0, Math.round((today.getTime() - new Date(t.created_at).getTime()) / 86_400_000));
    return {
      key: t.id,
      onPress: () => router.push(`/more/maintenance/${t.id}`),
      left: (
        <View style={{ flex: 1 }}>
          <Text style={styles.itemTitle}>{t.ticket_number}</Text>
          <Text style={styles.itemSub}>
            {t.property?.name ?? '—'} · {t.technician?.full_name ?? 'Non assigné'} · {daysOpen} j
          </Text>
        </View>
      ),
      right: <Badge label={MAINTENANCE_STATUS_LABEL[t.status] ?? t.status} bg="#FDEBC8" color="#B45309" size="sm" />,
    };
  }

  function conciergeItem(s: (typeof data.concierge)[number]) {
    return {
      key: s.id,
      onPress: () => router.push(`/reservations/${s.reservation_id}`),
      left: (
        <View style={{ flex: 1 }}>
          <Text style={styles.itemTitle}>{s.service?.name ?? '—'}</Text>
          <Text style={styles.itemSub}>
            {s.reservation?.guest?.full_name ?? '—'} · {s.reservation?.property?.name ?? '—'} · {s.provider?.name ?? 'Non assigné'}
          </Text>
        </View>
      ),
      right: <Badge label={CONCIERGE_STATUS_LABEL[s.status] ?? s.status} bg="#F8EFD4" color="#8a6d1c" size="sm" />,
    };
  }

  function paymentItem(p: (typeof data.ownerPayments)[number]) {
    return {
      key: p.id,
      onPress: () => router.push(`/more/owner-payments/${p.id}`),
      left: (
        <View style={{ flex: 1 }}>
          <Text style={styles.itemTitle}>{p.payment_number}</Text>
          <Text style={styles.itemSub}>
            {p.owner?.full_name ?? '—'} · {p.property?.name ?? '—'} · {formatMAD(p.net_amount)}
            {p.is_manual_adjustment ? ' · Ajustement manuel' : ''}
          </Text>
        </View>
      ),
      right: <Badge label={PAYMENT_STATUS_LABEL['overdue'] ?? p.status} bg="#FAD9D9" color="#B91C1C" size="sm" />,
    };
  }

  function contractItem(c: (typeof data.contracts)[number]) {
    const days = computeDaysRemaining(c.end_date, today);
    return {
      key: c.id,
      onPress: () => router.push(`/more/contracts/${c.id}`),
      left: (
        <View style={{ flex: 1 }}>
          <Text style={styles.itemTitle}>{c.contract_number}</Text>
          <Text style={styles.itemSub}>
            {c.owner?.full_name ?? '—'} · {c.property?.name ?? '—'}
            {days !== null ? ` · ${days >= 0 ? `${days} j restants` : `expiré depuis ${Math.abs(days)} j`}` : ''}
          </Text>
        </View>
      ),
      right: <Badge label={days !== null && days < 0 ? 'Expiré' : 'Expire bientôt'} bg="#FAD9D9" color="#B91C1C" size="sm" />,
    };
  }
}

// ============================================================================
// Small presentational helpers
// ============================================================================

function SubsectionLabel({ label, count }: { label: string; count: number }) {
  return (
    <View style={styles.subsectionRow}>
      <Text style={styles.subsectionLabel}>{label}</Text>
      <View style={styles.subsectionCountPill}>
        <Text style={styles.subsectionCountText}>{count}</Text>
      </View>
    </View>
  );
}

type ListItem = { key: string; left: React.ReactNode; right: React.ReactNode; onPress?: () => void };

function ListPanel({ items, empty, emptyIcon }: { items: ListItem[]; empty: string; emptyIcon: string }) {
  if (items.length === 0) return <EmptyState icon={emptyIcon} message={empty} />;
  return (
    <View style={styles.itemList}>
      {items.map((item) => {
        const row = (
          <Card style={styles.itemCard}>
            {item.left}
            {item.right}
          </Card>
        );
        return item.onPress ? (
          <Pressable key={item.key} onPress={item.onPress}>
            {row}
          </Pressable>
        ) : (
          <View key={item.key}>{row}</View>
        );
      })}
    </View>
  );
}

function KpiTile({
  label,
  value,
  color,
  style,
  onPress,
}: {
  label: string;
  value: number | string;
  color: string;
  style?: object;
  onPress?: () => void;
}) {
  const Wrapper = onPress ? Pressable : View;
  return (
    <Wrapper style={[styles.kpiTile, style]} onPress={onPress}>
      <Text style={[styles.kpiValue, { color }]}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </Wrapper>
  );
}

function RevenueWindowCard({ label, metrics }: { label: string; metrics?: { revenueTotal: number; expenses: number; profit: number } }) {
  return (
    <Card style={styles.revenueCard}>
      <Text style={styles.revenueCardLabel}>{label}</Text>
      <View style={styles.revenueCardRow}>
        <View>
          <Text style={styles.revenueCardMetricLabel}>Revenu</Text>
          <Text style={styles.revenueCardMetricValue}>{formatMAD(metrics?.revenueTotal ?? 0)}</Text>
        </View>
        <View>
          <Text style={styles.revenueCardMetricLabel}>Dépenses</Text>
          <Text style={[styles.revenueCardMetricValue, { color: AmkouyColors.error }]}>{formatMAD(metrics?.expenses ?? 0)}</Text>
        </View>
        <View>
          <Text style={styles.revenueCardMetricLabel}>Marge brute</Text>
          <Text style={[styles.revenueCardMetricValue, { color: AmkouyColors.success }]}>{formatMAD(metrics?.profit ?? 0)}</Text>
        </View>
      </View>
    </Card>
  );
}

function OccupancyCard({ label, snapshot }: { label: string; snapshot: { occupiedCount: number; availableCount: number; rate: number } }) {
  return (
    <Card style={styles.occupancyCard}>
      <OccupancyRing pct={Math.round(snapshot.rate)} size={62} strokeWidth={7} />
      <Text style={styles.occupancyCardLabel}>{label}</Text>
      <Text style={styles.occupancyCardMeta}>
        {snapshot.occupiedCount} occ. · {snapshot.availableCount} dispo.
      </Text>
    </Card>
  );
}

function healthColor(score: number): string {
  if (score >= 80) return AmkouyColors.success;
  if (score >= 60) return '#B45309';
  return AmkouyColors.error;
}

function PropertyStatusBadge({ status }: { status: keyof typeof PROPERTY_STATUS_LABEL }) {
  const colors = PROPERTY_STATUS_COLOR[status];
  return <Badge label={PROPERTY_STATUS_LABEL[status]} bg={colors.bg} color={colors.text} size="sm" />;
}

function AlertRow({ alert }: { alert: OperationsAlert }) {
  return (
    <Pressable onPress={() => router.push(alert.href as never)}>
      <View style={[styles.alertRow, alert.severity === 'urgent' && styles.alertRowUrgent]}>
        <Icon name={alert.severity === 'urgent' ? 'error' : 'warning'} size={20} color={alert.severity === 'urgent' ? '#B91C1C' : '#B45309'} />
        <View style={{ flex: 1 }}>
          <Text style={styles.alertRowTitle}>{alert.title}</Text>
          <Text style={styles.alertRowSubtitle}>{alert.subtitle}</Text>
        </View>
        <Icon name="chevron_right" size={20} color={AmkouyColors.textFainter} />
      </View>
    </Pressable>
  );
}

function CallButton({ phone }: { phone: string }) {
  return (
    <Pressable onPress={() => Linking.openURL(`tel:${phone}`)} hitSlop={8} style={styles.callButton}>
      <Icon name="call" size={15} color={AmkouyColors.success} />
    </Pressable>
  );
}

function CleanerTeamRow({ cleaner }: { cleaner: CleanerPerformance }) {
  return (
    <Card style={styles.teamRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.itemTitle}>{cleaner.fullName}</Text>
        <Text style={styles.itemSub}>
          {cleaner.assignedCount} assignées · {cleaner.completedCount} terminées · {cleaner.overdueCount} en retard
        </Text>
      </View>
      <Text style={styles.teamRowMetric}>{cleaner.completionRate != null ? `${cleaner.completionRate.toFixed(0)}%` : '—'}</Text>
    </Card>
  );
}

function TechnicianTeamRow({ technician }: { technician: TechnicianPerformance }) {
  return (
    <Card style={styles.teamRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.itemTitle}>{technician.fullName}</Text>
        <Text style={styles.itemSub}>
          {technician.assignedCount} assignés · {technician.openCount} ouverts · {technician.completedCount} terminés
        </Text>
      </View>
      <Text style={styles.teamRowMetric}>{technician.completionRate != null ? `${technician.completionRate.toFixed(0)}%` : '—'}</Text>
    </Card>
  );
}

function ProviderTeamRow({ provider }: { provider: ProviderPerformance }) {
  return (
    <Card style={styles.teamRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.itemTitle}>{provider.name}</Text>
        <Text style={styles.itemSub}>
          {provider.pendingCount} en attente · {provider.activeCount} actives · {provider.completedCount} terminées
        </Text>
      </View>
      <Text style={styles.teamRowMetric}>{formatMAD(provider.profit)}</Text>
    </Card>
  );
}

function RiskTile({ label, value }: { label: string; value: number }) {
  return (
    <View style={[styles.riskTile, value > 0 && styles.riskTileActive]}>
      <Text style={[styles.riskValue, value > 0 && styles.riskValueActive]}>{value}</Text>
      <Text style={styles.riskLabel}>{label}</Text>
    </View>
  );
}

function InsightTile({
  label,
  entry,
  format,
}: {
  label: string;
  entry: { name: string; value: number } | null;
  format: 'mad' | 'nights' | 'count';
}) {
  const valueText = !entry
    ? '—'
    : format === 'mad'
      ? formatMAD(entry.value)
      : format === 'nights'
        ? `${entry.value} nuits`
        : `${entry.value}`;
  return (
    <View style={styles.insightTile}>
      <Text style={styles.insightLabel}>{label}</Text>
      <Text style={styles.insightName}>{entry?.name ?? '—'}</Text>
      <Text style={styles.insightValue}>{valueText}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    ...robotoText(700, 17, { color: AmkouyColors.primary, paddingHorizontal: 22, marginTop: 24, marginBottom: 10 }),
  },
  subsectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    marginTop: 12,
    marginBottom: 6,
  },
  subsectionLabel: {
    ...robotoText(600, 13, { color: AmkouyColors.textMuted }),
  },
  subsectionLabelStandalone: {
    ...robotoText(600, 12.5, { color: AmkouyColors.textMuted, paddingHorizontal: 22, marginTop: 12, marginBottom: 6 }),
  },
  healthSection: {
    marginTop: 8,
  },
  healthCard: {
    marginHorizontal: 22,
    padding: 16,
  },
  healthScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  healthScoreRing: {
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
  healthBreakdownRow: {
    ...robotoText(500, 11.5, { color: AmkouyColors.textMuted, marginBottom: 4 }),
  },
  topRisksWrap: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: AmkouyColors.hairline,
    gap: 7,
  },
  topRisksTitle: {
    ...robotoText(700, 12, { color: AmkouyColors.primary, marginBottom: 2 }),
  },
  topRiskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  topRiskLabel: {
    ...robotoText(500, 12, { color: AmkouyColors.text, flex: 1 }),
  },
  topRiskValue: {
    ...robotoText(700, 13, { color: '#B45309' }),
  },
  subsectionCountPill: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: AmkouyColors.hairline,
  },
  subsectionCountText: {
    ...robotoText(700, 11, { color: AmkouyColors.textMuted }),
  },
  emptySectionText: {
    ...robotoText(400, 12.5, { color: AmkouyColors.textFaint, paddingHorizontal: 22 }),
  },
  itemList: {
    paddingHorizontal: 22,
    gap: 8,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    paddingHorizontal: 14,
  },
  itemTitle: {
    ...robotoText(600, 13.5, { color: AmkouyColors.text }),
  },
  itemSub: {
    ...robotoText(400, 11.5, { color: AmkouyColors.textFaint, marginTop: 1 }),
  },
  rowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  callButton: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#DEF7E6',
    alignItems: 'center',
    justifyContent: 'center',
  },

  alertSection: {
    marginTop: 8,
  },
  alertSectionTitle: {
    ...robotoText(700, 16, { color: '#B91C1C', paddingHorizontal: 22, marginBottom: 8 }),
  },
  alertList: {
    paddingHorizontal: 22,
    gap: 8,
  },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 13,
    backgroundColor: '#FFF8F0',
    borderWidth: 1,
    borderColor: '#F3E2C6',
  },
  alertRowUrgent: {
    backgroundColor: '#FDEBEB',
    borderColor: '#f7caca',
  },
  alertRowTitle: {
    ...robotoText(600, 12.5, { color: AmkouyColors.text }),
  },
  alertRowSubtitle: {
    ...robotoText(400, 11, { color: AmkouyColors.textFaint, marginTop: 1 }),
  },

  kpiRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 22,
  },
  kpiTile: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: AmkouyColors.hairline,
    borderRadius: 13,
    padding: 13,
    alignItems: 'center',
  },
  kpiValue: {
    ...robotoText(900, 20, {}),
  },
  kpiLabel: {
    ...robotoText(500, 10.5, { color: AmkouyColors.textFaint, marginTop: 2, textAlign: 'center' }),
  },

  execSummaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 22,
    marginBottom: 6,
  },
  execTile: {
    flexGrow: 0,
    flexBasis: '31%',
    width: '31%',
  },

  revenueGrid: {
    paddingHorizontal: 22,
    gap: 10,
  },
  revenueCard: {
    padding: 14,
  },
  revenueCardLabel: {
    ...robotoText(700, 12.5, { color: AmkouyColors.primary, marginBottom: 8 }),
  },
  revenueCardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  revenueCardMetricLabel: {
    ...robotoText(400, 10, { color: AmkouyColors.textFaint }),
  },
  revenueCardMetricValue: {
    ...robotoText(700, 14, { color: AmkouyColors.text, marginTop: 2 }),
  },

  occupancyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 22,
  },
  occupancyCard: {
    width: '47%',
    alignItems: 'center',
    padding: 14,
  },
  occupancyCardLabel: {
    ...robotoText(600, 12, { color: AmkouyColors.text, marginTop: 8 }),
  },
  occupancyCardMeta: {
    ...robotoText(400, 10.5, { color: AmkouyColors.textFaint, marginTop: 2 }),
  },

  teamList: {
    paddingHorizontal: 22,
    gap: 8,
  },
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    paddingHorizontal: 14,
  },
  teamRowMetric: {
    ...robotoText(700, 14, { color: AmkouyColors.primary }),
  },

  riskGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 22,
  },
  riskTile: {
    width: '31%',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: AmkouyColors.hairline,
    borderRadius: 12,
    padding: 11,
    alignItems: 'center',
  },
  riskTileActive: {
    backgroundColor: '#FDEBEB',
    borderColor: '#f7caca',
  },
  riskValue: {
    ...robotoText(900, 18, { color: AmkouyColors.text }),
  },
  riskValueActive: {
    color: '#B91C1C',
  },
  riskLabel: {
    ...robotoText(500, 9.5, { color: AmkouyColors.textFaint, marginTop: 2, textAlign: 'center' }),
  },

  insightGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 22,
  },
  insightTile: {
    width: '47%',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: AmkouyColors.hairline,
    borderRadius: 13,
    padding: 12,
  },
  insightLabel: {
    ...robotoText(500, 10, { color: AmkouyColors.textFaint }),
  },
  insightName: {
    ...robotoText(700, 13, { color: AmkouyColors.text, marginTop: 3 }),
  },
  insightValue: {
    ...robotoText(700, 13, { color: AmkouyColors.secondary, marginTop: 2 }),
  },

  timelineWrap: {
    paddingHorizontal: 22,
    paddingBottom: 30,
  },
});

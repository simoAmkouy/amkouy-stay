import { router } from 'expo-router';
import { useMemo } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { AccessGuard } from '@/components/amkouy/access-guard';
import { Badge } from '@/components/amkouy/badge';
import { Card } from '@/components/amkouy/card';
import { EmptyState } from '@/components/amkouy/empty-state';
import { ErrorState } from '@/components/amkouy/error-state';
import { HeroHeader } from '@/components/amkouy/hero-header';
import { LoadingState } from '@/components/amkouy/loading-state';
import { Screen } from '@/components/amkouy/screen';
import { Icon } from '@/components/icon';
import { AmkouyColors } from '@/constants/amkouy-theme';
import { robotoText } from '@/constants/typography';
import { useAuth } from '@/hooks/use-auth';
import { useContractDocuments, useMyContracts } from '@/hooks/use-contracts';
import { useMaintenanceTickets } from '@/hooks/use-maintenance-tickets';
import { useNotifications } from '@/hooks/use-notifications';
import { useMyOwnerId } from '@/hooks/use-owners';
import { useOwnerPayments } from '@/hooks/use-owner-payments';
import { useProperties } from '@/hooks/use-properties';
import { usePropertyActivationStatus } from '@/hooks/use-property-activation';
import { useUpcomingCheckouts, useUpcomingReservations } from '@/hooks/use-reservations';
import { useOwnerStatement } from '@/hooks/use-reports';
import { getAttachmentSignedUrl } from '@/lib/storage';
import { MaintenanceStatus } from '@/lib/queries/maintenance-tickets';
import { computeDisplayStatus, DisplayStatus } from '@/lib/queries/owner-payments';
import { ActivationStage } from '@/lib/queries/property-activation';
import { DISPLAY_STATUS_OPTIONS } from '@/lib/validation/owner-payment';
import { CONTRACT_STATUS_OPTIONS, PAYOUT_SCHEDULE_OPTIONS } from '@/lib/validation/contract';
import { MAINTENANCE_STATUS_OPTIONS } from '@/lib/validation/maintenance-ticket';
import { computeRangeForFilter, formatRangeLabel } from '@/utils/date-range';
import { formatMAD } from '@/utils/format';

const CONTRACT_STATUS_LABEL = Object.fromEntries(CONTRACT_STATUS_OPTIONS.map((o) => [o.value, o.label]));
const PAYOUT_SCHEDULE_LABEL = Object.fromEntries(PAYOUT_SCHEDULE_OPTIONS.map((o) => [o.value, o.label]));

const STATUS_LABEL = Object.fromEntries(DISPLAY_STATUS_OPTIONS.map((o) => [o.value, o.label]));
const STATUS_COLOR: Record<DisplayStatus, { bg: string; text: string }> = {
  upcoming: { bg: '#E3E9F4', text: '#1E3A6E' },
  due: { bg: '#F8EFD4', text: '#8a6d1c' },
  overdue: { bg: '#FAD9D9', text: '#B91C1C' },
  approved: { bg: '#E4E9FA', text: '#3730A3' },
  paid: { bg: '#DEF7E6', text: '#15803D' },
  cancelled: { bg: '#EEF0F4', text: '#5A5E66' },
};

const MAINTENANCE_STATUS_LABEL = Object.fromEntries(MAINTENANCE_STATUS_OPTIONS.map((o) => [o.value, o.label]));
const MAINTENANCE_STATUS_COLOR: Record<MaintenanceStatus, { bg: string; text: string }> = {
  open: { bg: '#E3E9F4', text: '#1E3A6E' },
  assigned: { bg: '#EEEAFB', text: '#6D4FC9' },
  in_progress: { bg: '#FDEBC8', text: '#B45309' },
  on_hold: { bg: '#F8EFD4', text: '#8a6d1c' },
  resolved: { bg: '#DEF7E6', text: '#15803D' },
  closed: { bg: '#DDEEFB', text: '#0C5C8A' },
  cancelled: { bg: '#FAD9D9', text: '#B91C1C' },
};
const OPEN_MAINTENANCE_STATUSES = new Set(['open', 'assigned', 'in_progress', 'on_hold']);

// Module 11 — owner-visible step labels only. No internal notes, no staff assignments, no
// commercial-agent attribution, no profitability: `usePropertyActivationStatus` never returns
// any of that (see PropertyActivationStatus in property-activation.ts).
const OWNER_ACTIVATION_STAGE_LABEL: Record<ActivationStage, string> = {
  contract_pending: 'Contrat en attente de signature',
  photos_pending: 'Photos en attente',
  property_setup_pending: 'Fiche du bien à compléter',
  pricing_pending: 'Tarification à configurer',
  ready_for_activation: 'Prêt à activer',
  active: 'Activé',
};

export default function OwnerPortalScreen() {
  return (
    <AccessGuard resource="owner_portal">
      <OwnerPortalContent />
    </AccessGuard>
  );
}

function OwnerPortalContent() {
  const { profile } = useAuth();
  // RLS already restricts owner_payments/maintenance_tickets to the signed-in owner's own
  // properties (owns_property()) — no extra filter needed on either query.
  const { data: payments, isLoading, isError, refetch } = useOwnerPayments();
  const { data: maintenanceTickets } = useMaintenanceTickets();
  // Column-restricted projection (no commission_pct/terms) — see contracts.ts, listMyContracts.
  const { data: contracts } = useMyContracts();
  // Module 8, Phase 7: owner reporting. `getOwnerStatement` is SECURITY INVOKER — RLS on every
  // underlying table restricts the aggregate to this owner's own data regardless of the id
  // passed in, so no separate "owner reporting" permission system is needed.
  const { data: myOwnerId } = useMyOwnerId(profile?.id);
  const thisMonthRange = useMemo(() => computeRangeForFilter('this_month'), []);
  const {
    data: myStatement,
    isLoading: statementLoading,
    isError: statementError,
    refetch: refetchStatement,
  } = useOwnerStatement(myOwnerId ?? undefined, thisMonthRange);
  // Module 11: RLS-scoped (owns_property()) — an owner calling useProperties() only ever gets
  // their own properties back, same guarantee already relied on for payments/maintenance above.
  const { data: myProperties } = useProperties();
  const onboardingProperties = (myProperties ?? []).filter((p) => p.status === 'onboarding');
  const { data: upcomingReservations } = useUpcomingReservations();
  const { data: upcomingDepartures } = useUpcomingCheckouts();
  const { data: notifications } = useNotifications();
  const unreadNotificationsCount = (notifications ?? []).filter((n) => !n.read_at).length;

  const maintenanceSummary = useMemo(() => {
    const tickets = maintenanceTickets ?? [];
    const openCount = tickets.filter((t) => OPEN_MAINTENANCE_STATUSES.has(t.status)).length;
    const totalCost = tickets.reduce((sum, t) => sum + (t.actual_cost ?? t.estimated_cost ?? 0), 0);
    return { tickets, openCount, totalCost };
  }, [maintenanceTickets]);

  const summary = useMemo(() => {
    let totalEarned = 0;
    let totalPaid = 0;
    let pending = 0;
    let nextDueDate: string | null = null;
    // CB-12 (Launch Readiness Audit): totalEarned used to sum every payment unconditionally while
    // totalPaid/pending both already skipped cancelled rows — an owner with any cancelled
    // settlement saw a "Total gagné" that didn't reconcile with the Paid + Pending breakdown right
    // below it, with no explanation. Cancelled settlements never happened financially, so they're
    // excluded from all three figures now, the same way they already were from the other two.
    for (const p of payments ?? []) {
      if (p.status === 'cancelled') continue;
      totalEarned += p.net_amount;
      if (p.status === 'paid') totalPaid += p.net_amount;
      else {
        pending += p.net_amount;
        if (p.due_date && (!nextDueDate || p.due_date < nextDueDate)) nextDueDate = p.due_date;
      }
    }
    return { totalEarned, totalPaid, pending, nextDueDate };
  }, [payments]);

  return (
    <Screen contentPadding={false}>
      <HeroHeader showBack fallbackHref="/more" gradient>
        <View style={styles.headerTop}>
          <View style={styles.portalChip}>
            <Text style={styles.portalChipText}>PORTAIL PROPRIÉTAIRE</Text>
          </View>
          <Pressable onPress={() => router.push('/more/notifications')} style={styles.bell}>
            <Icon name="notifications" size={22} color="#fff" />
            {unreadNotificationsCount > 0 && (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>{unreadNotificationsCount}</Text>
              </View>
            )}
          </Pressable>
        </View>
        <View style={styles.welcome}>
          <Text style={styles.welcomeLabel}>Bienvenue,</Text>
          <Text style={styles.welcomeName}>{profile?.full_name ?? '—'}</Text>
        </View>
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Total gagné</Text>
            <Text style={styles.statValue}>{formatMAD(summary.totalEarned)}</Text>
          </View>
          <View style={[styles.statBox, styles.statBoxGold]}>
            <Text style={[styles.statLabel, { color: '#e8d6a4' }]}>Net versé</Text>
            <Text style={[styles.statValue, { color: AmkouyColors.secondary }]}>
              {formatMAD(summary.totalPaid)}
            </Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>En attente</Text>
            <Text style={styles.statValue}>{formatMAD(summary.pending)}</Text>
          </View>
        </View>
        {!!summary.nextDueDate && (
          <Text style={styles.nextPayment}>Prochain versement prévu le {summary.nextDueDate}</Text>
        )}
      </HeroHeader>

      <View style={styles.content}>
        <Text style={styles.sectionTitle}>Réservations à venir</Text>
        {(upcomingReservations ?? []).length === 0 ? (
          <EmptyState icon="event_available" message="Aucune réservation à venir." />
        ) : (
          <View style={styles.list}>
            {(upcomingReservations ?? []).map((res) => (
              <Card key={res.id} style={styles.reservationRow}>
                <Icon name="event_available" size={20} color={AmkouyColors.success} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.reservationProperty}>{res.property?.name ?? '—'}</Text>
                  <Text style={styles.reservationDates}>
                    {res.check_in_date} → {res.check_out_date}
                  </Text>
                </View>
                <Text style={styles.reservationAmount}>{formatMAD(res.total_amount)}</Text>
              </Card>
            ))}
          </View>
        )}

        <Text style={styles.sectionTitle}>Départs à venir</Text>
        {(upcomingDepartures ?? []).length === 0 ? (
          <EmptyState icon="event_busy" message="Aucun départ à venir." />
        ) : (
          <View style={styles.list}>
            {(upcomingDepartures ?? []).map((res) => (
              <Card key={res.id} style={styles.reservationRow}>
                <Icon name="event_busy" size={20} color={AmkouyColors.error} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.reservationProperty}>{res.property?.name ?? '—'}</Text>
                  <Text style={styles.reservationDates}>
                    {res.check_in_date} → {res.check_out_date}
                  </Text>
                </View>
                <Text style={styles.reservationAmount}>{formatMAD(res.total_amount)}</Text>
              </Card>
            ))}
          </View>
        )}

        {onboardingProperties.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Activation de mon bien</Text>
            <Card style={styles.statementsCard}>
              {onboardingProperties.map((property, index) => (
                <OwnerActivationRow
                  key={property.id}
                  propertyId={property.id}
                  propertyName={property.name}
                  border={index < onboardingProperties.length - 1}
                />
              ))}
            </Card>
          </>
        )}

        <Text style={styles.sectionTitle}>Mon relevé ({formatRangeLabel(thisMonthRange)})</Text>
        {statementLoading && <LoadingState label="Chargement de votre relevé…" />}
        {statementError && <ErrorState message="Impossible de charger votre relevé." onRetry={refetchStatement} />}
        {!statementLoading && !statementError && myStatement && (
          <Card style={styles.statementCard}>
            <View style={styles.statementStatRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.statementStatLabel}>Revenu net</Text>
                <Text style={styles.statementStatValue}>{formatMAD(myStatement.netRevenue)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.statementStatLabel}>Ma part</Text>
                <Text style={styles.statementStatValue}>{formatMAD(myStatement.ownerShare)}</Text>
              </View>
            </View>
            <View style={styles.statementStatRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.statementStatLabel}>Réservations</Text>
                <Text style={styles.statementStatValueSmall}>{myStatement.reservationsCount}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.statementStatLabel}>Occupation</Text>
                <Text style={styles.statementStatValueSmall}>{myStatement.occupancyRate}%</Text>
              </View>
            </View>
          </Card>
        )}
        {!statementLoading && !statementError && !myStatement && (
          <EmptyState icon="receipt_long" message="Aucune donnée de relevé pour cette période." />
        )}

        <Text style={styles.sectionTitle}>Mes versements</Text>
        {isLoading && <LoadingState label="Chargement des versements…" />}
        {isError && <ErrorState message="Impossible de charger vos versements." onRetry={refetch} />}
        {!isLoading && !isError && (payments ?? []).length === 0 && (
          <EmptyState icon="account_balance_wallet" message="Aucun versement enregistré pour le moment." />
        )}
        {!isLoading && !isError && (payments ?? []).length > 0 && (
          <Card style={styles.statementsCard}>
            {(payments ?? []).map((payment, index) => {
              const displayStatus = computeDisplayStatus(payment);
              const colors = STATUS_COLOR[displayStatus];
              return (
                <View
                  key={payment.id}
                  style={[
                    styles.statementRow,
                    index < (payments?.length ?? 0) - 1 && styles.statementRowBorder,
                  ]}>
                  <Icon name="account_balance_wallet" size={22} color={colors.text} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.statementMonth}>
                      {payment.period_start} → {payment.period_end}
                    </Text>
                    <Text style={styles.statementAmount}>{formatMAD(payment.net_amount)}</Text>
                    {payment.is_manual_adjustment && <Text style={styles.manualAdjustmentText}>Ajustement manuel</Text>}
                  </View>
                  <Badge label={STATUS_LABEL[displayStatus] ?? displayStatus} bg={colors.bg} color={colors.text} />
                </View>
              );
            })}
          </Card>
        )}

        <Text style={styles.sectionTitle}>Mes contrats</Text>
        {(contracts ?? []).length === 0 ? (
          <EmptyState icon="description" message="Aucun contrat enregistré." />
        ) : (
          <Card style={styles.statementsCard}>
            {(contracts ?? []).map((contract, index) => (
              <OwnerContractRow
                key={contract.id}
                contract={contract}
                border={index < (contracts?.length ?? 0) - 1}
              />
            ))}
          </Card>
        )}

        <Text style={styles.sectionTitle}>Maintenance</Text>
        <View style={styles.maintenanceSummaryRow}>
          <View style={styles.maintenanceStatBox}>
            <Text style={styles.maintenanceStatValue}>{maintenanceSummary.openCount}</Text>
            <Text style={styles.maintenanceStatLabel}>Problèmes ouverts</Text>
          </View>
          <View style={styles.maintenanceStatBox}>
            <Text style={styles.maintenanceStatValue}>{formatMAD(maintenanceSummary.totalCost)}</Text>
            <Text style={styles.maintenanceStatLabel}>Coût total</Text>
          </View>
        </View>
        {maintenanceSummary.tickets.length === 0 ? (
          <EmptyState icon="build" message="Aucun problème de maintenance signalé." />
        ) : (
          <Card style={styles.statementsCard}>
            {maintenanceSummary.tickets.map((ticket, index) => {
              const colors = MAINTENANCE_STATUS_COLOR[ticket.status];
              return (
                <View
                  key={ticket.id}
                  style={[
                    styles.statementRow,
                    index < maintenanceSummary.tickets.length - 1 && styles.statementRowBorder,
                  ]}>
                  <Icon name="build" size={22} color={colors.text} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.statementMonth}>{ticket.issue_summary}</Text>
                    <Text style={styles.statementAmount}>{ticket.property?.name ?? '—'}</Text>
                  </View>
                  <Badge label={MAINTENANCE_STATUS_LABEL[ticket.status] ?? ticket.status} bg={colors.bg} color={colors.text} />
                </View>
              );
            })}
          </Card>
        )}

        <View style={styles.contactButton}>
          <Icon name="support_agent" size={21} color={AmkouyColors.primary} />
          <Text style={styles.contactButtonText}>Contacter mon gestionnaire</Text>
        </View>
      </View>
    </Screen>
  );
}

/** Owner-visible fields only: contract dates, property, payout schedule, PDF. No commission_pct,
 * no terms — see the Owner Portal Rule note on `listMyContracts`. */
function OwnerContractRow({
  contract,
  border,
}: {
  contract: { id: string; contract_number: string; status: string; start_date: string; end_date: string | null; payout_schedule: string; property: { name: string; city: string } | null };
  border: boolean;
}) {
  const { data: documents } = useContractDocuments(contract.id);
  const pdf = documents?.[0] ?? null;

  const handleOpenPdf = async () => {
    if (!pdf) return;
    const signedUrl = await getAttachmentSignedUrl(pdf.file_url);
    if (signedUrl) Linking.openURL(signedUrl);
  };

  return (
    <View style={[styles.statementRow, border && styles.statementRowBorder]}>
      <Icon name="description" size={22} color={AmkouyColors.primaryContainer} />
      <View style={{ flex: 1 }}>
        <Text style={styles.statementMonth}>{contract.property?.name ?? '—'}</Text>
        <Text style={styles.statementAmount}>
          {contract.start_date} → {contract.end_date ?? 'Sans échéance'} · {PAYOUT_SCHEDULE_LABEL[contract.payout_schedule] ?? contract.payout_schedule}
        </Text>
        {pdf && (
          <Pressable onPress={handleOpenPdf} style={{ marginTop: 4 }}>
            <Text style={styles.contractPdfLink}>Voir le PDF du contrat</Text>
          </Pressable>
        )}
      </View>
      <Badge label={CONTRACT_STATUS_LABEL[contract.status] ?? contract.status} bg="#E3E9F4" color={AmkouyColors.primaryContainer} />
    </View>
  );
}

/** Owner-visible activation progress: percentage + current step only — no internal notes, staff
 * assignments, commercial-agent attribution, or profitability (none of that is ever part of
 * `PropertyActivationStatus`, so there's nothing to filter out here). */
function OwnerActivationRow({ propertyId, propertyName, border }: { propertyId: string; propertyName: string; border: boolean }) {
  const { data: activation } = usePropertyActivationStatus(propertyId);
  return (
    <View style={[styles.statementRow, border && styles.statementRowBorder]}>
      <Icon name="rocket_launch" size={22} color={AmkouyColors.primaryContainer} />
      <View style={{ flex: 1 }}>
        <Text style={styles.statementMonth}>{propertyName}</Text>
        <Text style={styles.statementAmount}>
          {activation ? OWNER_ACTIVATION_STAGE_LABEL[activation.computedStage] : 'Chargement…'}
        </Text>
        {activation && (
          <View style={styles.activationProgressTrack}>
            <View style={[styles.activationProgressFill, { width: `${activation.activationScore}%` }]} />
          </View>
        )}
      </View>
      {activation && <Badge label={`${activation.activationScore}%`} bg="#E3E9F4" color={AmkouyColors.primaryContainer} />}
    </View>
  );
}

const styles = StyleSheet.create({
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bell: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBadge: {
    position: 'absolute',
    top: 4,
    right: 5,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: AmkouyColors.error,
    borderWidth: 2,
    borderColor: AmkouyColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  bellBadgeText: {
    ...robotoText(700, 8.5, { color: '#fff' }),
  },
  portalChip: {
    backgroundColor: 'rgba(201,168,76,.25)',
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,.4)',
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  portalChipText: {
    ...robotoText(700, 10, { color: AmkouyColors.secondary }),
  },
  welcome: {
    marginTop: 16,
  },
  welcomeLabel: {
    ...robotoText(400, 13, { color: AmkouyColors.onPrimaryMuted }),
  },
  welcomeName: {
    ...robotoText(700, 24, { color: '#fff', marginTop: 2 }),
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  statBox: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,.08)',
    borderRadius: 13,
    padding: 13,
  },
  statBoxGold: {
    backgroundColor: 'rgba(201,168,76,.18)',
  },
  nextPayment: {
    ...robotoText(500, 11.5, { color: AmkouyColors.onPrimaryMuted, marginTop: 12 }),
  },
  statLabel: {
    ...robotoText(400, 10.5, { color: AmkouyColors.onPrimaryMuted }),
  },
  statValue: {
    ...robotoText(900, 18, { color: '#fff', marginTop: 4 }),
  },
  content: {
    padding: 22,
    paddingTop: 18,
  },
  sectionTitle: {
    ...robotoText(700, 15, { color: AmkouyColors.primary, marginBottom: 10 }),
  },
  list: {
    gap: 8,
  },
  reservationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    padding: 11,
    paddingHorizontal: 14,
  },
  reservationProperty: {
    ...robotoText(600, 13, { color: AmkouyColors.text }),
  },
  reservationDates: {
    ...robotoText(400, 11, { color: AmkouyColors.textFaint, marginTop: 1 }),
  },
  reservationAmount: {
    ...robotoText(700, 12.5, { color: AmkouyColors.primary }),
  },
  statementsCard: {
    marginTop: 22,
    overflow: 'hidden',
  },
  maintenanceSummaryRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  maintenanceStatBox: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: AmkouyColors.hairline,
    borderRadius: 14,
    padding: 13,
  },
  maintenanceStatValue: {
    ...robotoText(900, 17, { color: AmkouyColors.text }),
  },
  maintenanceStatLabel: {
    ...robotoText(400, 10.5, { color: AmkouyColors.textFaint, marginTop: 2 }),
  },
  statementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 13,
    paddingHorizontal: 15,
  },
  statementRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: AmkouyColors.hairline,
  },
  statementMonth: {
    ...robotoText(500, 13, { color: AmkouyColors.text }),
  },
  statementAmount: {
    ...robotoText(400, 10.5, { color: AmkouyColors.textFainter }),
  },
  manualAdjustmentText: {
    ...robotoText(600, 9.5, { color: '#B45309', marginTop: 2 }),
  },
  contractPdfLink: {
    ...robotoText(600, 11, { color: AmkouyColors.primary, textDecorationLine: 'underline' }),
  },
  activationProgressTrack: {
    height: 5,
    borderRadius: 3,
    backgroundColor: AmkouyColors.hairline,
    marginTop: 6,
    overflow: 'hidden',
  },
  activationProgressFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: AmkouyColors.primaryContainer,
  },
  statementCard: {
    padding: 16,
    gap: 14,
  },
  statementStatRow: {
    flexDirection: 'row',
    gap: 16,
  },
  statementStatLabel: {
    ...robotoText(400, 11, { color: AmkouyColors.textFaint }),
  },
  statementStatValue: {
    ...robotoText(700, 18, { color: AmkouyColors.primary, marginTop: 2 }),
  },
  statementStatValueSmall: {
    ...robotoText(700, 14, { color: AmkouyColors.text, marginTop: 2 }),
  },
  contactButton: {
    marginTop: 18,
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: AmkouyColors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  contactButtonText: {
    ...robotoText(600, 14, { color: AmkouyColors.primary }),
  },
});

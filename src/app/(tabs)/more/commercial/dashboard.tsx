import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AccessGuard } from '@/components/amkouy/access-guard';
import { Badge } from '@/components/amkouy/badge';
import { Card } from '@/components/amkouy/card';
import { DateFilterBar } from '@/components/amkouy/date-filter-bar';
import { EmptyState } from '@/components/amkouy/empty-state';
import { ErrorState } from '@/components/amkouy/error-state';
import { LoadingState } from '@/components/amkouy/loading-state';
import { Screen } from '@/components/amkouy/screen';
import { ScreenHeader } from '@/components/amkouy/screen-header';
import { AmkouyColors } from '@/constants/amkouy-theme';
import { robotoText } from '@/constants/typography';
import { useAuth } from '@/hooks/use-auth';
import { useCommercialLeads } from '@/hooks/use-commercial-leads';
import { DateFilterProvider, useDateFilter } from '@/hooks/use-date-filter';
import { useCommercialAgentKpis, useCommercialSourcePerformance } from '@/hooks/use-commercial-kpis';
import { useActivationCenterSummary } from '@/hooks/use-property-activation';
import { REPORT_QUICK_FILTERS, formatRangeLabel, toDateOnlyString } from '@/utils/date-range';
import { formatMAD } from '@/utils/format';

const NOT_CONTACTED_DAYS_THRESHOLD = 3;

export default function CommercialDashboardScreen() {
  return (
    <AccessGuard resource="commercial_dashboard">
      <DateFilterProvider initialFilter="this_month">
        <CommercialDashboardContent />
      </DateFilterProvider>
    </AccessGuard>
  );
}

function CommercialDashboardContent() {
  const { profile } = useAuth();
  const { range } = useDateFilter();
  const startIso = toDateOnlyString(range.start);
  const endIso = toDateOnlyString(range.end);
  const { data: kpis, isLoading, isError, refetch } = useCommercialAgentKpis(profile?.id, startIso, endIso);
  const { data: sources } = useCommercialSourcePerformance(startIso, endIso);
  // Module 11: "Read onboarding status of properties they acquired" — client-filtered to this
  // agent's own acquisitions off the shared summary RPC, never the cross-agent Activation Center.
  const { data: activationProperties } = useActivationCenterSummary();
  const myOnboardingProperties = (activationProperties ?? []).filter((p) => p.acquiredByAgent === profile?.id);
  // My Leads (Phase 7): `commercial_leads_select` RLS already scopes this to the agent's own
  // assignments, so no extra `assigned_to` filter is needed here — same guarantee the query
  // comment on `listCommercialLeads` documents.
  const { data: myLeads } = useCommercialLeads();
  const leadsWorklist = useMemo(() => {
    const leads = myLeads ?? [];
    const now = new Date().getTime();
    return {
      newLeads: leads.filter((l) => l.status === 'new'),
      notContactedRecently: leads.filter(
        (l) => l.status !== 'won' && l.status !== 'lost' && (now - new Date(l.updated_at).getTime()) / 86_400_000 >= NOT_CONTACTED_DAYS_THRESHOLD
      ),
      needingFollowUp: leads.filter((l) => ['contacted', 'visit_scheduled', 'proposal_sent', 'negotiation'].includes(l.status)),
      upcomingVisits: leads.filter((l) => l.status === 'visit_scheduled'),
      activeNegotiations: leads.filter((l) => l.status === 'negotiation'),
    };
  }, [myLeads]);

  if (isLoading || !kpis) return <LoadingState label="Calcul de vos performances…" />;
  if (isError) return <ErrorState message="Impossible de charger votre tableau de bord." onRetry={refetch} />;

  const topSource = [...(sources ?? [])].sort((a, b) => b.ownerLeadsWon + b.guestLeadsConfirmed - (a.ownerLeadsWon + a.guestLeadsConfirmed))[0];

  return (
    <Screen>
      <ScreenHeader title="Mon tableau de bord" subtitle={formatRangeLabel(range)} showBack fallbackHref="/more/commercial" />
      <DateFilterBar filters={REPORT_QUICK_FILTERS} />

      <View style={styles.content}>
        <View style={styles.kpiGrid}>
          <KpiTile label="Propriétés acquises" value={String(kpis.propertiesAcquired)} color={AmkouyColors.success} />
          <KpiTile label="Propriétés activées" value={String(kpis.propertiesActivated)} color={AmkouyColors.success} />
          <KpiTile label="Taux d'activation" value={`${kpis.activationRate}%`} color={AmkouyColors.primaryContainer} />
          <KpiTile label="Réservations générées" value={String(kpis.reservationsGenerated)} color={AmkouyColors.primaryContainer} />
          <KpiTile label="Revenu généré" value={formatMAD(kpis.revenueGenerated)} color={AmkouyColors.text} />
          <KpiTile label="Nuits générées" value={String(kpis.nightsGenerated)} />
          <KpiTile label="Commissions en attente" value={formatMAD(kpis.commissionsPending)} color="#B45309" />
          <KpiTile label="Commissions payées" value={formatMAD(kpis.commissionsPaid)} color={AmkouyColors.success} />
          <KpiTile label="Taux de conversion" value={`${kpis.conversionRate}%`} />
          <KpiTile label="Meilleure source" value={topSource?.source ?? '—'} />
        </View>

        <Text style={styles.sectionTitle}>Mes leads (période)</Text>
        <View style={styles.kpiGrid}>
          <KpiTile label="Total" value={String(kpis.leadsTotal)} />
          <KpiTile label="Gagnés" value={String(kpis.leadsWon)} color={AmkouyColors.success} />
          <KpiTile label="Perdus" value={String(kpis.leadsLost)} color={AmkouyColors.error} />
        </View>

        <Text style={styles.sectionTitle}>Mes leads — à traiter</Text>
        <View style={styles.kpiGrid}>
          <KpiTile label="Nouveaux" value={String(leadsWorklist.newLeads.length)} color={AmkouyColors.primaryContainer} />
          <KpiTile label="Non contactés 3j+" value={String(leadsWorklist.notContactedRecently.length)} color={AmkouyColors.error} />
          <KpiTile label="À relancer" value={String(leadsWorklist.needingFollowUp.length)} color="#B45309" />
          <KpiTile label="Visites planifiées" value={String(leadsWorklist.upcomingVisits.length)} />
          <KpiTile label="Négociations actives" value={String(leadsWorklist.activeNegotiations.length)} color="#8a6d1c" />
        </View>
        {leadsWorklist.notContactedRecently.length === 0 ? (
          <EmptyState icon="task_alt" message="Aucun lead sans contact depuis 3 jours ou plus." />
        ) : (
          <View style={styles.list}>
            {leadsWorklist.notContactedRecently.slice(0, 8).map((lead) => (
              <Pressable key={lead.id} onPress={() => router.push(`/more/commercial/leads/${lead.id}`)}>
                <Card style={styles.propertyRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.propertyName}>{lead.owner_name}</Text>
                    <Text style={styles.propertySub}>
                      {lead.city ?? '—'} · dernier contact {new Date(lead.updated_at).toLocaleDateString('fr-FR')}
                    </Text>
                  </View>
                  <Badge label="À relancer" bg="#FDEBC8" color="#B45309" size="sm" />
                </Card>
              </Pressable>
            ))}
          </View>
        )}

        {myOnboardingProperties.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Mes biens en onboarding</Text>
            <View style={styles.list}>
              {myOnboardingProperties.map((p) => (
                <Card key={p.propertyId} style={styles.propertyRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.propertyName}>{p.propertyName}</Text>
                    <Text style={styles.propertySub}>
                      {p.city ?? '—'} · {p.activationScore}% · {p.daysInOnboarding} j
                    </Text>
                  </View>
                  <Badge label={p.isReady ? 'Prêt à activer' : 'En cours'} bg={p.isReady ? '#DEF7E6' : '#E3E9F4'} color={p.isReady ? AmkouyColors.success : AmkouyColors.primaryContainer} size="sm" />
                </Card>
              ))}
            </View>
          </>
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

const styles = StyleSheet.create({
  content: { padding: 22, paddingTop: 8 },
  sectionTitle: { ...robotoText(700, 15, { color: AmkouyColors.primary, marginTop: 22, marginBottom: 10 }) },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  kpiTile: { flexGrow: 0, flexBasis: '31%', width: '31%', backgroundColor: '#fff', borderWidth: 1, borderColor: AmkouyColors.hairline, borderRadius: 14, padding: 12 },
  kpiValue: { ...robotoText(700, 15, { color: AmkouyColors.text }) },
  kpiLabel: { ...robotoText(400, 10, { color: AmkouyColors.textFaint, marginTop: 3 }) },
  list: { gap: 8 },
  propertyRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, paddingHorizontal: 14 },
  propertyName: { ...robotoText(600, 13, { color: AmkouyColors.text }) },
  propertySub: { ...robotoText(400, 11, { color: AmkouyColors.textFaint, marginTop: 2 }) },
});

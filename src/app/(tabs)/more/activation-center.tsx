import { router } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AccessGuard } from '@/components/amkouy/access-guard';
import { Badge } from '@/components/amkouy/badge';
import { Card } from '@/components/amkouy/card';
import { EmptyState } from '@/components/amkouy/empty-state';
import { ErrorState } from '@/components/amkouy/error-state';
import { LoadingState } from '@/components/amkouy/loading-state';
import { Screen } from '@/components/amkouy/screen';
import { ScreenHeader } from '@/components/amkouy/screen-header';
import { AmkouyColors } from '@/constants/amkouy-theme';
import { robotoText } from '@/constants/typography';
import { useAuth } from '@/hooks/use-auth';
import { useActivationCenterSummary, useOnboardingDashboardMetrics, useSyncStaleOnboardingNotifications } from '@/hooks/use-property-activation';
import { ActivationCenterEntry, ActivationStage } from '@/lib/queries/property-activation';
import { toDateOnlyString } from '@/utils/date-range';

const STAGE_LABEL: Record<ActivationStage, string> = {
  contract_pending: 'Contrat en attente',
  photos_pending: 'Photos en attente',
  property_setup_pending: 'Fiche incomplète',
  pricing_pending: 'Tarification en attente',
  ready_for_activation: 'Prêt à activer',
  active: 'Activé',
};
const STAGE_COLOR: Record<ActivationStage, { bg: string; text: string }> = {
  contract_pending: { bg: '#FAD9D9', text: '#B91C1C' },
  photos_pending: { bg: '#FDEBC8', text: '#B45309' },
  property_setup_pending: { bg: '#FDEBC8', text: '#B45309' },
  pricing_pending: { bg: '#F8EFD4', text: '#8a6d1c' },
  ready_for_activation: { bg: '#DEF7E6', text: '#15803D' },
  active: { bg: '#DEF7E6', text: '#15803D' },
};

const STAGE_ORDER: ActivationStage[] = ['contract_pending', 'photos_pending', 'property_setup_pending', 'pricing_pending', 'ready_for_activation'];

export default function ActivationCenterScreen() {
  return (
    <AccessGuard resource="property_activation">
      <ActivationCenterContent />
    </AccessGuard>
  );
}

function ActivationCenterContent() {
  const { profile } = useAuth();
  const isStaff = profile?.role === 'admin' || profile?.role === 'super_admin' || profile?.role === 'manager';
  const { data: properties, isLoading, isError, refetch } = useActivationCenterSummary();
  const today = new Date();
  const monthStart = toDateOnlyString(new Date(today.getFullYear(), today.getMonth(), 1));
  const monthEnd = toDateOnlyString(new Date(today.getFullYear(), today.getMonth() + 1, 0));
  const { data: metrics } = useOnboardingDashboardMetrics(monthStart, monthEnd);
  const syncStale = useSyncStaleOnboardingNotifications();

  useEffect(() => {
    if (isStaff && properties && properties.length > 0) {
      syncStale.mutate(properties);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStaff, properties]);

  if (isLoading) return <LoadingState label="Chargement du centre d'activation…" />;
  if (isError) return <ErrorState message="Impossible de charger le centre d'activation." onRetry={refetch} />;

  const byStage = (stage: ActivationStage) => (properties ?? []).filter((p) => p.computedStage === stage);

  return (
    <Screen>
      <ScreenHeader title="Centre d'activation" subtitle="Pipeline d'onboarding des biens" showBack fallbackHref="/more" />

      {metrics && (
        <View style={styles.kpiGrid}>
          <KpiTile label="En onboarding" value={metrics.propertiesInOnboarding} />
          <KpiTile label="Prêts à activer" value={metrics.readyToActivate} color={AmkouyColors.success} />
          <KpiTile label="Activés ce mois" value={metrics.activatedThisPeriod} color={AmkouyColors.primaryContainer} />
          <KpiTile label="Bloqués" value={metrics.blockedProperties} color={AmkouyColors.error} />
          <KpiTile label="Taux d'activation" value={`${metrics.activationRate}%`} />
          <KpiTile label="Délai moyen" value={metrics.avgActivationDays != null ? `${metrics.avgActivationDays}j` : '—'} />
        </View>
      )}

      {(properties ?? []).length === 0 && <EmptyState icon="villa" message="Aucun bien en cours d'onboarding." />}

      {STAGE_ORDER.map((stage) => {
        const items = byStage(stage);
        if (items.length === 0) return null;
        return (
          <View key={stage}>
            <View style={styles.subsectionRow}>
              <Text style={styles.subsectionLabel}>{STAGE_LABEL[stage]}</Text>
              <Badge label={String(items.length)} bg="#EEF0F4" color={AmkouyColors.textMuted} size="sm" />
            </View>
            <View style={styles.list}>
              {items.map((p) => (
                <PropertyRow key={p.propertyId} property={p} />
              ))}
            </View>
          </View>
        );
      })}
    </Screen>
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

function PropertyRow({ property }: { property: ActivationCenterEntry }) {
  const colors = STAGE_COLOR[property.computedStage];
  return (
    <Pressable onPress={() => router.push(`/properties/${property.propertyId}`)}>
      <Card style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{property.propertyName}</Text>
          <Text style={styles.sub}>
            {property.city ?? '—'} · {property.activationScore}% · {property.daysInOnboarding}j en onboarding
          </Text>
        </View>
        <Badge label={STAGE_LABEL[property.computedStage]} bg={colors.bg} color={colors.text} />
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 22, marginBottom: 6 },
  kpiTile: { flexGrow: 0, flexBasis: '31%', width: '31%', backgroundColor: '#fff', borderWidth: 1, borderColor: AmkouyColors.hairline, borderRadius: 14, padding: 12 },
  kpiValue: { ...robotoText(700, 15, { color: AmkouyColors.text }) },
  kpiLabel: { ...robotoText(400, 10, { color: AmkouyColors.textFaint, marginTop: 3 }) },
  subsectionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 22, marginTop: 20, marginBottom: 8 },
  subsectionLabel: { ...robotoText(700, 13, { color: AmkouyColors.primary }) },
  list: { paddingHorizontal: 22, gap: 9 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 13 },
  name: { ...robotoText(600, 13.5, { color: AmkouyColors.text }) },
  sub: { ...robotoText(400, 11, { color: AmkouyColors.textFaint, marginTop: 2 }) },
});

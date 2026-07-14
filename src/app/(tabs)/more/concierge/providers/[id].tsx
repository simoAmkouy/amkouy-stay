import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AccessGuard } from '@/components/amkouy/access-guard';
import { Badge } from '@/components/amkouy/badge';
import { Card } from '@/components/amkouy/card';
import { ErrorState } from '@/components/amkouy/error-state';
import { LoadingState } from '@/components/amkouy/loading-state';
import { Screen } from '@/components/amkouy/screen';
import { ScreenHeader } from '@/components/amkouy/screen-header';
import { ServiceProviderForm } from '@/components/forms/service-provider-form';
import { Icon } from '@/components/icon';
import { AmkouyColors } from '@/constants/amkouy-theme';
import { robotoText } from '@/constants/typography';
import {
  useArchiveServiceProvider,
  useProviderKpis,
  useServiceProvider,
  useUpdateServiceProvider,
} from '@/hooks/use-service-providers';
import {
  PROVIDER_STATUS_OPTIONS,
  SERVICE_CATEGORY_OPTIONS,
  ServiceProviderFormValues,
} from '@/lib/validation/service-provider';
import { confirmDestructive, notify } from '@/utils/alert';
import { getErrorMessage } from '@/utils/errors';
import { formatMAD } from '@/utils/format';
import { goBackOrReplace } from '@/utils/navigation';

const STATUS_LABEL = Object.fromEntries(PROVIDER_STATUS_OPTIONS.map((o) => [o.value, o.label]));
const CATEGORY_LABEL = Object.fromEntries(SERVICE_CATEGORY_OPTIONS.map((o) => [o.value, o.label]));
const STATUS_COLOR: Record<string, { bg: string; text: string }> = {
  active: { bg: '#DEF7E6', text: '#15803D' },
  inactive: { bg: '#EEF0F4', text: '#5A5E66' },
  suspended: { bg: '#FAD9D9', text: '#B91C1C' },
};

export default function ServiceProviderDetailScreen() {
  return (
    <AccessGuard resource="concierge">
      <ServiceProviderDetailContent />
    </AccessGuard>
  );
}

function ServiceProviderDetailContent() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: provider, isLoading, isError, refetch } = useServiceProvider(id);
  const { data: kpis } = useProviderKpis(id);
  const updateProvider = useUpdateServiceProvider();
  const archiveProvider = useArchiveServiceProvider();
  const [showEdit, setShowEdit] = useState(false);

  const handleUpdate = (values: ServiceProviderFormValues) => {
    updateProvider.mutate(
      { id: id as string, input: values },
      {
        onSuccess: () => {
          setShowEdit(false);
          notify('Prestataire modifié', 'Les changements ont été enregistrés.');
        },
        onError: (error) => notify('Erreur', getErrorMessage(error, 'Impossible de modifier le prestataire.')),
      }
    );
  };

  const handleArchive = () => {
    if (!provider) return;
    confirmDestructive('Archiver ce prestataire ?', `"${provider.name}" sera retiré de la liste active.`, () => {
      archiveProvider.mutate(provider.id, {
        onSuccess: () => goBackOrReplace('/more/concierge/providers'),
        onError: (error) => notify('Erreur', getErrorMessage(error, 'Archivage impossible.')),
      });
    });
  };

  if (isLoading) return <LoadingState label="Chargement du prestataire…" />;
  if (isError || !provider)
    return <ErrorState message="Prestataire introuvable ou erreur de chargement." onRetry={refetch} />;

  const statusColors = STATUS_COLOR[provider.status];

  return (
    <Screen
      footer={
        <View style={styles.stickyFooter}>
          <Pressable onPress={() => setShowEdit(true)} style={styles.editButton}>
            <Icon name="edit" size={20} color={AmkouyColors.primary} />
            <Text style={styles.editButtonText}>Modifier</Text>
          </Pressable>
        </View>
      }>
      <ScreenHeader title={provider.name} showBack fallbackHref="/more/concierge/providers" />

      <View style={styles.content}>
        <View style={styles.titleRow}>
          <Text style={styles.company}>{provider.company_name ?? 'Indépendant'}</Text>
          <Badge label={STATUS_LABEL[provider.status] ?? provider.status} bg={statusColors.bg} color={statusColors.text} />
        </View>

        <Text style={styles.sectionTitle}>Performance</Text>
        <View style={styles.kpiGrid}>
          <KpiBox label="Services livrés" value={String(kpis?.servicesDeliveredCount ?? 0)} />
          <KpiBox label="Revenu généré" value={formatMAD(kpis?.revenueGenerated ?? 0)} />
          <KpiBox label="Coût généré" value={formatMAD(kpis?.costGenerated ?? 0)} />
          <KpiBox label="Profit généré" value={formatMAD(kpis?.profitGenerated ?? 0)} highlight />
        </View>
        <View style={styles.rateRow}>
          {kpis?.averageCompletionDays != null && (
            <Text style={styles.avgCompletion}>
              Délai moyen : {kpis.averageCompletionDays.toFixed(1)} j
            </Text>
          )}
          {kpis?.completionRate != null && (
            <Text style={styles.avgCompletion}>Taux de complétion : {kpis.completionRate.toFixed(0)}%</Text>
          )}
        </View>

        <Card style={styles.infoCard}>
          <InfoRow label="Téléphone" value={provider.phone ?? '—'} border />
          <InfoRow label="E-mail" value={provider.email ?? '—'} border />
          <InfoRow
            label="Catégories"
            value={provider.service_categories.map((c) => CATEGORY_LABEL[c] ?? c).join(', ') || '—'}
          />
        </Card>

        {!!provider.pricing_agreement && (
          <>
            <Text style={styles.sectionTitle}>Accord tarifaire</Text>
            <View style={styles.notesCard}>
              <Text style={styles.notesText}>{provider.pricing_agreement}</Text>
            </View>
          </>
        )}

        {!!provider.internal_notes && (
          <>
            <Text style={styles.sectionTitle}>Notes internes</Text>
            <View style={styles.notesCard}>
              <Text style={styles.notesText}>{provider.internal_notes}</Text>
            </View>
          </>
        )}

        <Pressable onPress={handleArchive} style={styles.archiveButton}>
          <Icon name="archive" size={20} color={AmkouyColors.error} />
          <Text style={styles.archiveButtonText}>Archiver ce prestataire</Text>
        </Pressable>
      </View>

      <ServiceProviderForm
        visible={showEdit}
        mode="edit"
        initialValues={{
          name: provider.name,
          companyName: provider.company_name ?? '',
          phone: provider.phone ?? '',
          email: provider.email ?? '',
          serviceCategories: provider.service_categories,
          pricingAgreement: provider.pricing_agreement ?? '',
          internalNotes: provider.internal_notes ?? '',
          status: provider.status,
        }}
        onClose={() => setShowEdit(false)}
        onSubmit={handleUpdate}
        submitting={updateProvider.isPending}
      />
    </Screen>
  );
}

function KpiBox({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={[styles.kpiBox, highlight && styles.kpiBoxHighlight]}>
      <Text style={[styles.kpiValue, highlight && { color: AmkouyColors.secondary }]}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

function InfoRow({ label, value, border }: { label: string; value: string; border?: boolean }) {
  return (
    <View style={[styles.infoRow, border && styles.infoRowBorder]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 22,
    paddingTop: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
  },
  company: {
    ...robotoText(400, 13, { color: AmkouyColors.textFaint }),
  },
  sectionTitle: {
    ...robotoText(700, 15, { color: AmkouyColors.primary, marginTop: 22, marginBottom: 10 }),
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  kpiBox: {
    width: '47%',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: AmkouyColors.hairline,
    borderRadius: 14,
    padding: 13,
  },
  kpiBoxHighlight: {
    backgroundColor: 'rgba(201,168,76,.1)',
    borderColor: 'rgba(201,168,76,.3)',
  },
  kpiValue: {
    ...robotoText(900, 17, { color: AmkouyColors.text }),
  },
  kpiLabel: {
    ...robotoText(400, 10.5, { color: AmkouyColors.textFaint, marginTop: 2 }),
  },
  rateRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 10,
  },
  avgCompletion: {
    ...robotoText(500, 12, { color: AmkouyColors.textMuted }),
  },
  infoCard: {
    marginTop: 22,
    paddingHorizontal: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  infoRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: AmkouyColors.hairline,
  },
  infoLabel: {
    ...robotoText(400, 13, { color: AmkouyColors.textMuted }),
  },
  infoValue: {
    ...robotoText(600, 13, { color: AmkouyColors.text }),
  },
  notesCard: {
    backgroundColor: '#FFFBEC',
    borderWidth: 1,
    borderColor: '#F3E6BE',
    borderRadius: 14,
    padding: 13,
    paddingHorizontal: 15,
  },
  notesText: {
    ...robotoText(400, 12.5, { color: '#6a5a22', lineHeight: 19 }),
  },
  archiveButton: {
    marginTop: 28,
    height: 50,
    borderRadius: 25,
    borderWidth: 1.5,
    borderColor: AmkouyColors.error,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  archiveButtonText: {
    ...robotoText(600, 13, { color: AmkouyColors.error }),
  },
  stickyFooter: {
    backgroundColor: '#fff',
    paddingVertical: 14,
    paddingHorizontal: 20,
    shadowColor: AmkouyColors.primary,
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -3 },
  },
  editButton: {
    height: 48,
    borderRadius: 16,
    backgroundColor: AmkouyColors.secondaryContainer,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  editButtonText: {
    ...robotoText(700, 14, { color: AmkouyColors.primary }),
  },
});

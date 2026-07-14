import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AccessGuard } from '@/components/amkouy/access-guard';
import { Badge } from '@/components/amkouy/badge';
import { Card } from '@/components/amkouy/card';
import { EmptyState } from '@/components/amkouy/empty-state';
import { ErrorState } from '@/components/amkouy/error-state';
import { FilterChipRow } from '@/components/amkouy/filter-chip-row';
import { LoadingState } from '@/components/amkouy/loading-state';
import { Screen } from '@/components/amkouy/screen';
import { ScreenHeader } from '@/components/amkouy/screen-header';
import { ContractForm } from '@/components/forms/contract-form';
import { Icon } from '@/components/icon';
import { AmkouyColors } from '@/constants/amkouy-theme';
import { robotoText } from '@/constants/typography';
import { useAuth } from '@/hooks/use-auth';
import { useContracts, useCreateContract, useSyncContractExpiryNotifications } from '@/hooks/use-contracts';
import { computeContractHealth, computeDaysRemaining, ContractHealth } from '@/lib/queries/contracts';
import { ContractFormValues } from '@/lib/validation/contract';
import { notify } from '@/utils/alert';
import { getErrorMessage } from '@/utils/errors';

type HealthFilter = 'all' | 'expiring' | 'expired';
const HEALTH_FILTERS: { label: string; value: HealthFilter }[] = [
  { label: 'Tous', value: 'all' },
  { label: 'Expire bientôt', value: 'expiring' },
  { label: 'Expirés', value: 'expired' },
];

const HEALTH_LABEL: Record<ContractHealth, string> = {
  healthy: 'Actif',
  expiring_soon: 'Expire bientôt',
  urgent: 'Expire bientôt',
  expired: 'Expiré',
  terminated: 'Résilié',
};
const HEALTH_COLOR: Record<ContractHealth, { bg: string; text: string }> = {
  healthy: { bg: '#DEF7E6', text: '#15803D' },
  expiring_soon: { bg: '#FDEBC8', text: '#B45309' },
  urgent: { bg: '#FAD9D9', text: '#B91C1C' },
  expired: { bg: '#FAD9D9', text: '#B91C1C' },
  terminated: { bg: '#EEF0F4', text: '#5A5E66' },
};

export default function ContractsScreen() {
  return (
    <AccessGuard resource="contracts">
      <ContractsContent />
    </AccessGuard>
  );
}

function ContractsContent() {
  const { profile } = useAuth();
  const isStaff = profile?.role === 'admin' || profile?.role === 'super_admin' || profile?.role === 'manager';
  const params = useLocalSearchParams<{ health?: string }>();
  const initialHealth: HealthFilter = params.health === 'expiring' || params.health === 'expired' ? params.health : 'all';

  const { data: contracts, isLoading, isError, refetch } = useContracts();
  const createContract = useCreateContract();
  const syncExpiry = useSyncContractExpiryNotifications();
  const [showCreate, setShowCreate] = useState(false);
  const [healthFilter, setHealthFilter] = useState<HealthFilter>(initialHealth);

  const filteredContracts = useMemo(() => {
    if (healthFilter === 'all') return contracts ?? [];
    return (contracts ?? []).filter((c) => {
      const health = computeContractHealth(c);
      if (healthFilter === 'expiring') return health === 'urgent' || health === 'expiring_soon';
      return health === 'expired';
    });
  }, [contracts, healthFilter]);

  // Phase 13: no cron/scheduled worker exists — expiry alerts are computed and (idempotently)
  // fired whenever this screen loads, staff-only (matches contracts_insert/update RLS).
  useEffect(() => {
    if (isStaff && contracts && contracts.length > 0) {
      syncExpiry.mutate(contracts);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStaff, contracts]);

  const handleCreate = (values: ContractFormValues) => {
    createContract.mutate(
      {
        ownerId: values.ownerId,
        propertyId: values.propertyId,
        commissionPct: values.commissionPct,
        payoutSchedule: values.payoutSchedule,
        startDate: values.startDate,
        endDate: values.endDate,
        autoRenew: values.autoRenew,
        terms: values.terms,
      },
      {
        onSuccess: () => {
          setShowCreate(false);
          notify('Contrat créé', 'Le contrat a été créé en brouillon.');
        },
        onError: (error) => notify('Erreur', getErrorMessage(error, 'Impossible de créer le contrat.')),
      }
    );
  };

  return (
    <Screen>
      <ScreenHeader
        title="Contrats"
        subtitle={contracts ? `${filteredContracts.length} contrats` : 'Chargement…'}
        showBack
        fallbackHref="/more"
        trailing={
          isStaff ? (
            <Pressable onPress={() => setShowCreate(true)} style={styles.addButton}>
              <Icon name="add" size={22} color="#fff" />
            </Pressable>
          ) : undefined
        }
      />

      <View style={styles.filterRow}>
        <FilterChipRow
          options={HEALTH_FILTERS.map((f) => f.value)}
          active={healthFilter}
          onChange={setHealthFilter}
          getLabel={(v) => HEALTH_FILTERS.find((f) => f.value === v)?.label ?? v}
        />
      </View>

      {isLoading && <LoadingState label="Chargement des contrats…" />}
      {isError && <ErrorState message="Impossible de charger les contrats." onRetry={refetch} />}
      {!isLoading && !isError && filteredContracts.length === 0 && (
        <EmptyState icon="description" message="Aucun contrat ne correspond à ce filtre." />
      )}

      {!isLoading && !isError && (
        <View style={styles.list}>
          {filteredContracts.map((contract) => {
            const health = computeContractHealth(contract);
            const days = computeDaysRemaining(contract.end_date);
            const colors = HEALTH_COLOR[health];
            return (
              <Pressable key={contract.id} onPress={() => router.push(`/more/contracts/${contract.id}`)}>
                <Card style={styles.row}>
                  <View style={styles.rowTop}>
                    <Text style={styles.contractNumber}>{contract.contract_number}</Text>
                    <Badge label={HEALTH_LABEL[health]} bg={colors.bg} color={colors.text} />
                  </View>
                  <Text style={styles.subLine}>
                    {contract.owner?.full_name ?? '—'} · {contract.property?.name ?? '—'}
                  </Text>
                  <View style={styles.metaRow}>
                    <Text style={styles.metaText}>
                      {contract.start_date} → {contract.end_date ?? 'Sans échéance'}
                    </Text>
                    <Text style={styles.metaText}>{contract.commission_pct}%</Text>
                  </View>
                  {days !== null && health !== 'terminated' && (
                    <Text style={[styles.daysText, { color: colors.text }]}>
                      {days >= 0 ? `${days} jours restants` : `Expiré depuis ${Math.abs(days)} jours`}
                    </Text>
                  )}
                </Card>
              </Pressable>
            );
          })}
        </View>
      )}

      <ContractForm
        visible={showCreate}
        mode="create"
        onClose={() => setShowCreate(false)}
        onSubmit={handleCreate}
        submitting={createContract.isPending}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  addButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: AmkouyColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterRow: {
    paddingTop: 6,
    paddingBottom: 8,
  },
  list: {
    paddingHorizontal: 22,
    gap: 11,
  },
  row: {
    padding: 14,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  contractNumber: {
    ...robotoText(700, 14, { color: AmkouyColors.text }),
  },
  subLine: {
    ...robotoText(400, 12, { color: AmkouyColors.textFaint, marginTop: 4 }),
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  metaText: {
    ...robotoText(500, 11.5, { color: AmkouyColors.textMuted }),
  },
  daysText: {
    ...robotoText(600, 11, { marginTop: 6 }),
  },
});

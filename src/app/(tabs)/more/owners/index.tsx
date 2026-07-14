import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AccessGuard } from '@/components/amkouy/access-guard';
import { Avatar } from '@/components/amkouy/avatar';
import { Card } from '@/components/amkouy/card';
import { EmptyState } from '@/components/amkouy/empty-state';
import { ErrorState } from '@/components/amkouy/error-state';
import { ListFilterBar } from '@/components/amkouy/list-filter-bar';
import { LoadingState } from '@/components/amkouy/loading-state';
import { Screen } from '@/components/amkouy/screen';
import { ScreenHeader } from '@/components/amkouy/screen-header';
import { SortOption } from '@/components/amkouy/sort-selector';
import { OwnerForm } from '@/components/forms/owner-form';
import { Icon } from '@/components/icon';
import { AmkouyColors } from '@/constants/amkouy-theme';
import { robotoText } from '@/constants/typography';
import { useCreateOwner, useOwnerAggregates, useOwners } from '@/hooks/use-owners';
import { OWNER_STATUS_OPTIONS, OwnerFormValues } from '@/lib/validation/owner';
import { notify } from '@/utils/alert';
import { getErrorMessage } from '@/utils/errors';
import { getInitials } from '@/utils/format';

const STATUS_LABEL = Object.fromEntries(OWNER_STATUS_OPTIONS.map((o) => [o.value, o.label]));
const STATUS_COLOR: Record<string, { bg: string; text: string }> = {
  prospect: { bg: '#F8EFD4', text: '#8a6d1c' },
  active: { bg: '#DEF7E6', text: '#15803D' },
  inactive: { bg: '#EEF0F4', text: '#5A5E66' },
};

type SortValue =
  | 'created_desc'
  | 'created_asc'
  | 'updated_desc'
  | 'name_asc'
  | 'name_desc'
  | 'revenue_desc'
  | 'revenue_asc'
  | 'property_count_desc';

const SORT_OPTIONS: SortOption<SortValue>[] = [
  { label: 'Plus récents (ajout)', value: 'created_desc' },
  { label: 'Plus anciens (ajout)', value: 'created_asc' },
  { label: 'Récemment mis à jour', value: 'updated_desc' },
  { label: 'Nom A-Z', value: 'name_asc' },
  { label: 'Nom Z-A', value: 'name_desc' },
  { label: 'Revenu le plus élevé', value: 'revenue_desc' },
  { label: 'Revenu le plus faible', value: 'revenue_asc' },
  { label: 'Nombre de biens', value: 'property_count_desc' },
];

function compareStrings(a: string, b: string) {
  return a.localeCompare(b);
}

export default function OwnersScreen() {
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortValue>('created_desc');
  const { data: owners, isLoading, isError, refetch } = useOwners();
  const { data: aggregates } = useOwnerAggregates();
  const createOwner = useCreateOwner();
  const [showCreate, setShowCreate] = useState(false);

  const filtered = useMemo(() => {
    const list = (owners ?? []).filter((owner) => {
      if (query.trim().length === 0) return true;
      const q = query.toLowerCase();
      return (
        owner.full_name.toLowerCase().includes(q) ||
        (owner.phone ?? '').toLowerCase().includes(q) ||
        (owner.email ?? '').toLowerCase().includes(q)
      );
    });
    const sorted = [...list];
    sorted.sort((a, b) => {
      const aggA = aggregates?.[a.id];
      const aggB = aggregates?.[b.id];
      switch (sortBy) {
        case 'created_desc':
          return compareStrings(b.created_at, a.created_at);
        case 'created_asc':
          return compareStrings(a.created_at, b.created_at);
        case 'updated_desc':
          return compareStrings(b.updated_at, a.updated_at);
        case 'name_asc':
          return compareStrings(a.full_name, b.full_name);
        case 'name_desc':
          return compareStrings(b.full_name, a.full_name);
        case 'revenue_desc':
          return (aggB?.revenue ?? 0) - (aggA?.revenue ?? 0);
        case 'revenue_asc':
          return (aggA?.revenue ?? 0) - (aggB?.revenue ?? 0);
        case 'property_count_desc':
          return (aggB?.propertyCount ?? 0) - (aggA?.propertyCount ?? 0);
        default:
          return 0;
      }
    });
    return sorted;
  }, [owners, aggregates, query, sortBy]);

  const handleCreate = (values: OwnerFormValues) => {
    createOwner.mutate(
      {
        full_name: values.fullName,
        company_name: values.companyName || null,
        email: values.email || null,
        phone: values.phone || null,
        status: values.status,
        bank_name: values.bankName || null,
        bank_iban: values.bankIban || null,
        notes: values.notes || null,
      },
      {
        onSuccess: () => {
          setShowCreate(false);
          notify('Propriétaire créé', `${values.fullName} a été ajouté avec succès.`);
        },
        onError: (error) => {
          notify('Erreur', getErrorMessage(error, 'Impossible de créer le propriétaire.'));
        },
      }
    );
  };

  return (
    <AccessGuard resource="owners">
    <Screen>
      <ScreenHeader
        title="Propriétaires"
        subtitle={owners ? `${filtered.length} propriétaires` : 'Chargement…'}
        showBack
        fallbackHref="/more"
        trailing={
          <Pressable onPress={() => setShowCreate(true)} style={styles.addButton}>
            <Icon name="add" size={22} color="#fff" />
          </Pressable>
        }
      />

      <ListFilterBar
        searchValue={query}
        onSearchChange={setQuery}
        searchPlaceholder="Nom, téléphone, email…"
        sortOptions={SORT_OPTIONS}
        sortValue={sortBy}
        onSortChange={setSortBy}
        onRefresh={refetch}
      />

      {isLoading && <LoadingState label="Chargement des propriétaires…" />}
      {isError && <ErrorState message="Impossible de charger les propriétaires." onRetry={refetch} />}
      {!isLoading && !isError && filtered.length === 0 && (
        <EmptyState icon="real_estate_agent" message="Aucun propriétaire ne correspond à votre recherche." />
      )}

      {!isLoading && !isError && (
        <View style={styles.list}>
          {filtered.map((owner) => {
            const statusColors = STATUS_COLOR[owner.status];
            return (
              <Pressable key={owner.id} onPress={() => router.push(`/more/owners/${owner.id}`)}>
                <Card style={styles.row}>
                  <Avatar
                    initials={getInitials(owner.full_name)}
                    size={48}
                    bg="#E3E9F4"
                    color={AmkouyColors.primaryContainer}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{owner.full_name}</Text>
                    <Text style={styles.sub}>{owner.phone || owner.email || 'Aucun contact renseigné'}</Text>
                    <View style={styles.statusRow}>
                      <View style={[styles.dot, { backgroundColor: statusColors.text }]} />
                      <Text style={[styles.statusText, { color: statusColors.text }]}>
                        {STATUS_LABEL[owner.status] ?? owner.status}
                      </Text>
                    </View>
                  </View>
                  <Icon name="chevron_right" size={22} color="#c2c7cf" />
                </Card>
              </Pressable>
            );
          })}
        </View>
      )}

      <OwnerForm
        visible={showCreate}
        mode="create"
        onClose={() => setShowCreate(false)}
        onSubmit={handleCreate}
        submitting={createOwner.isPending}
      />
    </Screen>
    </AccessGuard>
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
  list: {
    paddingHorizontal: 22,
    gap: 11,
    marginTop: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    padding: 14,
  },
  name: {
    ...robotoText(600, 15, { color: AmkouyColors.text }),
  },
  sub: {
    ...robotoText(400, 11.5, { color: AmkouyColors.textFaint, marginTop: 2 }),
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    ...robotoText(600, 10.5, {}),
  },
});

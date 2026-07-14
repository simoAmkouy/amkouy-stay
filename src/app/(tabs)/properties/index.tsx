import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AccessGuard } from '@/components/amkouy/access-guard';
import { Badge } from '@/components/amkouy/badge';
import { Card } from '@/components/amkouy/card';
import { EmptyState } from '@/components/amkouy/empty-state';
import { ErrorState } from '@/components/amkouy/error-state';
import { FilterChipRow } from '@/components/amkouy/filter-chip-row';
import { ListFilterBar } from '@/components/amkouy/list-filter-bar';
import { LoadingState } from '@/components/amkouy/loading-state';
import { Screen } from '@/components/amkouy/screen';
import { SortOption } from '@/components/amkouy/sort-selector';
import { StatusFilter } from '@/components/amkouy/status-filter';
import { PropertyForm } from '@/components/forms/property-form';
import { Icon } from '@/components/icon';
import { AmkouyColors } from '@/constants/amkouy-theme';
import { robotoText } from '@/constants/typography';
import { useCreateProperty, useProperties, usePropertyAggregates } from '@/hooks/use-properties';
import { PropertyRow } from '@/lib/queries/properties';
import { PROPERTY_STATUS_OPTIONS, PROPERTY_TYPE_OPTIONS, PropertyFormValues } from '@/lib/validation/property';
import { notify } from '@/utils/alert';
import { getErrorMessage } from '@/utils/errors';
import { formatMAD } from '@/utils/format';

const TYPE_FILTERS = [{ label: 'Tous', value: 'all' }, ...PROPERTY_TYPE_OPTIONS] as const;

const STATUS_LABEL = Object.fromEntries(PROPERTY_STATUS_OPTIONS.map((o) => [o.value, o.label]));

type SortValue =
  | 'created_desc'
  | 'created_asc'
  | 'updated_desc'
  | 'name_asc'
  | 'name_desc'
  | 'revenue_desc'
  | 'revenue_asc'
  | 'occupancy_desc'
  | 'occupancy_asc';

const SORT_OPTIONS: SortOption<SortValue>[] = [
  { label: 'Plus récents (ajout)', value: 'created_desc' },
  { label: 'Plus anciens (ajout)', value: 'created_asc' },
  { label: 'Récemment mis à jour', value: 'updated_desc' },
  { label: 'Nom A-Z', value: 'name_asc' },
  { label: 'Nom Z-A', value: 'name_desc' },
  { label: 'Revenu le plus élevé', value: 'revenue_desc' },
  { label: 'Revenu le plus faible', value: 'revenue_asc' },
  { label: "Taux d'occupation le plus élevé", value: 'occupancy_desc' },
  { label: "Taux d'occupation le plus faible", value: 'occupancy_asc' },
];

function compareStrings(a: string, b: string) {
  return a.localeCompare(b);
}
const STATUS_COLOR: Record<string, { bg: string; text: string }> = {
  onboarding: { bg: '#FDEBC8', text: '#B45309' },
  active: { bg: '#DEF7E6', text: '#15803D' },
  maintenance: { bg: '#FAD9D9', text: '#B91C1C' },
  inactive: { bg: '#EEF0F4', text: '#5A5E66' },
  archived: { bg: '#EEF0F4', text: '#5A5E66' },
};

export default function PropertiesScreen() {
  // Command Center deep-link (Mission D, Phase 9): `?status=onboarding` from the Operations
  // Center's Property Health tiles ("Activation en attente" etc.) seeds the status filter.
  const params = useLocalSearchParams<{ status?: string }>();
  const initialStatuses = useMemo<PropertyRow['status'][]>(
    () => (params.status ? (params.status.split(',') as PropertyRow['status'][]) : []),
    [params.status]
  );
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statuses, setStatuses] = useState<PropertyRow['status'][]>(initialStatuses);
  const [sortBy, setSortBy] = useState<SortValue>('created_desc');
  const [showCreate, setShowCreate] = useState(false);

  const { data: properties, isLoading, isError, refetch } = useProperties({ statuses });
  const { data: aggregates } = usePropertyAggregates();
  const createProperty = useCreateProperty();

  const filtered = useMemo(() => {
    const list = (properties ?? []).filter((p) => {
      const matchesQuery =
        query.trim().length === 0 ||
        p.name.toLowerCase().includes(query.toLowerCase()) ||
        p.city.toLowerCase().includes(query.toLowerCase());
      const matchesType = typeFilter === 'all' || p.property_type === typeFilter;
      return matchesQuery && matchesType;
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
          return compareStrings(a.name, b.name);
        case 'name_desc':
          return compareStrings(b.name, a.name);
        case 'revenue_desc':
          return (aggB?.revenue ?? 0) - (aggA?.revenue ?? 0);
        case 'revenue_asc':
          return (aggA?.revenue ?? 0) - (aggB?.revenue ?? 0);
        case 'occupancy_desc':
          return (aggB?.occupancyRate ?? 0) - (aggA?.occupancyRate ?? 0);
        case 'occupancy_asc':
          return (aggA?.occupancyRate ?? 0) - (aggB?.occupancyRate ?? 0);
        default:
          return 0;
      }
    });
    return sorted;
  }, [properties, aggregates, query, typeFilter, sortBy]);

  const handleCreate = (values: PropertyFormValues) => {
    createProperty.mutate(
      {
        input: {
          name: values.name,
          property_type: values.propertyType,
          status: values.status,
          city: values.city,
          address_line: values.addressLine || null,
          bedrooms: values.bedrooms ?? null,
          bathrooms: values.bathrooms ?? null,
          max_guests: values.maxGuests ?? null,
          base_nightly_rate: values.baseNightlyRate ?? null,
          cleaning_fee: values.cleaningFee,
          assigned_manager_id: values.assignedManagerId,
          default_cleaner_id: values.defaultCleanerId,
          acquired_by_agent: values.acquiredByAgent,
        },
        ownerId: values.ownerId,
      },
      {
        onSuccess: () => {
          setShowCreate(false);
          notify('Bien créé', `${values.name} a été ajouté avec succès.`);
        },
        onError: (error) => {
          notify('Erreur', getErrorMessage(error, 'Impossible de créer le bien.'));
        },
      }
    );
  };

  return (
    <AccessGuard resource="properties">
    <Screen contentPadding={false}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Propriétés</Text>
          <Text style={styles.subtitle}>
            {properties ? `${properties.length} biens gérés` : 'Chargement…'}
          </Text>
        </View>
        <Pressable onPress={() => setShowCreate(true)} style={styles.addButton}>
          <Icon name="add" size={24} color="#fff" />
        </Pressable>
      </View>

      <ListFilterBar
        searchValue={query}
        onSearchChange={setQuery}
        searchPlaceholder="Rechercher un bien…"
        sortOptions={SORT_OPTIONS}
        sortValue={sortBy}
        onSortChange={setSortBy}
        onRefresh={refetch}
      />

      <View style={styles.filterRow}>
        <FilterChipRow
          options={TYPE_FILTERS.map((f) => f.value)}
          active={typeFilter}
          onChange={setTypeFilter}
        />
      </View>
      <View style={styles.filterRow}>
        <StatusFilter options={PROPERTY_STATUS_OPTIONS} value={statuses} onChange={setStatuses} />
      </View>

      {isLoading && <LoadingState label="Chargement des biens…" />}
      {isError && <ErrorState message="Impossible de charger les biens." onRetry={refetch} />}
      {!isLoading && !isError && filtered.length === 0 && (
        <EmptyState icon="home_work" message="Aucun bien ne correspond à votre recherche." />
      )}

      {!isLoading && !isError && (
        <View style={styles.list}>
          {filtered.map((property) => {
            const statusColors = STATUS_COLOR[property.status];
            const typeLabel =
              PROPERTY_TYPE_OPTIONS.find((t) => t.value === property.property_type)?.label ??
              property.property_type;
            return (
              <Pressable key={property.id} onPress={() => router.push(`/properties/${property.id}`)}>
                <Card style={styles.propertyCard}>
                  <View style={styles.propertyImage}>
                    <Badge
                      label={STATUS_LABEL[property.status] ?? property.status}
                      bg={statusColors.bg}
                      color={statusColors.text}
                      size="sm"
                      style={styles.statusBadge}
                    />
                    <View style={styles.typeBadge}>
                      <Text style={styles.typeBadgeText}>{typeLabel}</Text>
                    </View>
                  </View>
                  <View style={styles.propertyBody}>
                    <View style={styles.propertyTitleRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.propertyName}>{property.name}</Text>
                        <View style={styles.propertyLocationRow}>
                          <Icon name="location_on" size={14} color={AmkouyColors.secondary} />
                          <Text style={styles.propertyCity}>{property.city}</Text>
                        </View>
                      </View>
                      <Icon name="chevron_right" size={22} color="#c2c7cf" />
                    </View>
                    <View style={styles.propertyStatsRow}>
                      <View style={styles.propertyStat}>
                        <Text style={styles.propertyStatLabel}>Propriétaire</Text>
                        <Text style={styles.propertyStatValue}>
                          {property.primaryOwner?.full_name ?? '—'}
                        </Text>
                      </View>
                      <View style={styles.propertyStat}>
                        <Text style={styles.propertyStatLabel}>Tarif/nuit</Text>
                        <Text style={[styles.propertyStatValue, { color: AmkouyColors.primary }]}>
                          {property.base_nightly_rate != null ? formatMAD(property.base_nightly_rate) : '—'}
                        </Text>
                      </View>
                    </View>
                  </View>
                </Card>
              </Pressable>
            );
          })}
        </View>
      )}

      <PropertyForm
        visible={showCreate}
        mode="create"
        onClose={() => setShowCreate(false)}
        onSubmit={handleCreate}
        submitting={createProperty.isPending}
      />
    </Screen>
    </AccessGuard>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 22,
    paddingTop: 8,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  title: {
    ...robotoText(700, 27, { color: AmkouyColors.primary, letterSpacing: -0.4 }),
  },
  subtitle: {
    ...robotoText(400, 13, { color: AmkouyColors.textFaint, marginTop: 3 }),
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: AmkouyColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterRow: {
    paddingTop: 14,
    paddingBottom: 4,
  },
  list: {
    paddingHorizontal: 22,
    paddingTop: 12,
    gap: 12,
  },
  propertyCard: {
    overflow: 'hidden',
  },
  propertyImage: {
    height: 118,
    backgroundColor: AmkouyColors.primaryContainer,
  },
  statusBadge: {
    position: 'absolute',
    top: 11,
    left: 11,
  },
  typeBadge: {
    position: 'absolute',
    top: 11,
    right: 11,
    backgroundColor: 'rgba(255,255,255,.92)',
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  typeBadgeText: {
    ...robotoText(700, 10.5, { color: AmkouyColors.primary }),
  },
  propertyBody: {
    padding: 15,
  },
  propertyTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  propertyName: {
    ...robotoText(700, 16, { color: AmkouyColors.text }),
  },
  propertyLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  propertyCity: {
    ...robotoText(400, 12, { color: AmkouyColors.textFaint }),
  },
  propertyStatsRow: {
    flexDirection: 'row',
    gap: 18,
    marginTop: 13,
    paddingTop: 13,
    borderTopWidth: 1,
    borderTopColor: AmkouyColors.hairline,
  },
  propertyStat: {},
  propertyStatLabel: {
    ...robotoText(400, 10, { color: AmkouyColors.textFainter }),
  },
  propertyStatValue: {
    ...robotoText(600, 12.5, { color: AmkouyColors.text, marginTop: 1 }),
  },
});

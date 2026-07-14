import { useMemo, useState } from 'react';
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
import { ServiceCatalogForm } from '@/components/forms/service-catalog-form';
import { Icon } from '@/components/icon';
import { AmkouyColors } from '@/constants/amkouy-theme';
import { robotoText } from '@/constants/typography';
import { useArchiveService, useCreateService, useServices, useUpdateService } from '@/hooks/use-services';
import { ServiceCategory, ServiceRow } from '@/lib/queries/services';
import { SERVICE_CATEGORY_OPTIONS, ServiceCatalogFormValues } from '@/lib/validation/service-catalog';
import { confirmDestructive, notify } from '@/utils/alert';
import { getErrorMessage } from '@/utils/errors';
import { formatMAD } from '@/utils/format';

const CATEGORY_FILTERS = [{ label: 'Toutes', value: 'all' as const }, ...SERVICE_CATEGORY_OPTIONS];
const CATEGORY_LABEL = Object.fromEntries(SERVICE_CATEGORY_OPTIONS.map((o) => [o.value, o.label]));

export default function ServiceCatalogScreen() {
  return (
    <AccessGuard resource="concierge">
      <ServiceCatalogContent />
    </AccessGuard>
  );
}

function ServiceCatalogContent() {
  const [categoryFilter, setCategoryFilter] = useState<ServiceCategory | 'all'>('all');
  const [showForm, setShowForm] = useState(false);
  const [editingService, setEditingService] = useState<ServiceRow | null>(null);

  const { data: services, isLoading, isError, refetch } = useServices();
  const createService = useCreateService();
  const updateService = useUpdateService();
  const archiveService = useArchiveService();

  const filtered = useMemo(() => {
    return (services ?? []).filter((s) => categoryFilter === 'all' || s.category === categoryFilter);
  }, [services, categoryFilter]);

  const handleAdd = () => {
    setEditingService(null);
    setShowForm(true);
  };

  const handleEdit = (service: ServiceRow) => {
    setEditingService(service);
    setShowForm(true);
  };

  const handleSubmit = (values: ServiceCatalogFormValues) => {
    if (editingService) {
      updateService.mutate(
        { id: editingService.id, input: values },
        {
          onSuccess: () => {
            setShowForm(false);
            notify('Service modifié', 'Les changements ont été enregistrés.');
          },
          onError: (error) => notify('Erreur', getErrorMessage(error, 'Impossible de modifier le service.')),
        }
      );
    } else {
      createService.mutate(values, {
        onSuccess: () => {
          setShowForm(false);
          notify('Service créé', 'Le service a été ajouté au catalogue.');
        },
        onError: (error) => notify('Erreur', getErrorMessage(error, 'Impossible de créer le service.')),
      });
    }
  };

  const handleArchive = (service: ServiceRow) => {
    confirmDestructive('Archiver ce service ?', `"${service.name}" sera retiré du catalogue actif.`, () => {
      archiveService.mutate(service.id, {
        onError: (error) => notify('Erreur', getErrorMessage(error, 'Archivage impossible.')),
      });
    });
  };

  return (
    <Screen>
      <ScreenHeader
        title="Catalogue de services"
        subtitle={services ? `${services.length} services` : 'Chargement…'}
        showBack
        fallbackHref="/more"
        trailing={
          <Pressable onPress={handleAdd} style={styles.addButton}>
            <Icon name="add" size={22} color="#fff" />
          </Pressable>
        }
      />

      <View style={styles.filterRow}>
        <FilterChipRow
          options={CATEGORY_FILTERS.map((f) => f.value)}
          active={categoryFilter}
          onChange={setCategoryFilter}
          getLabel={(v) => CATEGORY_FILTERS.find((f) => f.value === v)?.label ?? v}
        />
      </View>

      {isLoading && <LoadingState label="Chargement du catalogue…" />}
      {isError && <ErrorState message="Impossible de charger le catalogue." onRetry={refetch} />}
      {!isLoading && !isError && filtered.length === 0 && (
        <EmptyState icon="room_service" message="Aucun service ne correspond à votre recherche." />
      )}

      {!isLoading && !isError && (
        <View style={styles.list}>
          {filtered.map((service) => (
            <Pressable key={service.id} onPress={() => handleEdit(service)}>
              <Card style={styles.row}>
                <View style={{ flex: 1 }}>
                  <View style={styles.nameRow}>
                    <Text style={styles.name}>{service.name}</Text>
                    {!service.is_active && <Badge label="Inactif" bg="#EEF0F4" color={AmkouyColors.textFaint} size="sm" />}
                  </View>
                  <Text style={styles.meta}>
                    {service.service_code} · {CATEGORY_LABEL[service.category]}
                  </Text>
                  <Text style={styles.pricing}>
                    {formatMAD(service.default_price)} · marge {formatMAD(service.default_price - service.default_cost)}
                  </Text>
                </View>
                <Pressable onPress={() => handleArchive(service)} hitSlop={8}>
                  <Icon name="delete_outline" size={20} color={AmkouyColors.error} />
                </Pressable>
              </Card>
            </Pressable>
          ))}
        </View>
      )}

      <ServiceCatalogForm
        visible={showForm}
        mode={editingService ? 'edit' : 'create'}
        initialValues={
          editingService
            ? {
                name: editingService.name,
                category: editingService.category,
                description: editingService.description ?? '',
                isActive: editingService.is_active,
                requiresProvider: editingService.requires_provider,
                requiresScheduling: editingService.requires_scheduling,
                defaultPrice: editingService.default_price,
                defaultCost: editingService.default_cost,
              }
            : undefined
        }
        onClose={() => setShowForm(false)}
        onSubmit={handleSubmit}
        submitting={createService.isPending || updateService.isPending}
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
    paddingTop: 10,
    paddingBottom: 4,
  },
  list: {
    paddingHorizontal: 22,
    paddingTop: 14,
    gap: 11,
    paddingBottom: 22,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  name: {
    ...robotoText(600, 14, { color: AmkouyColors.text }),
  },
  meta: {
    ...robotoText(400, 11.5, { color: AmkouyColors.textFaint, marginTop: 2 }),
  },
  pricing: {
    ...robotoText(500, 12, { color: AmkouyColors.primary, marginTop: 3 }),
  },
});

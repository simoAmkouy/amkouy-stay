import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AccessGuard } from '@/components/amkouy/access-guard';
import { Badge } from '@/components/amkouy/badge';
import { Card } from '@/components/amkouy/card';
import { EmptyState } from '@/components/amkouy/empty-state';
import { ErrorState } from '@/components/amkouy/error-state';
import { FilterChipRow } from '@/components/amkouy/filter-chip-row';
import { Icon } from '@/components/icon';
import { LoadingState } from '@/components/amkouy/loading-state';
import { Screen } from '@/components/amkouy/screen';
import { ScreenHeader } from '@/components/amkouy/screen-header';
import { SearchBar } from '@/components/amkouy/search-bar';
import { AmkouyColors } from '@/constants/amkouy-theme';
import { robotoText } from '@/constants/typography';
import { useArchivedItems, useRestoreItem } from '@/hooks/use-archived-items';
import { ArchivedEntityType } from '@/lib/queries/archived-items';
import { confirmDestructive, notify } from '@/utils/alert';
import { getErrorMessage } from '@/utils/errors';

const ENTITY_LABEL: Record<ArchivedEntityType, string> = {
  property: 'Bien',
  owner: 'Propriétaire',
  reservation: 'Réservation',
  contract: 'Contrat',
  commercial_lead: 'Lead commercial',
  reservation_lead: 'Lead réservation',
  cleaning_task: 'Tâche de ménage',
  maintenance_ticket: 'Ticket maintenance',
  expense: 'Dépense',
  owner_payment: 'Versement',
  document: 'Document',
};

const ENTITY_ICON: Record<ArchivedEntityType, string> = {
  property: 'apartment',
  owner: 'real_estate_agent',
  reservation: 'event',
  contract: 'description',
  commercial_lead: 'person_add',
  reservation_lead: 'event_available',
  cleaning_task: 'cleaning_services',
  maintenance_ticket: 'build',
  expense: 'receipt_long',
  owner_payment: 'account_balance_wallet',
  document: 'draft',
};

const TYPE_FILTERS: (ArchivedEntityType | 'all')[] = [
  'all',
  'property',
  'owner',
  'reservation',
  'contract',
  'commercial_lead',
  'reservation_lead',
  'cleaning_task',
  'maintenance_ticket',
  'expense',
  'owner_payment',
  'document',
];

export default function ArchivedItemsScreen() {
  return (
    <AccessGuard resource="archived_items">
      <ArchivedItemsContent />
    </AccessGuard>
  );
}

function ArchivedItemsContent() {
  const { data: items, isLoading, isError, refetch } = useArchivedItems();
  const restoreItem = useRestoreItem();
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<ArchivedEntityType | 'all'>('all');

  const filtered = useMemo(() => {
    return (items ?? []).filter((item) => {
      const matchesType = typeFilter === 'all' || item.entity_type === typeFilter;
      const q = query.trim().toLowerCase();
      const matchesQuery = !q || item.label.toLowerCase().includes(q) || (item.archived_by_name ?? '').toLowerCase().includes(q);
      return matchesType && matchesQuery;
    });
  }, [items, query, typeFilter]);

  const handleRestore = (entityType: ArchivedEntityType, entityId: string, label: string) => {
    confirmDestructive(
      'Restaurer cet élément ?',
      `${label} redeviendra visible et actif dans l'application.`,
      () => {
        restoreItem.mutate(
          { entityType, entityId },
          {
            onSuccess: () => notify('Restauré', `${label} a été restauré avec succès.`),
            onError: (error) => notify('Erreur', getErrorMessage(error, 'Impossible de restaurer cet élément.')),
          }
        );
      },
      'Restaurer'
    );
  };

  return (
    <Screen contentPadding={false}>
      <ScreenHeader title="Éléments archivés" subtitle={items ? `${items.length} au total` : 'Chargement…'} showBack fallbackHref="/more" />

      <View style={{ paddingHorizontal: 22, paddingTop: 8 }}>
        <SearchBar value={query} onChangeText={setQuery} placeholder="Nom, numéro, archivé par…" />
      </View>
      <View style={{ paddingTop: 10 }}>
        <FilterChipRow
          options={TYPE_FILTERS}
          active={typeFilter}
          onChange={setTypeFilter}
          getLabel={(v) => (v === 'all' ? 'Tous' : ENTITY_LABEL[v])}
        />
      </View>

      {isLoading && <LoadingState label="Chargement des éléments archivés…" />}
      {isError && <ErrorState message="Impossible de charger les éléments archivés." onRetry={refetch} />}
      {!isLoading && !isError && filtered.length === 0 && (
        <EmptyState icon="restore_from_trash" message="Aucun élément archivé ne correspond à cette recherche." />
      )}

      {!isLoading && !isError && (
        <View style={styles.list}>
          {filtered.map((item) => (
            <Card key={`${item.entity_type}-${item.entity_id}`} style={styles.row}>
              <View style={styles.rowTop}>
                <View style={{ flex: 1 }}>
                  <View style={styles.badgeRow}>
                    <Badge label={ENTITY_LABEL[item.entity_type]} bg="#EEF0F4" color={AmkouyColors.textMuted} size="sm" />
                  </View>
                  <Text style={styles.label}>{item.label}</Text>
                  <Text style={styles.meta}>
                    Archivé le {new Date(item.archived_at).toLocaleDateString('fr-FR')} · par {item.archived_by_name ?? 'Inconnu'}
                  </Text>
                </View>
                <Pressable
                  onPress={() => handleRestore(item.entity_type, item.entity_id, item.label)}
                  style={styles.restoreButton}>
                  <Icon name="restore" size={16} color={AmkouyColors.primary} />
                  <Text style={styles.restoreButtonText}>Restaurer</Text>
                </Pressable>
              </View>
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 22, paddingTop: 14, gap: 10, paddingBottom: 30 },
  row: { padding: 14 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  badgeRow: { flexDirection: 'row', marginBottom: 4 },
  label: { ...robotoText(600, 14, { color: AmkouyColors.text }) },
  meta: { ...robotoText(400, 11.5, { color: AmkouyColors.textFaint, marginTop: 3 }) },
  restoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 17,
    backgroundColor: AmkouyColors.secondaryContainer,
  },
  restoreButtonText: { ...robotoText(700, 12, { color: AmkouyColors.primary }) },
});

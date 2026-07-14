import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AccessGuard } from '@/components/amkouy/access-guard';
import { Badge } from '@/components/amkouy/badge';
import { Card } from '@/components/amkouy/card';
import { EmptyState } from '@/components/amkouy/empty-state';
import { ErrorState } from '@/components/amkouy/error-state';
import { ListFilterBar } from '@/components/amkouy/list-filter-bar';
import { LoadingState } from '@/components/amkouy/loading-state';
import { Screen } from '@/components/amkouy/screen';
import { ScreenHeader } from '@/components/amkouy/screen-header';
import { SortOption } from '@/components/amkouy/sort-selector';
import { StatusFilter } from '@/components/amkouy/status-filter';
import { CommercialLeadForm } from '@/components/forms/commercial-lead-form';
import { Icon } from '@/components/icon';
import { AmkouyColors } from '@/constants/amkouy-theme';
import { robotoText } from '@/constants/typography';
import { useCommercialLeads, useCreateCommercialLead } from '@/hooks/use-commercial-leads';
import { LeadStatus } from '@/lib/queries/commercial-leads';
import { CommercialLeadFormValues, LEAD_STATUS_OPTIONS } from '@/lib/validation/commercial-lead';
import { notify } from '@/utils/alert';
import { getErrorMessage } from '@/utils/errors';

const STATUS_LABEL = Object.fromEntries(LEAD_STATUS_OPTIONS.map((o) => [o.value, o.label]));

type SortValue = 'created_desc' | 'created_asc' | 'updated_desc' | 'updated_asc' | 'agent_asc';

const SORT_OPTIONS: SortOption<SortValue>[] = [
  { label: 'Plus récents (création)', value: 'created_desc' },
  { label: 'Plus anciens (création)', value: 'created_asc' },
  { label: 'Récemment mis à jour', value: 'updated_desc' },
  { label: 'Moins récemment mis à jour', value: 'updated_asc' },
  { label: 'Agent A-Z', value: 'agent_asc' },
];

function compareStrings(a: string, b: string) {
  return a.localeCompare(b);
}
const STATUS_COLOR: Record<string, { bg: string; text: string }> = {
  new: { bg: '#E3E9F4', text: '#1E3A6E' },
  contacted: { bg: '#EEEAFB', text: '#6D4FC9' },
  visit_scheduled: { bg: '#FDEBC8', text: '#B45309' },
  proposal_sent: { bg: '#F8EFD4', text: '#8a6d1c' },
  negotiation: { bg: '#FDEBC8', text: '#B45309' },
  won: { bg: '#DEF7E6', text: '#15803D' },
  lost: { bg: '#FAD9D9', text: '#B91C1C' },
};

export default function CommercialLeadsScreen() {
  return (
    <AccessGuard resource="commercial_leads">
      <CommercialLeadsContent />
    </AccessGuard>
  );
}

function CommercialLeadsContent() {
  const [query, setQuery] = useState('');
  const [statuses, setStatuses] = useState<LeadStatus[]>([]);
  const [sortBy, setSortBy] = useState<SortValue>('created_desc');
  const [showCreate, setShowCreate] = useState(false);

  const { data: leads, isLoading, isError, refetch } = useCommercialLeads({ statuses });
  const createLead = useCreateCommercialLead();

  const filtered = useMemo(() => {
    const list = (leads ?? []).filter((lead) => {
      if (query.trim().length === 0) return true;
      const q = query.toLowerCase();
      return (
        lead.owner_name.toLowerCase().includes(q) ||
        lead.lead_number.toLowerCase().includes(q) ||
        (lead.city ?? '').toLowerCase().includes(q)
      );
    });
    const sorted = [...list];
    sorted.sort((a, b) => {
      switch (sortBy) {
        case 'created_desc':
          return compareStrings(b.created_at, a.created_at);
        case 'created_asc':
          return compareStrings(a.created_at, b.created_at);
        case 'updated_desc':
          return compareStrings(b.updated_at, a.updated_at);
        case 'updated_asc':
          return compareStrings(a.updated_at, b.updated_at);
        case 'agent_asc':
          return compareStrings(a.assignedAgent?.full_name ?? '', b.assignedAgent?.full_name ?? '');
        default:
          return 0;
      }
    });
    return sorted;
  }, [leads, query, sortBy]);

  const handleCreate = (values: CommercialLeadFormValues) => {
    createLead.mutate(
      {
        ownerName: values.ownerName,
        phone: values.phone,
        email: values.email,
        source: values.source,
        propertyType: values.propertyType,
        city: values.city,
        estimatedUnits: values.estimatedUnits,
        notes: values.notes,
        assignedTo: values.assignedTo,
      },
      {
        onSuccess: () => {
          setShowCreate(false);
          notify('Lead créé', `${values.ownerName} a été ajouté au pipeline.`);
        },
        onError: (error) => notify('Erreur', getErrorMessage(error, 'Impossible de créer le lead.')),
      }
    );
  };

  return (
    <Screen>
      <ScreenHeader
        title="Leads propriétaires"
        subtitle={leads ? `${filtered.length} leads` : 'Chargement…'}
        showBack
        fallbackHref="/more/commercial"
        trailing={
          <Pressable onPress={() => setShowCreate(true)} style={styles.addButton}>
            <Icon name="add" size={22} color="#fff" />
          </Pressable>
        }
      />

      <ListFilterBar
        searchValue={query}
        onSearchChange={setQuery}
        searchPlaceholder="Propriétaire, ville…"
        sortOptions={SORT_OPTIONS}
        sortValue={sortBy}
        onSortChange={setSortBy}
        onRefresh={refetch}
      />
      <View style={styles.filterRow}>
        <StatusFilter options={LEAD_STATUS_OPTIONS} value={statuses} onChange={setStatuses} />
      </View>

      {isLoading && <LoadingState label="Chargement des leads…" />}
      {isError && <ErrorState message="Impossible de charger les leads." onRetry={refetch} />}
      {!isLoading && !isError && filtered.length === 0 && (
        <EmptyState icon="person_add" message="Aucun lead ne correspond à votre recherche." />
      )}

      {!isLoading && !isError && (
        <View style={styles.list}>
          {filtered.map((lead) => {
            const colors = STATUS_COLOR[lead.status];
            return (
              <Pressable key={lead.id} onPress={() => router.push(`/more/commercial/leads/${lead.id}`)}>
                <Card style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{lead.owner_name}</Text>
                    <Text style={styles.sub}>
                      {lead.lead_number} · {lead.city ?? '—'} · {lead.assignedAgent?.full_name ?? 'Non assigné'}
                    </Text>
                  </View>
                  <Badge label={STATUS_LABEL[lead.status] ?? lead.status} bg={colors.bg} color={colors.text} />
                  <Icon name="chevron_right" size={20} color="#c2c7cf" />
                </Card>
              </Pressable>
            );
          })}
        </View>
      )}

      <CommercialLeadForm visible={showCreate} mode="create" onClose={() => setShowCreate(false)} onSubmit={handleCreate} submitting={createLead.isPending} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  addButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: AmkouyColors.primary, alignItems: 'center', justifyContent: 'center' },
  filterRow: { paddingTop: 10, paddingBottom: 4 },
  list: { paddingHorizontal: 22, gap: 11, marginTop: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  name: { ...robotoText(600, 14, { color: AmkouyColors.text }) },
  sub: { ...robotoText(400, 11, { color: AmkouyColors.textFaint, marginTop: 2 }) },
});

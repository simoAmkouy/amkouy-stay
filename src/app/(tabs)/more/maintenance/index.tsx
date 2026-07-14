import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AccessGuard } from '@/components/amkouy/access-guard';
import { Avatar } from '@/components/amkouy/avatar';
import { Badge } from '@/components/amkouy/badge';
import { Card } from '@/components/amkouy/card';
import { EmptyState } from '@/components/amkouy/empty-state';
import { ErrorState } from '@/components/amkouy/error-state';
import { ListFilterBar } from '@/components/amkouy/list-filter-bar';
import { LoadingState } from '@/components/amkouy/loading-state';
import { Screen } from '@/components/amkouy/screen';
import { SelectField } from '@/components/amkouy/select-field';
import { SortOption } from '@/components/amkouy/sort-selector';
import { StatusFilter } from '@/components/amkouy/status-filter';
import { MaintenanceTicketForm } from '@/components/forms/maintenance-ticket-form';
import { Icon } from '@/components/icon';
import { AmkouyColors } from '@/constants/amkouy-theme';
import { robotoText } from '@/constants/typography';
import { useAuth } from '@/hooks/use-auth';
import { useCreateMaintenanceTicket, useMaintenanceTickets } from '@/hooks/use-maintenance-tickets';
import { useProperties } from '@/hooks/use-properties';
import { useTranslation } from '@/hooks/use-translation';
import { TranslationKey } from '@/i18n';
import { MaintenancePriority, MaintenanceStatus, MaintenanceTicketWithRelations } from '@/lib/queries/maintenance-tickets';
import { MAINTENANCE_STATUS_OPTIONS, MaintenanceTicketCreateValues } from '@/lib/validation/maintenance-ticket';
import { notify } from '@/utils/alert';
import { computeRangeForFilter, toDateOnlyString } from '@/utils/date-range';
import { getErrorMessage } from '@/utils/errors';

const PRIORITY_RANK: Record<MaintenancePriority, number> = { low: 0, normal: 1, high: 2, urgent: 3 };
const OPEN_MAINTENANCE_STATUSES = new Set(['open', 'assigned', 'in_progress', 'on_hold']);

type SortValue =
  | 'created_desc'
  | 'created_asc'
  | 'updated_desc'
  | 'updated_asc'
  | 'priority_desc'
  | 'priority_asc'
  | 'cost_desc'
  | 'cost_asc'
  | 'property_asc'
  | 'technician_asc';

const SORT_OPTIONS: SortOption<SortValue>[] = [
  { label: 'Plus récents (création)', value: 'created_desc' },
  { label: 'Plus anciens (création)', value: 'created_asc' },
  { label: 'Récemment mis à jour', value: 'updated_desc' },
  { label: 'Moins récemment mis à jour', value: 'updated_asc' },
  { label: 'Priorité (élevée → basse)', value: 'priority_desc' },
  { label: 'Priorité (basse → élevée)', value: 'priority_asc' },
  { label: 'Coût décroissant', value: 'cost_desc' },
  { label: 'Coût croissant', value: 'cost_asc' },
  { label: 'Bien A-Z', value: 'property_asc' },
  { label: 'Technicien A-Z', value: 'technician_asc' },
];

function compareStrings(a: string, b: string) {
  return a.localeCompare(b);
}

function ticketCost(t: MaintenanceTicketWithRelations): number {
  return t.actual_cost ?? t.estimated_cost ?? 0;
}

const STATUS_LABEL_KEY: Record<MaintenanceStatus, TranslationKey> = {
  open: 'maintenance.open',
  assigned: 'maintenance.assigned',
  in_progress: 'maintenance.inProgress',
  on_hold: 'maintenance.onHold',
  resolved: 'maintenance.resolved',
  closed: 'maintenance.closed',
  cancelled: 'maintenance.cancelled',
};
const STATUS_COLOR: Record<MaintenanceStatus, { bg: string; text: string }> = {
  open: { bg: '#E3E9F4', text: '#1E3A6E' },
  assigned: { bg: '#EEEAFB', text: '#6D4FC9' },
  in_progress: { bg: '#FDEBC8', text: '#B45309' },
  on_hold: { bg: '#F8EFD4', text: '#8a6d1c' },
  resolved: { bg: '#DEF7E6', text: '#15803D' },
  closed: { bg: '#DDEEFB', text: '#0C5C8A' },
  cancelled: { bg: '#FAD9D9', text: '#B91C1C' },
};
const PRIORITY_COLOR: Record<MaintenancePriority, string> = {
  low: '#5A5E66',
  normal: '#1E3A6E',
  high: '#B45309',
  urgent: '#B91C1C',
};

function initialsOf(name: string): string {
  return name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export default function MaintenanceScreen() {
  return (
    <AccessGuard resource="maintenance">
      <MaintenanceContent />
    </AccessGuard>
  );
}

const OPEN_MAINTENANCE_STATUS_LIST: MaintenanceStatus[] = ['open', 'assigned', 'in_progress', 'on_hold'];

function MaintenanceContent() {
  const { profile } = useAuth();
  const { t } = useTranslation();
  const isStaff = profile?.role === 'admin' || profile?.role === 'super_admin' || profile?.role === 'manager';
  // Command Center deep-links (Mission D, Phase 9): `?status=open` etc. seeds the status filter;
  // `?view=urgent` seeds every open status and sorts by priority so a tap from the Operations
  // Center's "Tickets urgents" tile lands on urgent-first without a second filter dimension.
  const params = useLocalSearchParams<{ status?: string; view?: string }>();
  const initialStatuses = useMemo<MaintenanceStatus[]>(() => {
    if (params.view === 'urgent' || params.view === 'waiting_parts' || params.view === 'aging') return OPEN_MAINTENANCE_STATUS_LIST;
    if (params.status) return params.status.split(',') as MaintenanceStatus[];
    return [];
  }, [params.status, params.view]);
  const [query, setQuery] = useState('');
  const [statuses, setStatuses] = useState<MaintenanceStatus[]>(initialStatuses);
  const [propertyFilter, setPropertyFilter] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortValue>(params.view === 'urgent' ? 'priority_desc' : 'created_desc');
  const [showCreate, setShowCreate] = useState(false);

  const { data: tickets, isLoading, isError, refetch } = useMaintenanceTickets({ statuses, propertyId: propertyFilter });
  const { data: properties } = useProperties();
  const createTicket = useCreateMaintenanceTicket();

  const propertyOptions = (properties ?? []).map((p) => ({ label: `${p.name} · ${p.city}`, value: p.id }));

  const openCount = (tickets ?? []).filter((t) => ['open', 'assigned', 'in_progress', 'on_hold'].includes(t.status)).length;
  const urgentCount = (tickets ?? []).filter((t) => t.priority === 'urgent' && t.status !== 'closed' && t.status !== 'cancelled').length;

  // Technician Home (Command Center, Phase 6): the raw list below still applies (a technician
  // sees their own tickets, per `maintenance_tickets_select` RLS) — this block adds the Open
  // Work / Performance grouping on top, computed from that same already-fetched `tickets` set.
  const isTechnician = profile?.role === 'technician';
  const myTickets = useMemo(() => (tickets ?? []).filter((t) => t.assigned_to_user_id === profile?.id), [tickets, profile?.id]);
  const technicianKpis = useMemo(() => {
    if (!isTechnician) return null;
    const now = new Date();
    const weekRange = computeRangeForFilter('this_week');
    const weekStartStr = toDateOnlyString(weekRange.start);
    const weekEndStr = toDateOnlyString(weekRange.end);
    const nonCancelled = myTickets.filter((t) => t.status !== 'cancelled');
    const open = nonCancelled.filter((t) => OPEN_MAINTENANCE_STATUSES.has(t.status));
    const resolvedThisWeek = nonCancelled.filter(
      (t) =>
        (t.status === 'resolved' || t.status === 'closed') &&
        t.resolved_at &&
        toDateOnlyString(new Date(t.resolved_at)) >= weekStartStr &&
        toDateOnlyString(new Date(t.resolved_at)) <= weekEndStr
    );
    const resolutionHours = resolvedThisWeek
      .filter((t) => t.resolved_at)
      .map((t) => (new Date(t.resolved_at as string).getTime() - new Date(t.created_at).getTime()) / 3_600_000);
    return {
      assigned: open,
      urgent: open.filter((t) => t.priority === 'urgent'),
      waitingParts: open.filter((t) => t.status === 'on_hold'),
      overdue: open.filter((t) => t.sla_due_at && new Date(t.sla_due_at) < now),
      resolvedThisWeek,
      avgResolutionHours: resolutionHours.length > 0 ? resolutionHours.reduce((s, h) => s + h, 0) / resolutionHours.length : null,
    };
  }, [isTechnician, myTickets]);

  const filtered = useMemo(() => {
    const list = (tickets ?? []).filter((ticket) => {
      if (query.trim().length === 0) return true;
      const q = query.toLowerCase();
      return (
        ticket.issue_summary.toLowerCase().includes(q) ||
        ticket.ticket_number.toLowerCase().includes(q) ||
        (ticket.property?.name ?? '').toLowerCase().includes(q) ||
        (ticket.technician?.full_name ?? '').toLowerCase().includes(q)
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
        case 'priority_desc':
          return PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority];
        case 'priority_asc':
          return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
        case 'cost_desc':
          return ticketCost(b) - ticketCost(a);
        case 'cost_asc':
          return ticketCost(a) - ticketCost(b);
        case 'property_asc':
          return compareStrings(a.property?.name ?? '', b.property?.name ?? '');
        case 'technician_asc':
          return compareStrings(a.technician?.full_name ?? '', b.technician?.full_name ?? '');
        default:
          return 0;
      }
    });
    return sorted;
  }, [tickets, query, sortBy]);

  const handleCreate = (values: MaintenanceTicketCreateValues) => {
    if (!profile) return;
    createTicket.mutate(
      {
        propertyId: values.propertyId,
        category: values.category,
        priority: values.priority,
        issueSummary: values.issueSummary,
        description: values.description,
        scheduledDate: values.scheduledDate || null,
        estimatedCost: values.estimatedCost,
        reportedBy: profile.id,
      },
      {
        onSuccess: () => {
          setShowCreate(false);
          notify(t('maintenance.ticketCreatedTitle'), t('maintenance.ticketCreatedMessage'));
        },
        onError: (error) => notify(t('common.error'), getErrorMessage(error, t('maintenance.createError'))),
      }
    );
  };

  return (
    <Screen contentPadding={false}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>{t('maintenance.title')}</Text>
          <Text style={styles.subtitle}>
            {tickets ? t('maintenance.openUrgentSummary', { open: openCount, urgent: urgentCount }) : t('common.loading')}
          </Text>
        </View>
        {isStaff && (
          <Pressable onPress={() => setShowCreate(true)} style={styles.addButton}>
            <Icon name="add" size={24} color="#fff" />
          </Pressable>
        )}
      </View>

      {technicianKpis && (
        <View style={styles.homeSection}>
          <Text style={styles.homeSectionTitle}>Travaux ouverts</Text>
          <View style={styles.homeKpiRow}>
            <HomeKpiTile label="Assignés" value={technicianKpis.assigned.length} color={AmkouyColors.primaryContainer} />
            <HomeKpiTile label="Urgents" value={technicianKpis.urgent.length} color={AmkouyColors.error} />
          </View>
          <View style={styles.homeKpiRow}>
            <HomeKpiTile label="Attente pièces" value={technicianKpis.waitingParts.length} color="#8a6d1c" />
            <HomeKpiTile label="En retard (SLA)" value={technicianKpis.overdue.length} color={AmkouyColors.error} />
          </View>
          <Text style={styles.homeSectionTitle}>Performance</Text>
          <View style={styles.homeKpiRow}>
            <HomeKpiTile label="Résolus cette semaine" value={technicianKpis.resolvedThisWeek.length} color={AmkouyColors.success} />
            <HomeKpiTile
              label="Temps moyen de résolution"
              value={technicianKpis.avgResolutionHours != null ? `${Math.round(technicianKpis.avgResolutionHours)}h` : '—'}
              color={AmkouyColors.primaryContainer}
            />
          </View>
        </View>
      )}

      <ListFilterBar
        searchValue={query}
        onSearchChange={setQuery}
        searchPlaceholder="Problème, bien, technicien…"
        sortOptions={SORT_OPTIONS}
        sortValue={sortBy}
        onSortChange={setSortBy}
        onRefresh={refetch}
      />

      <View style={styles.filterRow}>
        <StatusFilter
          options={MAINTENANCE_STATUS_OPTIONS}
          value={statuses}
          onChange={setStatuses}
          allLabel={t('maintenance.all')}
        />
      </View>

      {isStaff && (
        <View style={styles.propertyFilterWrap}>
          <SelectField
            label={t('maintenance.filterByProperty')}
            value={propertyFilter}
            options={propertyOptions}
            onChange={setPropertyFilter}
            placeholder={t('maintenance.allProperties')}
          />
        </View>
      )}

      {isLoading && <LoadingState label={t('maintenance.loadingTickets')} />}
      {isError && <ErrorState message={t('maintenance.loadError')} onRetry={refetch} />}
      {!isLoading && !isError && filtered.length === 0 && (
        <EmptyState icon="build" message={t('maintenance.noMatch')} />
      )}

      {!isLoading && !isError && (
        <View style={styles.list}>
          {filtered.map((ticket) => (
            <MaintenanceTicketRow key={ticket.id} ticket={ticket} />
          ))}
        </View>
      )}

      <MaintenanceTicketForm
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onSubmit={handleCreate}
        submitting={createTicket.isPending}
      />
    </Screen>
  );
}

function HomeKpiTile({ label, value, color }: { label: string; value: number | string; color?: string }) {
  return (
    <View style={styles.homeKpiTile}>
      <Text style={[styles.homeKpiValue, color ? { color } : null]}>{value}</Text>
      <Text style={styles.homeKpiLabel}>{label}</Text>
    </View>
  );
}

function MaintenanceTicketRow({ ticket }: { ticket: MaintenanceTicketWithRelations }) {
  const { t } = useTranslation();
  const statusColors = STATUS_COLOR[ticket.status];
  const priorityColor = PRIORITY_COLOR[ticket.priority];
  return (
    <Pressable onPress={() => router.push(`/more/maintenance/${ticket.id}`)}>
      <Card style={[styles.row, { borderLeftColor: priorityColor }]}>
        <View style={styles.topRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.issue}>{ticket.issue_summary}</Text>
            <View style={styles.locationRow}>
              <Icon name="location_on" size={14} color={AmkouyColors.secondary} />
              <Text style={styles.property}>{ticket.property?.name ?? '—'}</Text>
            </View>
          </View>
          <Badge label={ticket.ticket_number} bg="#EEF0F4" color={AmkouyColors.textMuted} size="sm" />
        </View>
        <View style={styles.bottomRow}>
          <View style={styles.techRow}>
            {ticket.technician ? (
              <>
                <Avatar initials={initialsOf(ticket.technician.full_name)} size={26} bg={AmkouyColors.primaryContainer} />
                <Text style={styles.techName}>{ticket.technician.full_name}</Text>
              </>
            ) : (
              <Text style={styles.techName}>{t('common.notAssigned')}</Text>
            )}
          </View>
          <Badge label={t(STATUS_LABEL_KEY[ticket.status])} bg={statusColors.bg} color={statusColors.text} />
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 22,
    paddingTop: 8,
    paddingBottom: 4,
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
    paddingTop: 10,
    paddingBottom: 4,
  },
  homeSection: {
    paddingHorizontal: 22,
    paddingTop: 10,
  },
  homeSectionTitle: {
    ...robotoText(700, 13, { color: AmkouyColors.primary, marginBottom: 8 }),
  },
  homeKpiRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  homeKpiTile: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: AmkouyColors.hairline,
    borderRadius: 13,
    padding: 12,
    alignItems: 'center',
  },
  homeKpiValue: {
    ...robotoText(900, 18, { color: AmkouyColors.text }),
  },
  homeKpiLabel: {
    ...robotoText(500, 10, { color: AmkouyColors.textFaint, marginTop: 2, textAlign: 'center' }),
  },
  propertyFilterWrap: {
    paddingHorizontal: 22,
  },
  list: {
    paddingHorizontal: 22,
    paddingTop: 14,
    gap: 11,
    paddingBottom: 22,
  },
  row: {
    padding: 14,
    borderLeftWidth: 4,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  issue: {
    ...robotoText(600, 14.5, { color: AmkouyColors.text }),
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 3,
  },
  property: {
    ...robotoText(400, 11.5, { color: AmkouyColors.textFaint }),
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 11,
    borderTopWidth: 1,
    borderTopColor: AmkouyColors.hairline,
  },
  techRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  techName: {
    ...robotoText(500, 11.5, { color: AmkouyColors.textMuted }),
  },
});

import { router, useLocalSearchParams } from 'expo-router';
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
import { SelectField } from '@/components/amkouy/select-field';
import { SortOption } from '@/components/amkouy/sort-selector';
import { StatusFilter } from '@/components/amkouy/status-filter';
import { CleaningTaskForm } from '@/components/forms/cleaning-task-form';
import { Icon } from '@/components/icon';
import { AmkouyColors } from '@/constants/amkouy-theme';
import { robotoText } from '@/constants/typography';
import { useAuth } from '@/hooks/use-auth';
import { useCleaningTasks, useCreateCleaningTask } from '@/hooks/use-cleaning-tasks';
import { useProperties } from '@/hooks/use-properties';
import { useTranslation } from '@/hooks/use-translation';
import { TranslationKey } from '@/i18n';
import { CleaningStatus, CleaningTaskWithRelations } from '@/lib/queries/cleaning-tasks';
import { CLEANING_STATUS_OPTIONS, CleaningTaskCreateValues } from '@/lib/validation/cleaning-task';
import { notify } from '@/utils/alert';
import { computeRangeForFilter, toDateOnlyString } from '@/utils/date-range';
import { getErrorMessage } from '@/utils/errors';

const OPEN_CLEANING_STATUSES = new Set(['unassigned', 'scheduled', 'in_progress']);

const STATUS_LABEL_KEY: Record<CleaningStatus, TranslationKey> = {
  unassigned: 'cleaning.unassigned',
  scheduled: 'cleaning.scheduled',
  in_progress: 'cleaning.inProgress',
  completed: 'cleaning.completed',
  verified: 'cleaning.verified',
  cancelled: 'cleaning.cancelled',
};

type SortValue =
  | 'created_desc'
  | 'created_asc'
  | 'updated_desc'
  | 'updated_asc'
  | 'scheduled_asc'
  | 'scheduled_desc'
  | 'cleaner_asc'
  | 'property_asc';

const SORT_OPTIONS: SortOption<SortValue>[] = [
  { label: 'Plus récentes (création)', value: 'created_desc' },
  { label: 'Plus anciennes (création)', value: 'created_asc' },
  { label: 'Récemment mises à jour', value: 'updated_desc' },
  { label: 'Moins récemment mises à jour', value: 'updated_asc' },
  { label: 'Date planifiée (croissant)', value: 'scheduled_asc' },
  { label: 'Date planifiée (décroissant)', value: 'scheduled_desc' },
  { label: 'Agent de ménage A-Z', value: 'cleaner_asc' },
  { label: 'Bien A-Z', value: 'property_asc' },
];

function compareStrings(a: string, b: string) {
  return a.localeCompare(b);
}
const STATUS_COLOR: Record<CleaningStatus, { bg: string; text: string }> = {
  unassigned: { bg: '#EEF0F4', text: '#5A5E66' },
  scheduled: { bg: '#EEEAFB', text: '#6D4FC9' },
  in_progress: { bg: '#FDEBC8', text: '#B45309' },
  completed: { bg: '#DEF7E6', text: '#15803D' },
  verified: { bg: '#DDEEFB', text: '#0C5C8A' },
  cancelled: { bg: '#FAD9D9', text: '#B91C1C' },
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function CleaningScreen() {
  return (
    <AccessGuard resource="cleaning">
      <CleaningContent />
    </AccessGuard>
  );
}

const OPEN_CLEANING_STATUS_LIST: CleaningStatus[] = ['unassigned', 'scheduled', 'in_progress'];

function CleaningContent() {
  const { profile } = useAuth();
  const { t } = useTranslation();
  const isStaff = profile?.role === 'admin' || profile?.role === 'super_admin' || profile?.role === 'manager';
  // Command Center deep-links (Mission D, Phase 9): `?status=unassigned` etc. seeds the status
  // filter; `?view=overdue` (no single real status means "overdue") seeds the open statuses and
  // sorts oldest-scheduled-first, so a tap from the Operations Center's "Ménages en retard" tile
  // lands on essentially that list without inventing a second, parallel filter dimension.
  const params = useLocalSearchParams<{ status?: string; view?: string }>();
  const initialStatuses = useMemo<CleaningStatus[]>(() => {
    if (params.view === 'overdue') return OPEN_CLEANING_STATUS_LIST;
    if (params.status) return params.status.split(',') as CleaningStatus[];
    return [];
  }, [params.status, params.view]);
  const [query, setQuery] = useState('');
  const [statuses, setStatuses] = useState<CleaningStatus[]>(initialStatuses);
  const [propertyFilter, setPropertyFilter] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortValue>('scheduled_asc');
  const [showCreate, setShowCreate] = useState(false);

  const { data: tasks, isLoading, isError, refetch } = useCleaningTasks({ statuses, propertyId: propertyFilter });
  const { data: properties } = useProperties();
  const createTask = useCreateCleaningTask();

  const propertyOptions = (properties ?? []).map((p) => ({ label: `${p.name} · ${p.city}`, value: p.id }));

  const today = todayISO();
  const todayTasks = (tasks ?? []).filter((t) => t.scheduled_date === today);
  const todayCompleted = todayTasks.filter((t) => t.status === 'completed' || t.status === 'verified').length;
  const progressPct = todayTasks.length > 0 ? Math.round((todayCompleted / todayTasks.length) * 100) : 0;

  // Cleaner Home (Command Center, Phase 5): the raw list below still applies (a cleaner sees
  // their own tasks, per `cleaning_tasks_select` RLS) — this block adds the Today/Attention/
  // Workload grouping on top, computed from that same already-fetched `tasks` collection.
  const isCleaner = profile?.role === 'cleaner';
  const myTasks = useMemo(() => (tasks ?? []).filter((t) => t.assigned_to_user_id === profile?.id), [tasks, profile?.id]);
  const cleanerKpis = useMemo(() => {
    if (!isCleaner) return null;
    const weekRange = computeRangeForFilter('this_week');
    const weekStartStr = toDateOnlyString(weekRange.start);
    const weekEndStr = toDateOnlyString(weekRange.end);
    const nonCancelled = myTasks.filter((t) => t.status !== 'cancelled');
    return {
      dueToday: nonCancelled.filter((t) => t.scheduled_date === today && OPEN_CLEANING_STATUSES.has(t.status)),
      startingSoon: nonCancelled.filter((t) => t.scheduled_date === today && (t.status === 'unassigned' || t.status === 'scheduled')),
      completedToday: nonCancelled.filter((t) => (t.status === 'completed' || t.status === 'verified') && t.scheduled_date === today),
      overdue: nonCancelled.filter((t) => OPEN_CLEANING_STATUSES.has(t.status) && t.scheduled_date < today),
      verificationPending: nonCancelled.filter((t) => t.status === 'completed'),
      assignedThisWeek: nonCancelled.filter((t) => t.scheduled_date >= weekStartStr && t.scheduled_date <= weekEndStr),
      completedThisWeek: nonCancelled.filter(
        (t) => (t.status === 'completed' || t.status === 'verified') && t.scheduled_date >= weekStartStr && t.scheduled_date <= weekEndStr
      ),
    };
  }, [isCleaner, myTasks, today]);

  const filtered = useMemo(() => {
    const list = (tasks ?? []).filter((task) => {
      if (query.trim().length === 0) return true;
      const q = query.toLowerCase();
      return (
        (task.property?.name ?? '').toLowerCase().includes(q) ||
        (task.cleaner?.full_name ?? '').toLowerCase().includes(q) ||
        task.task_number.toLowerCase().includes(q)
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
        case 'scheduled_asc':
          return compareStrings(a.scheduled_date, b.scheduled_date);
        case 'scheduled_desc':
          return compareStrings(b.scheduled_date, a.scheduled_date);
        case 'cleaner_asc':
          return compareStrings(a.cleaner?.full_name ?? '', b.cleaner?.full_name ?? '');
        case 'property_asc':
          return compareStrings(a.property?.name ?? '', b.property?.name ?? '');
        default:
          return 0;
      }
    });
    return sorted;
  }, [tasks, query, sortBy]);

  const handleCreate = (values: CleaningTaskCreateValues) => {
    createTask.mutate(values, {
      onSuccess: () => {
        setShowCreate(false);
        notify(t('cleaning.taskCreatedTitle'), t('cleaning.taskCreatedMessage'));
      },
      onError: (error) => notify(t('common.error'), getErrorMessage(error, t('cleaning.createError'))),
    });
  };

  return (
    <Screen contentPadding={false}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>{t('cleaning.title')}</Text>
          <Text style={styles.subtitle}>
            {tasks ? t('cleaning.todaySummary', { count: todayTasks.length, completed: todayCompleted }) : t('common.loading')}
          </Text>
        </View>
        {isStaff && (
          <Pressable onPress={() => setShowCreate(true)} style={styles.addButton}>
            <Icon name="add" size={24} color="#fff" />
          </Pressable>
        )}
      </View>

      {todayTasks.length > 0 && (
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.max(4, progressPct)}%` }]} />
        </View>
      )}

      {cleanerKpis && (
        <View style={styles.homeSection}>
          <Text style={styles.homeSectionTitle}>Aujourd&apos;hui</Text>
          <View style={styles.homeKpiRow}>
            <HomeKpiTile label="À faire aujourd'hui" value={cleanerKpis.dueToday.length} color={AmkouyColors.primaryContainer} />
            <HomeKpiTile label="À démarrer" value={cleanerKpis.startingSoon.length} color="#6D4FC9" />
            <HomeKpiTile label="Terminées aujourd'hui" value={cleanerKpis.completedToday.length} color={AmkouyColors.success} />
          </View>
          <Text style={styles.homeSectionTitle}>À traiter</Text>
          <View style={styles.homeKpiRow}>
            <HomeKpiTile label="En retard" value={cleanerKpis.overdue.length} color={AmkouyColors.error} />
            <HomeKpiTile label="En attente de vérification" value={cleanerKpis.verificationPending.length} color="#B45309" />
          </View>
          <Text style={styles.homeSectionTitle}>Charge de travail</Text>
          <View style={styles.homeKpiRow}>
            <HomeKpiTile label="Assignées cette semaine" value={cleanerKpis.assignedThisWeek.length} />
            <HomeKpiTile label="Terminées cette semaine" value={cleanerKpis.completedThisWeek.length} color={AmkouyColors.success} />
          </View>
        </View>
      )}

      <ListFilterBar
        searchValue={query}
        onSearchChange={setQuery}
        searchPlaceholder="Bien, agent, tâche…"
        sortOptions={SORT_OPTIONS}
        sortValue={sortBy}
        onSortChange={setSortBy}
        onRefresh={refetch}
      />

      <View style={styles.filterRow}>
        <StatusFilter
          options={CLEANING_STATUS_OPTIONS}
          value={statuses}
          onChange={setStatuses}
          allLabel={t('cleaning.all')}
        />
      </View>

      {isStaff && (
        <View style={styles.propertyFilterWrap}>
          <SelectField
            label={t('cleaning.filterByProperty')}
            value={propertyFilter}
            options={propertyOptions}
            onChange={setPropertyFilter}
            placeholder={t('cleaning.allProperties')}
          />
        </View>
      )}

      {isLoading && <LoadingState label={t('cleaning.loadingTasks')} />}
      {isError && <ErrorState message={t('cleaning.loadError')} onRetry={refetch} />}
      {!isLoading && !isError && filtered.length === 0 && (
        <EmptyState icon="cleaning_services" message={t('cleaning.noMatch')} />
      )}

      {!isLoading && !isError && (
        <View style={styles.list}>
          {filtered.map((task) => (
            <CleaningTaskRow key={task.id} task={task} />
          ))}
        </View>
      )}

      <CleaningTaskForm
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onSubmit={handleCreate}
        submitting={createTask.isPending}
      />
    </Screen>
  );
}

function HomeKpiTile({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <View style={styles.homeKpiTile}>
      <Text style={[styles.homeKpiValue, color ? { color } : null]}>{value}</Text>
      <Text style={styles.homeKpiLabel}>{label}</Text>
    </View>
  );
}

function CleaningTaskRow({ task }: { task: CleaningTaskWithRelations }) {
  const { t } = useTranslation();
  const colors = STATUS_COLOR[task.status];
  return (
    <Pressable onPress={() => router.push(`/more/cleaning/${task.id}`)}>
      <Card style={styles.row}>
        <View style={[styles.iconBox, { backgroundColor: colors.bg }]}>
          <Icon name="cleaning_services" size={22} color={colors.text} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.property}>{task.property?.name ?? '—'}</Text>
          <Text style={styles.sub}>
            {task.cleaner?.full_name ?? t('common.notAssigned')} · {task.scheduled_date}
          </Text>
        </View>
        <Badge label={t(STATUS_LABEL_KEY[task.status])} bg={colors.bg} color={colors.text} />
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
  progressTrack: {
    marginHorizontal: 22,
    marginTop: 14,
    marginBottom: 4,
    height: 10,
    borderRadius: 5,
    backgroundColor: AmkouyColors.hairline,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 5,
    backgroundColor: AmkouyColors.success,
  },
  filterRow: {
    paddingTop: 10,
    paddingBottom: 4,
  },
  homeSection: {
    paddingHorizontal: 22,
    paddingTop: 14,
  },
  homeSectionTitle: {
    ...robotoText(700, 13, { color: AmkouyColors.primary, marginBottom: 8 }),
  },
  homeKpiRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  property: {
    ...robotoText(600, 14, { color: AmkouyColors.text }),
  },
  sub: {
    ...robotoText(400, 11.5, { color: AmkouyColors.textFaint, marginTop: 2 }),
  },
});

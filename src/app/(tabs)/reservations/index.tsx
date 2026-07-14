import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AccessGuard } from '@/components/amkouy/access-guard';
import { Avatar } from '@/components/amkouy/avatar';
import { Badge } from '@/components/amkouy/badge';
import { Card } from '@/components/amkouy/card';
import { EmptyState } from '@/components/amkouy/empty-state';
import { ErrorState } from '@/components/amkouy/error-state';
import { FilterChipRow } from '@/components/amkouy/filter-chip-row';
import { FormField } from '@/components/amkouy/form-field';
import { FormModal } from '@/components/amkouy/form-modal';
import { ListFilterBar } from '@/components/amkouy/list-filter-bar';
import { LoadingState } from '@/components/amkouy/loading-state';
import { Screen } from '@/components/amkouy/screen';
import { SortOption } from '@/components/amkouy/sort-selector';
import { StatusFilter } from '@/components/amkouy/status-filter';
import { ReservationForm } from '@/components/forms/reservation-form';
import { Icon } from '@/components/icon';
import { AmkouyColors } from '@/constants/amkouy-theme';
import { robotoText } from '@/constants/typography';
import { useCreateReservation, useReservations } from '@/hooks/use-reservations';
import { DoubleBookingError, ReservationStatus } from '@/lib/queries/reservations';
import { RESERVATION_STATUS_OPTIONS, ReservationFormValues } from '@/lib/validation/reservation';
import { notify } from '@/utils/alert';
import { computeRangeForFilter, toDateOnlyString } from '@/utils/date-range';
import { getErrorMessage, logAppError } from '@/utils/errors';
import { formatMAD, getInitials } from '@/utils/format';

const STATUS_LABEL = Object.fromEntries(RESERVATION_STATUS_OPTIONS.map((o) => [o.value, o.label]));
const STATUS_COLOR: Record<string, { bg: string; text: string }> = {
  pending: { bg: '#FDEBC8', text: '#B45309' },
  confirmed: { bg: '#DEF7E6', text: '#15803D' },
  checked_in: { bg: '#E3E9F4', text: '#1E3A6E' },
  checked_out: { bg: '#E3E9F4', text: '#1E3A6E' },
  completed: { bg: '#EEF0F4', text: '#5A5E66' },
  cancelled: { bg: '#FAD9D9', text: '#B91C1C' },
  no_show: { bg: '#FAD9D9', text: '#B91C1C' },
};

type SortValue =
  | 'created_desc'
  | 'created_asc'
  | 'updated_desc'
  | 'updated_asc'
  | 'checkin_asc'
  | 'checkin_desc'
  | 'checkout_asc'
  | 'checkout_desc'
  | 'guest_asc'
  | 'guest_desc'
  | 'property_asc'
  | 'property_desc'
  | 'amount_desc'
  | 'amount_asc';

const SORT_OPTIONS: SortOption<SortValue>[] = [
  { label: 'Plus récentes (création)', value: 'created_desc' },
  { label: 'Plus anciennes (création)', value: 'created_asc' },
  { label: 'Récemment mises à jour', value: 'updated_desc' },
  { label: 'Moins récemment mises à jour', value: 'updated_asc' },
  { label: 'Arrivée (croissant)', value: 'checkin_asc' },
  { label: 'Arrivée (décroissant)', value: 'checkin_desc' },
  { label: 'Départ (croissant)', value: 'checkout_asc' },
  { label: 'Départ (décroissant)', value: 'checkout_desc' },
  { label: 'Client A-Z', value: 'guest_asc' },
  { label: 'Client Z-A', value: 'guest_desc' },
  { label: 'Bien A-Z', value: 'property_asc' },
  { label: 'Bien Z-A', value: 'property_desc' },
  { label: 'Montant décroissant', value: 'amount_desc' },
  { label: 'Montant croissant', value: 'amount_asc' },
];

type DateFilterValue = 'all' | 'today' | 'this_week' | 'this_month' | 'custom';
const DATE_FILTERS: { label: string; value: DateFilterValue }[] = [
  { label: 'Toutes dates', value: 'all' },
  { label: "Aujourd'hui", value: 'today' },
  { label: 'Cette semaine', value: 'this_week' },
  { label: 'Ce mois', value: 'this_month' },
  { label: 'Personnalisé', value: 'custom' },
];

function compareStrings(a: string, b: string) {
  return a.localeCompare(b);
}

export default function ReservationsScreen() {
  const [query, setQuery] = useState('');
  const [statuses, setStatuses] = useState<ReservationStatus[]>([]);
  const [sortBy, setSortBy] = useState<SortValue>('created_desc');
  const [dateFilter, setDateFilter] = useState<DateFilterValue>('all');
  const [customRange, setCustomRange] = useState<{ start: string; end: string } | null>(null);
  const [showCustomRange, setShowCustomRange] = useState(false);
  const [draftStart, setDraftStart] = useState('');
  const [draftEnd, setDraftEnd] = useState('');
  const [customError, setCustomError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const dateRange = useMemo(() => {
    if (dateFilter === 'all') return undefined;
    if (dateFilter === 'custom') return customRange ?? undefined;
    const range = computeRangeForFilter(dateFilter);
    return { start: toDateOnlyString(range.start), end: toDateOnlyString(range.end) };
  }, [dateFilter, customRange]);

  const { data: reservations, isLoading, isError, refetch } = useReservations({ statuses, dateRange });
  const createReservation = useCreateReservation();

  const filtered = useMemo(() => {
    const list = (reservations ?? []).filter((r) => {
      const guestName = r.guest?.full_name ?? '';
      const propertyName = r.property?.name ?? '';
      return (
        query.trim().length === 0 ||
        guestName.toLowerCase().includes(query.toLowerCase()) ||
        propertyName.toLowerCase().includes(query.toLowerCase())
      );
    });

    // Server-side ordering already covers the default; joined fields (guest/property name) and
    // every alternate sort mode are re-sorted here since PostgREST can't order by an embedded
    // resource's column through this select shape — cheap at this dataset size (see Mission C
    // performance validation), revisit if reservation volume grows an order of magnitude.
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
        case 'checkin_asc':
          return compareStrings(a.check_in_date, b.check_in_date);
        case 'checkin_desc':
          return compareStrings(b.check_in_date, a.check_in_date);
        case 'checkout_asc':
          return compareStrings(a.check_out_date, b.check_out_date);
        case 'checkout_desc':
          return compareStrings(b.check_out_date, a.check_out_date);
        case 'guest_asc':
          return compareStrings(a.guest?.full_name ?? '', b.guest?.full_name ?? '');
        case 'guest_desc':
          return compareStrings(b.guest?.full_name ?? '', a.guest?.full_name ?? '');
        case 'property_asc':
          return compareStrings(a.property?.name ?? '', b.property?.name ?? '');
        case 'property_desc':
          return compareStrings(b.property?.name ?? '', a.property?.name ?? '');
        case 'amount_desc':
          return b.total_amount - a.total_amount;
        case 'amount_asc':
          return a.total_amount - b.total_amount;
        default:
          return 0;
      }
    });
    return sorted;
  }, [reservations, query, sortBy]);

  const handleDateFilterChange = (value: DateFilterValue) => {
    if (value === 'custom') {
      const base = customRange ?? { start: toDateOnlyString(new Date()), end: toDateOnlyString(new Date()) };
      setDraftStart(base.start);
      setDraftEnd(base.end);
      setCustomError(null);
      setShowCustomRange(true);
      return;
    }
    setDateFilter(value);
  };

  const handleCustomRangeSubmit = () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(draftStart) || !/^\d{4}-\d{2}-\d{2}$/.test(draftEnd)) {
      setCustomError('Format attendu : AAAA-MM-JJ.');
      return;
    }
    if (draftStart > draftEnd) {
      setCustomError('La date de début doit précéder la date de fin.');
      return;
    }
    setCustomRange({ start: draftStart, end: draftEnd });
    setDateFilter('custom');
    setShowCustomRange(false);
  };

  const handleCreate = (values: ReservationFormValues) => {
    createReservation.mutate(
      {
        propertyId: values.propertyId,
        channelId: values.channelId,
        guestName: values.guestName,
        guestPhone: values.guestPhone,
        checkInDate: values.checkInDate,
        checkOutDate: values.checkOutDate,
        nightlyRate: values.nightlyRate,
        cleaningFeeAmount: values.cleaningFeeAmount,
        adults: values.adults,
        children: values.children,
        status: values.status,
      },
      {
        onSuccess: () => {
          setShowCreate(false);
          notify('Réservation créée', `Réservation pour ${values.guestName} ajoutée avec succès.`);
        },
        onError: (error) => {
          logAppError('reservations/index create', error);
          if (error instanceof DoubleBookingError) {
            notify('Dates indisponibles', error.message);
            return;
          }
          notify('Erreur', getErrorMessage(error, 'Impossible de créer la réservation.'));
        },
      }
    );
  };

  return (
    <AccessGuard resource="reservations">
    <Screen contentPadding={false}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Réservations</Text>
          <Text style={styles.subtitle}>
            {reservations ? `${filtered.length} au total` : 'Chargement…'}
          </Text>
        </View>
        <Pressable onPress={() => setShowCreate(true)} style={styles.addButton}>
          <Icon name="add" size={24} color="#fff" />
        </Pressable>
      </View>

      <ListFilterBar
        searchValue={query}
        onSearchChange={setQuery}
        searchPlaceholder="Client, bien…"
        sortOptions={SORT_OPTIONS}
        sortValue={sortBy}
        onSortChange={setSortBy}
        onRefresh={refetch}
      />

      <View style={styles.filterRow}>
        <StatusFilter
          options={RESERVATION_STATUS_OPTIONS}
          value={statuses}
          onChange={setStatuses}
          multiple
        />
      </View>
      <View style={styles.filterRow}>
        <FilterChipRow
          options={DATE_FILTERS.map((f) => f.value)}
          active={dateFilter}
          onChange={handleDateFilterChange}
          getLabel={(value) => DATE_FILTERS.find((f) => f.value === value)?.label ?? value}
        />
      </View>

      {isLoading && <LoadingState label="Chargement des réservations…" />}
      {isError && <ErrorState message="Impossible de charger les réservations." onRetry={refetch} />}
      {!isLoading && !isError && filtered.length === 0 && (
        <EmptyState icon="event" message="Aucune réservation ne correspond à votre recherche." />
      )}

      {!isLoading && !isError && (
        <View style={styles.list}>
          {filtered.map((res) => {
            const statusColors = STATUS_COLOR[res.status];
            return (
              <Pressable key={res.id} onPress={() => router.push(`/reservations/${res.id}`)}>
                <Card style={styles.card}>
                  <View style={styles.topRow}>
                    <Avatar initials={getInitials(res.guest?.full_name ?? '?')} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.guest}>{res.guest?.full_name ?? 'Client inconnu'}</Text>
                      <Text style={styles.property}>{res.property?.name ?? 'Bien inconnu'}</Text>
                    </View>
                    <Badge
                      label={STATUS_LABEL[res.status] ?? res.status}
                      bg={statusColors.bg}
                      color={statusColors.text}
                    />
                  </View>
                  <View style={styles.bottomRow}>
                    <View style={styles.datesRow}>
                      <Icon name="calendar_today" size={16} color={AmkouyColors.secondary} />
                      <Text style={styles.dates}>
                        {res.check_in_date} → {res.check_out_date}
                      </Text>
                    </View>
                    <View style={styles.sourceRow}>
                      <Text style={styles.source}>{res.channel?.name ?? ''}</Text>
                      <Text style={styles.amount}>{formatMAD(res.total_amount)}</Text>
                    </View>
                  </View>
                </Card>
              </Pressable>
            );
          })}
        </View>
      )}

      <ReservationForm
        visible={showCreate}
        mode="create"
        onClose={() => setShowCreate(false)}
        onSubmit={handleCreate}
        submitting={createReservation.isPending}
      />

      <FormModal
        visible={showCustomRange}
        title="Plage personnalisée"
        onClose={() => setShowCustomRange(false)}
        onSubmit={handleCustomRangeSubmit}
        submitting={false}
        submitLabel="Appliquer">
        <FormField
          label="Date de début (AAAA-MM-JJ)"
          value={draftStart}
          onChangeText={setDraftStart}
          placeholder="2026-07-01"
        />
        <FormField
          label="Date de fin (AAAA-MM-JJ)"
          value={draftEnd}
          onChangeText={setDraftEnd}
          placeholder="2026-07-31"
        />
        {!!customError && <Text style={styles.errorText}>{customError}</Text>}
      </FormModal>
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
    paddingTop: 10,
    paddingBottom: 4,
  },
  list: {
    paddingHorizontal: 22,
    paddingTop: 12,
    gap: 11,
  },
  card: {
    padding: 14,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  guest: {
    ...robotoText(600, 14.5, { color: AmkouyColors.text }),
  },
  property: {
    ...robotoText(400, 11.5, { color: AmkouyColors.textFaint, marginTop: 1 }),
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
  datesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dates: {
    ...robotoText(500, 12, { color: AmkouyColors.textMuted }),
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  source: {
    ...robotoText(400, 11, { color: AmkouyColors.textFainter }),
  },
  amount: {
    ...robotoText(700, 14, { color: AmkouyColors.primary }),
  },
  errorText: {
    ...robotoText(500, 12, { color: AmkouyColors.error, marginTop: 8 }),
  },
});

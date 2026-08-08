import { useQueryClient } from '@tanstack/react-query';
import { Link, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { AccessGuard } from '@/components/amkouy/access-guard';
import { AvailabilityCard } from '@/components/calendar/availability-card';
import { ReservationDetailCard } from '@/components/calendar/reservation-detail-card';
import { ReservationForm } from '@/components/forms/reservation-form';
import { useCreateReservation } from '@/hooks/use-reservations';
import { PropertyNotBookableError } from '@/lib/queries/reservations';
import { ReservationFormValues } from '@/lib/validation/reservation';
import { Icon } from '@/components/icon';
import { AmkouyColors } from '@/constants/amkouy-theme';
import { robotoText } from '@/constants/typography';
import { useApartmentCalendar } from '@/hooks/use-portfolio-calendar';
import {
  buildWeekRows,
  getBlockForDate,
  type CalendarCleaningMarker,
  type CalendarDay,
  type CalendarMaintenanceMarker,
  type CalendarReservationBlock,
} from '@/lib/queries/portfolio-calendar';

// ---------------------------------------------------------------------------
// Constants & helpers
// ---------------------------------------------------------------------------

const MONTH_NAMES = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];
const WEEK_DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

function formatMAD(n: number): string {
  return n.toLocaleString('fr-MA', { maximumFractionDigits: 0 }) + ' DH';
}

function occColor(p: number): string {
  if (p >= 75) return '#15803D';
  if (p >= 40) return '#B45309';
  return '#B91C1C';
}

type BlockStyle = { bg: string; text: string; border: string };
const BLOCK_COLORS: Record<string, BlockStyle> = {
  pending:    { bg: '#FEF3C7', text: '#92400E', border: '#F59E0B' },
  confirmed:  { bg: '#D1FAE5', text: '#065F46', border: '#10B981' },
  checked_in: { bg: '#0F1F3D', text: '#FFFFFF', border: '#0F1F3D' },
  checked_out: { bg: '#E5E7EB', text: '#374151', border: '#9CA3AF' },
  completed:  { bg: '#DBEAFE', text: '#1E40AF', border: '#3B82F6' },
  cancelled:  { bg: '#FEE2E2', text: '#991B1B', border: '#EF4444' },
  no_show:    { bg: '#FCE7F3', text: '#9D174D', border: '#EC4899' },
};
function blockStyle(status: string): BlockStyle {
  return BLOCK_COLORS[status] ?? { bg: '#E5E7EB', text: '#374151', border: '#9CA3AF' };
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'En attente',
  confirmed: 'Confirmée',
  checked_in: 'En séjour',
  checked_out: 'Parti',
  completed: 'Terminée',
  cancelled: 'Annulée',
  no_show: 'Non présenté',
};

function isoWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function dateToString(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

// Increments a YYYY-MM-DD string by one day using local date arithmetic (no UTC shift).
function nextDateStr(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const next = new Date(y, m - 1, d + 1);
  const mm = String(next.getMonth() + 1).padStart(2, '0');
  const dd = String(next.getDate()).padStart(2, '0');
  return `${next.getFullYear()}-${mm}-${dd}`;
}

// ---------------------------------------------------------------------------
// View types
// ---------------------------------------------------------------------------

type ViewMode = 'month' | 'week' | 'day';

// ---------------------------------------------------------------------------
// Legend
// ---------------------------------------------------------------------------

const LEGEND_ENTRIES: Array<{ label: string; status: string }> = [
  { label: 'Confirmée',  status: 'confirmed' },
  { label: 'En attente', status: 'pending' },
  { label: 'En séjour',  status: 'checked_in' },
  { label: 'Parti',      status: 'checked_out' },
  { label: 'Annulée',    status: 'cancelled' },
  { label: 'Non venu',   status: 'no_show' },
];

function Legend() {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.legend}
      contentContainerStyle={styles.legendContent}
    >
      {LEGEND_ENTRIES.map(({ label, status }) => {
        const bs = blockStyle(status);
        return (
          <View key={status} style={[styles.legendChip, { backgroundColor: bs.bg, borderColor: bs.border }]}>
            <Text style={[styles.legendChipText, { color: bs.text }]}>{label}</Text>
          </View>
        );
      })}
      <View style={[styles.legendChip, { backgroundColor: '#FFFFFF', borderColor: '#E5E7EB' }]}>
        <Text style={[styles.legendChipText, { color: '#9CA3AF' }]}>Libre</Text>
      </View>
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Month view
// ---------------------------------------------------------------------------

function MonthView({
  year,
  month,
  days,
  blocks,
  cleaningMarkers,
  maintenanceMarkers,
  onTapBlock,
  onTapEmpty,
}: {
  year: number;
  month: number;
  days: CalendarDay[];
  blocks: CalendarReservationBlock[];
  cleaningMarkers: CalendarCleaningMarker[];
  maintenanceMarkers: CalendarMaintenanceMarker[];
  onTapBlock: (id: string) => void;
  onTapEmpty: (date: string) => void;
}) {
  const weekRows = useMemo(() => buildWeekRows(days, year, month), [days, year, month]);

  // O(1) lookup: col (0-based = dayOfMonth-1) → cleaning status
  const cleaningCols = useMemo(
    () => new Set(cleaningMarkers.map((m) => m.col)),
    [cleaningMarkers],
  );
  // O(1) lookup: col → maintenance priority
  const maintenanceCols = useMemo(
    () => new Map(maintenanceMarkers.map((m) => [m.col, m.priority])),
    [maintenanceMarkers],
  );

  return (
    <View style={styles.monthGrid}>
      {/* Week day header */}
      <View style={styles.weekDayRow}>
        {WEEK_DAYS.map((d) => (
          <View key={d} style={styles.weekDayCell}>
            <Text style={styles.weekDayText}>{d}</Text>
          </View>
        ))}
      </View>

      {/* Week rows */}
      {weekRows.map((row, wi) => (
        <View key={wi} style={styles.weekRow}>
          {row.map((day, di) => {
            if (!day) {
              return <View key={di} style={[styles.dayCell, styles.dayCellEmpty]} />;
            }

            const block = getBlockForDate(day.date, blocks);
            const bs = block ? blockStyle(block.status) : null;

            // Connected-bar shape: determine where in the stay this day falls.
            const isCheckIn = block !== null && block.checkIn === day.date;
            const nd = nextDateStr(day.date);
            const nextBlock = block !== null ? getBlockForDate(nd, blocks) : null;
            // Last occupied night = today's block doesn't continue tomorrow (or different reservation)
            const isLastNight = block !== null && nextBlock?.id !== block.id;
            // Show guest name only on the first visible night of a reservation this month
            const isFirstVisible =
              block !== null &&
              (block.checkIn === day.date ||
                (day.dayOfMonth === 1 && block.checkIn < day.date));

            const col = day.dayOfMonth - 1; // 0-based column
            const hasCleaning = cleaningCols.has(col);
            const maintPriority = maintenanceCols.get(col) ?? null;

            return (
              <TouchableOpacity
                key={di}
                style={[
                  styles.dayCell,
                  day.isToday && !bs && styles.dayCellToday,
                ]}
                onPress={() => {
                  if (block) onTapBlock(block.id);
                  else onTapEmpty(day.date);
                }}
                activeOpacity={0.75}
              >
                {/* Reservation color band — absolutely positioned behind text */}
                {bs && (
                  <View
                    style={[
                      styles.reservationBand,
                      day.isToday && styles.reservationBandToday,
                      {
                        backgroundColor: bs.bg,
                        borderTopLeftRadius:    isCheckIn   ? 8 : 0,
                        borderBottomLeftRadius: isCheckIn   ? 8 : 0,
                        borderTopRightRadius:   isLastNight ? 8 : 0,
                        borderBottomRightRadius:isLastNight ? 8 : 0,
                        // Single-night reservations that start and end today
                        ...(isCheckIn && isLastNight && { borderRadius: 8 }),
                      },
                    ]}
                  />
                )}

                {/* Day number */}
                <Text
                  style={[
                    styles.dayCellNum,
                    day.isWeekend && !bs && styles.dayCellWeekend,
                    day.isToday && !bs && styles.dayCellNumToday,
                    bs && { color: bs.text },
                  ]}
                >
                  {day.dayOfMonth}
                </Text>

                {/* Guest first name on the first visible night */}
                {block && isFirstVisible && (
                  <Text style={[styles.dayCellGuest, { color: bs!.text }]} numberOfLines={1}>
                    {(block.guestName ?? '').split(' ')[0]}
                  </Text>
                )}

                {/* Cleaning / maintenance dots */}
                {(hasCleaning || maintPriority) && (
                  <View style={styles.markerRow}>
                    {hasCleaning && <View style={styles.cleaningDot} />}
                    {maintPriority && (
                      <View
                        style={[
                          styles.maintenanceDot,
                          { backgroundColor: maintPriority === 'urgent' ? '#EF4444' : '#6B7280' },
                        ]}
                      />
                    )}
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Week view
// ---------------------------------------------------------------------------

function WeekView({
  weekStart,
  blocks,
  onTapBlock,
  onTapEmpty,
}: {
  weekStart: Date;
  blocks: CalendarReservationBlock[];
  onTapBlock: (id: string) => void;
  onTapEmpty: (date: string) => void;
}) {
  const weekDays = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
  [weekStart]);

  const todayStr = dateToString(new Date());

  return (
    <View style={styles.weekViewContainer}>
      <View style={styles.weekViewHeader}>
        {weekDays.map((d, i) => {
          const dateStr = dateToString(d);
          const isToday = dateStr === todayStr;
          return (
            <View key={i} style={[styles.weekViewDayCol, isToday && styles.weekViewDayColToday]}>
              <Text style={[styles.weekViewDayName, isToday && styles.weekViewDayToday]}>{WEEK_DAYS[i]}</Text>
              <Text style={[styles.weekViewDayNum, isToday && styles.weekViewDayToday]}>{d.getDate()}</Text>
            </View>
          );
        })}
      </View>

      <View style={styles.weekViewBody}>
        {weekDays.map((d, i) => {
          const dateStr = dateToString(d);
          const isToday = dateStr === todayStr;
          const block = getBlockForDate(dateStr, blocks);
          const bs = block ? blockStyle(block.status) : null;
          return (
            <TouchableOpacity
              key={i}
              style={[styles.weekViewCell, isToday && styles.weekViewCellToday]}
              onPress={() => {
                if (block) onTapBlock(block.id);
                else onTapEmpty(dateStr);
              }}
              activeOpacity={0.75}
            >
              {block && bs && (
                <View style={[styles.weekViewBlock, { backgroundColor: bs.bg, borderColor: bs.border }]}>
                  <Text style={[styles.weekViewBlockLabel, { color: bs.text }]} numberOfLines={2}>
                    {block.isStart ? (block.guestName ?? '') : ''}
                    {block.isStart && '\n'}
                    {STATUS_LABELS[block.status] ?? block.status}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Day view
// ---------------------------------------------------------------------------

function DayView({
  date,
  blocks,
  onTapBlock,
  onTapEmpty,
}: {
  date: Date;
  blocks: CalendarReservationBlock[];
  onTapBlock: (id: string) => void;
  onTapEmpty: (date: string) => void;
}) {
  const dateStr = dateToString(date);
  const block = getBlockForDate(dateStr, blocks);
  const bs = block ? blockStyle(block.status) : null;
  const todayStr = dateToString(new Date());
  const isToday = dateStr === todayStr;

  return (
    <ScrollView contentContainerStyle={styles.dayViewContent}>
      <View style={[styles.dayViewCard, isToday && styles.dayViewCardToday]}>
        <Text style={styles.dayViewDateLabel}>
          {WEEK_DAYS[((date.getDay() + 6) % 7)]}{' '}
          {date.getDate()} {MONTH_NAMES[date.getMonth()]} {date.getFullYear()}
        </Text>

        {block && bs ? (
          <TouchableOpacity
            style={[styles.dayViewBlock, { backgroundColor: bs.bg, borderColor: bs.border }]}
            onPress={() => onTapBlock(block.id)}
            activeOpacity={0.8}
          >
            <Text style={[styles.dayViewBlockStatus, { color: bs.text }]}>
              {STATUS_LABELS[block.status] ?? block.status}
            </Text>
            <Text style={[styles.dayViewBlockGuest, { color: bs.text }]}>{block.guestName}</Text>
            <Text style={[styles.dayViewBlockDates, { color: bs.text }]}>
              {block.checkIn} → {block.checkOut}
            </Text>
            <Text style={[styles.dayViewBlockAmount, { color: bs.text }]}>
              {formatMAD(block.totalAmount)}
            </Text>
            <View style={styles.dayViewBlockLink}>
              <Icon name="info_outline" size={14} color={bs.text} />
              <Text style={[styles.dayViewBlockLinkText, { color: bs.text }]}>Voir les détails</Text>
            </View>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.dayViewEmpty}
            onPress={() => onTapEmpty(dateStr)}
            activeOpacity={0.7}
          >
            <Icon name="event_available" size={36} color="#CBD5E1" />
            <Text style={styles.dayViewEmptyText}>Disponible</Text>
            <View style={styles.dayViewAddBtn}>
              <Icon name="add_circle" size={14} color={AmkouyColors.primary} />
              <Text style={styles.dayViewAddBtnText}>+ Nouvelle réservation</Text>
            </View>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Reservation list (below month view)
// ---------------------------------------------------------------------------

function ReservationList({
  blocks,
  onTapBlock,
}: {
  blocks: CalendarReservationBlock[];
  onTapBlock: (id: string) => void;
}) {
  const active = blocks.filter(
    (b) => b.status !== 'cancelled' && b.status !== 'no_show'
  );
  if (active.length === 0) return null;

  return (
    <View style={styles.resList}>
      <Text style={styles.resListTitle}>Réservations du mois ({active.length})</Text>
      {active.map((b) => {
        const bs = blockStyle(b.status);
        return (
          <TouchableOpacity
            key={b.id}
            style={[styles.resCard, { borderLeftColor: bs.border }]}
            onPress={() => onTapBlock(b.id)}
            activeOpacity={0.8}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.resCardGuest}>{b.guestName}</Text>
              <Text style={styles.resCardDates}>{b.checkIn} → {b.checkOut}</Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 3 }}>
              <View style={[styles.resCardBadge, { backgroundColor: bs.bg }]}>
                <Text style={[styles.resCardBadgeText, { color: bs.text }]}>
                  {STATUS_LABELS[b.status] ?? b.status}
                </Text>
              </View>
              <Text style={styles.resCardAmount}>{formatMAD(b.totalAmount)}</Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function ApartmentCalendarScreen() {
  const { propertyId, year: yearParam, month: monthParam } = useLocalSearchParams<{
    propertyId: string;
    year: string;
    month: string;
  }>();

  const now = new Date();
  const [year, setYear] = useState(yearParam ? parseInt(yearParam, 10) : now.getFullYear());
  const [month, setMonth] = useState(monthParam ? parseInt(monthParam, 10) : now.getMonth() + 1);
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [weekStart, setWeekStart] = useState(() => isoWeekStart(now));
  const [selectedDay, setSelectedDay] = useState(() => now);

  // Detail card state
  const [selectedResId, setSelectedResId] = useState<string | null>(null);

  // Availability card state
  const [availabilityDate, setAvailabilityDate] = useState<string | null>(null);

  // Reservation form state — at root level (never inside another Modal).
  const [showReservationForm, setShowReservationForm] = useState(false);
  const [reservationFormPrefill, setReservationFormPrefill] = useState<{
    propertyId: string;
    date: string;
  } | null>(null);

  const queryClient = useQueryClient();
  const createReservation = useCreateReservation();

  const { data, property, isLoading, error } = useApartmentCalendar(propertyId, year, month);

  const row = useMemo(() => data?.rows[0] ?? null, [data]);
  const blocks = useMemo(() => row?.reservationBlocks ?? [], [row]);

  function navMonth(delta: number) {
    let ny = year, nm = month + delta;
    if (nm < 1) { ny--; nm = 12; }
    if (nm > 12) { ny++; nm = 1; }
    setYear(ny); setMonth(nm);
  }

  function navWeek(delta: number) {
    setWeekStart((prev) => addDays(prev, delta * 7));
    const newWeekStart = addDays(weekStart, delta * 7);
    setYear(newWeekStart.getFullYear());
    setMonth(newWeekStart.getMonth() + 1);
  }

  function navDay(delta: number) {
    const next = addDays(selectedDay, delta);
    setSelectedDay(next);
    setYear(next.getFullYear());
    setMonth(next.getMonth() + 1);
  }

  // Tapping a block → open detail card
  const handleTapBlock = useCallback((id: string) => {
    setSelectedResId(id);
  }, []);

  // Tapping an empty date → open availability card
  const handleTapEmpty = useCallback((date: string) => {
    setAvailabilityDate(date);
  }, []);

  // After any mutation → refresh calendar data
  const handleCalendarMutated = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['calendar-reservations'] });
    queryClient.invalidateQueries({ queryKey: ['calendar-cleaning'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard-metrics-calendar-today'] });
  }, [queryClient]);

  // "+ Nouvelle réservation" tapped: save pre-fill, close card, open form at root level.
  const handleRequestNewReservation = useCallback(() => {
    if (!availabilityDate || !propertyId) return;
    setReservationFormPrefill({ propertyId, date: availabilityDate });
    setAvailabilityDate(null);      // close AvailabilityCard
    setShowReservationForm(true);
  }, [availabilityDate, propertyId]);

  function handleCreateReservation(values: ReservationFormValues) {
    createReservation.mutate(values, {
      onSuccess: () => {
        setShowReservationForm(false);
        setReservationFormPrefill(null);
        handleCalendarMutated();
      },
      onError: (error) => {
        if (error instanceof PropertyNotBookableError) {
          Alert.alert(
            'Bien non disponible',
            'Ce bien n\'est pas encore actif. Seuls les biens avec le statut "Actif" peuvent recevoir des réservations.',
          );
        } else {
          Alert.alert(
            'Erreur',
            error instanceof Error ? error.message : 'Une erreur est survenue lors de la création de la réservation.',
          );
        }
      },
    });
  }

  // Navigation label
  let navLabel = '';
  if (viewMode === 'month') {
    navLabel = `${MONTH_NAMES[month - 1]} ${year}`;
  } else if (viewMode === 'week') {
    const wEnd = addDays(weekStart, 6);
    navLabel = `${weekStart.getDate()} – ${wEnd.getDate()} ${MONTH_NAMES[wEnd.getMonth()]} ${wEnd.getFullYear()}`;
  } else {
    navLabel = `${WEEK_DAYS[((selectedDay.getDay() + 6) % 7)]} ${selectedDay.getDate()} ${MONTH_NAMES[selectedDay.getMonth()]}`;
  }

  const onPrev = () => {
    if (viewMode === 'month') navMonth(-1);
    else if (viewMode === 'week') navWeek(-1);
    else navDay(-1);
  };
  const onNext = () => {
    if (viewMode === 'month') navMonth(1);
    else if (viewMode === 'week') navWeek(1);
    else navDay(1);
  };
  const onToday = () => {
    setYear(now.getFullYear()); setMonth(now.getMonth() + 1);
    setWeekStart(isoWeekStart(now));
    setSelectedDay(now);
  };

  return (
    <AccessGuard resource="reservations">
      <SafeAreaView style={styles.root}>
        {/* Header */}
        <View style={styles.header}>
          <Link href="/calendar" asChild>
            <Pressable style={styles.backBtn}>
              <Icon name="arrow_back" size={18} color={AmkouyColors.primary} />
              <Text style={styles.backBtnText}>Portefeuille</Text>
            </Pressable>
          </Link>
          <View style={styles.headerInfo}>
            <Text style={styles.screenTitle} numberOfLines={1}>
              {property?.name ?? 'Calendrier'}
            </Text>
            {row && (
              <Text style={styles.screenSub}>
                Occ.{' '}
                <Text style={{ color: occColor(row.occupancyPct) }}>
                  {row.occupancyPct.toFixed(1)}%
                </Text>
                {'  '}
                {formatMAD(row.monthRevenue)}
              </Text>
            )}
          </View>
        </View>

        {/* View toggle */}
        <View style={styles.viewToggle}>
          {(['month', 'week', 'day'] as ViewMode[]).map((v) => (
            <TouchableOpacity
              key={v}
              style={[styles.viewToggleBtn, viewMode === v && styles.viewToggleBtnActive]}
              onPress={() => setViewMode(v)}
            >
              <Text style={[styles.viewToggleText, viewMode === v && styles.viewToggleTextActive]}>
                {v === 'month' ? 'Mois' : v === 'week' ? 'Semaine' : 'Jour'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Period navigation */}
        <View style={styles.periodNav}>
          <TouchableOpacity onPress={onPrev} style={styles.navBtn}>
            <Icon name="chevron_left" size={24} color={AmkouyColors.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={onToday} style={{ flex: 1, alignItems: 'center' }}>
            <Text style={styles.periodLabel}>{navLabel}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onNext} style={styles.navBtn}>
            <Icon name="chevron_right" size={24} color={AmkouyColors.primary} />
          </TouchableOpacity>
        </View>

        {/* Loading / error */}
        {isLoading && (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={AmkouyColors.primary} />
          </View>
        )}
        {error && (
          <View style={styles.center}>
            <Text style={styles.errorText}>Erreur de chargement</Text>
          </View>
        )}

        {/* Content */}
        {!isLoading && data && (
          <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
            {viewMode === 'month' && (
              <>
                <Legend />
                <MonthView
                  year={year}
                  month={month}
                  days={data.days}
                  blocks={blocks}
                  cleaningMarkers={row?.cleaningMarkers ?? []}
                  maintenanceMarkers={row?.maintenanceMarkers ?? []}
                  onTapBlock={handleTapBlock}
                  onTapEmpty={handleTapEmpty}
                />
                <ReservationList blocks={blocks} onTapBlock={handleTapBlock} />
              </>
            )}
            {viewMode === 'week' && (
              <WeekView
                weekStart={weekStart}
                blocks={blocks}
                onTapBlock={handleTapBlock}
                onTapEmpty={handleTapEmpty}
              />
            )}
            {viewMode === 'day' && (
              <DayView
                date={selectedDay}
                blocks={blocks}
                onTapBlock={handleTapBlock}
                onTapEmpty={handleTapEmpty}
              />
            )}
          </ScrollView>
        )}
      </SafeAreaView>

      {/* Reservation detail card */}
      <ReservationDetailCard
        reservationId={selectedResId}
        onClose={() => setSelectedResId(null)}
        onCalendarMutated={handleCalendarMutated}
      />

      {/* Availability card — property is always this apartment */}
      <AvailabilityCard
        visible={!!availabilityDate}
        propertyId={propertyId ?? null}
        propertyName={property?.name ?? null}
        date={availabilityDate}
        onClose={() => setAvailabilityDate(null)}
        onRequestNewReservation={handleRequestNewReservation}
      />

      {/* ReservationForm at root level — NEVER inside another Modal */}
      <ReservationForm
        visible={showReservationForm}
        mode="create"
        initialValues={{
          propertyId: reservationFormPrefill?.propertyId,
          checkInDate: reservationFormPrefill?.date,
        }}
        onClose={() => {
          setShowReservationForm(false);
          setReservationFormPrefill(null);
        }}
        onSubmit={handleCreateReservation}
        submitting={createReservation.isPending}
      />
    </AccessGuard>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: AmkouyColors.surface,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    gap: 10,
    zIndex: 10,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 10,
    minHeight: 44,
    marginRight: 4,
  },
  backBtnText: {
    ...robotoText(500, 13, { color: AmkouyColors.primary }),
  },
  headerInfo: {
    flex: 1,
  },
  screenTitle: {
    ...robotoText(700, 18, { color: '#0F1F3D' }),
  },
  screenSub: {
    ...robotoText(400, 12, { color: '#6B7280', marginTop: 1 }),
  },
  viewToggle: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
    backgroundColor: AmkouyColors.surface,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  viewToggleBtn: {
    paddingHorizontal: 16,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  viewToggleBtnActive: {
    backgroundColor: AmkouyColors.primary,
    borderColor: AmkouyColors.primary,
  },
  viewToggleText: {
    ...robotoText(500, 12, { color: '#374151' }),
  },
  viewToggleTextActive: {
    color: '#FFFFFF',
  },
  periodNav: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
    backgroundColor: AmkouyColors.surface,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  navBtn: {
    padding: 8,
  },
  periodLabel: {
    ...robotoText(600, 15, { color: '#0F1F3D' }),
  },
  monthGrid: {
    backgroundColor: '#FFFFFF',
    margin: 12,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  weekDayRow: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  weekDayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  weekDayText: {
    ...robotoText(500, 11, { color: '#64748B' }),
  },
  weekRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F3F4F6',
  },
  dayCell: {
    flex: 1,
    minHeight: 54,
    padding: 4,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: '#F3F4F6',
    alignItems: 'center',
  },
  dayCellEmpty: {
    backgroundColor: '#F8FAFC',
  },
  dayCellToday: {
    backgroundColor: '#EFF6FF',
  },
  dayCellNum: {
    ...robotoText(600, 13, { color: '#374151' }),
  },
  dayCellNumToday: {
    color: AmkouyColors.primary,
  },
  dayCellWeekend: {
    color: '#EF4444',
  },
  dayCellGuest: {
    ...robotoText(400, 9, { marginTop: 1, textAlign: 'center' }),
    maxWidth: '100%',
  },
  // Connected reservation band — sits behind day number via absolute positioning
  reservationBand: {
    position: 'absolute',
    top: 3,
    bottom: 3,
    left: 0,
    right: 0,
  },
  reservationBandToday: {
    borderWidth: 2,
    borderColor: AmkouyColors.primary,
  },
  // Cleaning (amber) and maintenance (grey/red) dots at bottom of cell
  markerRow: {
    position: 'absolute',
    bottom: 3,
    flexDirection: 'row',
    gap: 2,
    alignItems: 'center',
  },
  cleaningDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#F59E0B',
  },
  maintenanceDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  // Legend
  legend: {
    flexGrow: 0,
    backgroundColor: AmkouyColors.surface,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  legendContent: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    gap: 6,
  },
  legendChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  legendChipText: {
    ...robotoText(500, 10.5),
  },
  weekViewContainer: {
    margin: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  weekViewHeader: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  weekViewDayCol: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  weekViewDayColToday: {
    backgroundColor: '#EFF6FF',
  },
  weekViewDayName: {
    ...robotoText(500, 10, { color: '#64748B' }),
  },
  weekViewDayNum: {
    ...robotoText(600, 15, { color: '#374151' }),
  },
  weekViewDayToday: {
    color: AmkouyColors.primary,
  },
  weekViewBody: {
    flexDirection: 'row',
    minHeight: 160,
  },
  weekViewCell: {
    flex: 1,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: '#F3F4F6',
    padding: 3,
    minHeight: 160,
  },
  weekViewCellToday: {
    backgroundColor: '#F0F7FF',
  },
  weekViewBlock: {
    flex: 1,
    borderRadius: 6,
    borderLeftWidth: 3,
    padding: 5,
    justifyContent: 'center',
  },
  weekViewBlockLabel: {
    ...robotoText(500, 10),
  },
  dayViewContent: {
    padding: 16,
  },
  dayViewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  dayViewCardToday: {
    borderColor: AmkouyColors.primary,
    borderWidth: 2,
  },
  dayViewDateLabel: {
    ...robotoText(600, 16, { color: '#0F1F3D', marginBottom: 16 }),
  },
  dayViewBlock: {
    borderRadius: 10,
    borderWidth: 2,
    padding: 14,
    gap: 6,
  },
  dayViewBlockStatus: {
    ...robotoText(500, 12),
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dayViewBlockGuest: {
    ...robotoText(700, 18),
  },
  dayViewBlockDates: {
    ...robotoText(400, 13),
  },
  dayViewBlockAmount: {
    ...robotoText(600, 15),
  },
  dayViewBlockLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
  },
  dayViewBlockLinkText: {
    ...robotoText(500, 13),
    textDecorationLine: 'underline',
  },
  dayViewEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    gap: 10,
  },
  dayViewEmptyText: {
    ...robotoText(400, 15, { color: '#94A3B8' }),
  },
  dayViewAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: AmkouyColors.hairline,
    marginTop: 4,
  },
  dayViewAddBtnText: {
    ...robotoText(600, 13, { color: AmkouyColors.primary }),
  },
  resList: {
    marginHorizontal: 12,
    marginTop: 8,
    gap: 8,
  },
  resListTitle: {
    ...robotoText(600, 14, { color: '#374151', marginBottom: 4 }),
  },
  resCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  resCardGuest: {
    ...robotoText(600, 14, { color: '#111827' }),
  },
  resCardDates: {
    ...robotoText(400, 12, { color: '#6B7280', marginTop: 2 }),
  },
  resCardBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  resCardBadgeText: {
    ...robotoText(500, 11),
  },
  resCardAmount: {
    ...robotoText(600, 12, { color: '#374151' }),
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  errorText: {
    ...robotoText(400, 14, { color: '#B91C1C' }),
  },
});

import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
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
import { usePortfolioCalendar } from '@/hooks/use-portfolio-calendar';
import { getDashboardMetrics } from '@/lib/queries/dashboard-metrics';
import {
  type CalendarDay,
  type CalendarReservationBlock,
  type PropertyCalendarRow,
} from '@/lib/queries/portfolio-calendar';
import { DateRange } from '@/utils/date-range';
import { useQuery } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------

const LABEL_W = 148;
const DAY_CELL_W = 32;
const ROW_H = 56;
const DAY_HDR_H = 44;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MONTH_NAMES = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

const DAY_ABBR = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

function formatMAD(n: number): string {
  return n.toLocaleString('fr-MA', { maximumFractionDigits: 0 }) + ' DH';
}

function pct(n: number): string {
  return n.toFixed(1) + '%';
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

function todayDateRange(): DateRange {
  const d = new Date();
  return { start: d, end: d };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function MonthNav({
  year, month, onPrev, onNext, onToday,
}: {
  year: number; month: number;
  onPrev: () => void; onNext: () => void; onToday: () => void;
}) {
  const now = new Date();
  const isCurrent = now.getFullYear() === year && now.getMonth() + 1 === month;
  return (
    <View style={styles.monthNav}>
      <TouchableOpacity onPress={onPrev} style={styles.navBtn}>
        <Icon name="chevron_left" size={24} color={AmkouyColors.primary} />
      </TouchableOpacity>
      <TouchableOpacity onPress={onToday} style={styles.monthTitleBtn}>
        <Text style={styles.monthTitleText}>{MONTH_NAMES[month - 1]} {year}</Text>
        {!isCurrent && <View style={styles.todayDot} />}
      </TouchableOpacity>
      <TouchableOpacity onPress={onNext} style={styles.navBtn}>
        <Icon name="chevron_right" size={24} color={AmkouyColors.primary} />
      </TouchableOpacity>
    </View>
  );
}

function SummaryStrip({
  totalProperties,
  avgOccupancy,
  totalRevenue,
  occupiedToday,
  availableToday,
  arrivalsToday,
  departurestoday,
  cleaningToday,
  maintenanceOpen,
  adr,
}: {
  totalProperties: number;
  avgOccupancy: number;
  totalRevenue: number;
  occupiedToday: number;
  availableToday: number;
  arrivalsToday: number;
  departurestoday: number;
  cleaningToday: number;
  maintenanceOpen: number;
  adr: number;
}) {
  const chips = [
    { label: 'Biens', value: String(totalProperties), color: AmkouyColors.primary },
    { label: 'Occupés', value: String(occupiedToday), color: '#0F1F3D' },
    { label: 'Libres', value: String(availableToday), color: '#15803D' },
    { label: 'Occ. %', value: pct(avgOccupancy), color: occColor(avgOccupancy) },
    { label: 'Revenus', value: formatMAD(totalRevenue), color: '#1E3A6E' },
    { label: 'ADR', value: formatMAD(adr), color: '#6D4FC9' },
    { label: 'Arrivées', value: String(arrivalsToday), color: '#065F46' },
    { label: 'Départs', value: String(departurestoday), color: '#92400E' },
    { label: 'Ménages', value: String(cleaningToday), color: '#B45309' },
    { label: 'Maint.', value: String(maintenanceOpen), color: '#B91C1C' },
  ];
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.summaryScroll}
      contentContainerStyle={styles.summaryContent}
    >
      {chips.map((c) => (
        <View key={c.label} style={styles.summaryChip}>
          <Text style={[styles.summaryValue, { color: c.color }]}>{c.value}</Text>
          <Text style={styles.summaryLabel}>{c.label}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

type FilterOption = 'active' | 'all' | 'conflicts';
const FILTER_OPTS: FilterOption[] = ['active', 'all', 'conflicts'];
const FILTER_LABELS: Record<FilterOption, string> = { active: 'Actifs', all: 'Tous', conflicts: 'Conflits' };

function FilterBar({ active, onChange }: { active: FilterOption; onChange: (v: FilterOption) => void }) {
  return (
    <View style={styles.filterScroll}>
      <View style={styles.filterContent}>
        {FILTER_OPTS.map((opt) => (
          <TouchableOpacity key={opt} onPress={() => onChange(opt)} style={[styles.filterChip, active === opt && styles.filterChipActive]}>
            <Text style={[styles.filterChipText, active === opt && styles.filterChipTextActive]}>{FILTER_LABELS[opt]}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

function DayHeader({ days }: { days: CalendarDay[] }) {
  return (
    <View style={{ flexDirection: 'row', width: days.length * DAY_CELL_W, height: DAY_HDR_H, backgroundColor: AmkouyColors.surface }}>
      {days.map((d) => (
        <View
          key={d.dayOfMonth}
          style={[styles.dayHdrCell, d.isToday && styles.dayHdrCellToday]}
        >
          <Text style={[styles.dayHdrNum, d.isWeekend && styles.dayHdrWeekend, d.isToday && styles.dayHdrNumToday]}>
            {d.dayOfMonth}
          </Text>
          <Text style={[styles.dayHdrLetter, d.isWeekend && styles.dayHdrWeekend]}>
            {DAY_ABBR[d.dayOfWeek]}
          </Text>
        </View>
      ))}
    </View>
  );
}

function LabelCell({ row, onPress }: { row: PropertyCalendarRow; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.labelCell, { height: ROW_H }]} onPress={onPress} activeOpacity={0.7}>
      <Text style={styles.labelName} numberOfLines={1}>{row.property.name}</Text>
      <View style={styles.labelStats}>
        <Text style={[styles.labelOcc, { color: occColor(row.occupancyPct) }]}>{row.occupancyPct.toFixed(0)}%</Text>
        <Text style={styles.labelRev} numberOfLines={1}>{formatMAD(row.monthRevenue)}</Text>
      </View>
      {row.hasConflict && <View style={styles.conflictDot} />}
    </TouchableOpacity>
  );
}

function TimelineCell({
  row,
  days,
  onTapBlock,
  onTapEmpty,
}: {
  row: PropertyCalendarRow;
  days: CalendarDay[];
  onTapBlock: (id: string) => void;
  onTapEmpty: (propertyId: string, date: string) => void;
}) {
  const totalWidth = days.length * DAY_CELL_W;
  return (
    <View style={{ width: totalWidth, height: ROW_H, position: 'relative' }}>
      {/* Background grid — tappable cells for empty dates */}
      <View style={{ flexDirection: 'row', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
        {days.map((d, i) => {
          const colHasBlock = row.reservationBlocks.some(
            (b) =>
              i >= b.startCol &&
              i < b.startCol + b.spanCols &&
              b.status !== 'cancelled' &&
              b.status !== 'no_show',
          );
          return (
            <TouchableOpacity
              key={i}
              style={[
                styles.bgCell,
                d.isWeekend && styles.bgCellWeekend,
                d.isToday && styles.bgCellToday,
              ]}
              onPress={() => !colHasBlock && onTapEmpty(row.property.id, d.date)}
              activeOpacity={colHasBlock ? 1 : 0.4}
            />
          );
        })}
      </View>
      {/* Reservation blocks — rendered above background, capture taps first */}
      {row.reservationBlocks.map((block) => {
        const bs = blockStyle(block.status);
        const left = block.startCol * DAY_CELL_W;
        const width = block.spanCols * DAY_CELL_W - 2;
        return (
          <TouchableOpacity
            key={block.id}
            onPress={() => onTapBlock(block.id)}
            style={[
              styles.resBlock,
              {
                left,
                width,
                backgroundColor: bs.bg,
                borderColor: bs.border,
                borderLeftWidth: block.isStart ? 3 : 0,
                borderRightWidth: block.isEnd ? 1 : 0,
              },
            ]}
            activeOpacity={0.8}
          >
            <Text style={[styles.resBlockText, { color: bs.text }]} numberOfLines={1}>
              {block.guestName}
            </Text>
          </TouchableOpacity>
        );
      })}
      {/* Cleaning dots */}
      {row.cleaningMarkers.map((m) => (
        <View
          key={m.taskId}
          style={[styles.markerDot, { left: m.col * DAY_CELL_W + 2, backgroundColor: '#F59E0B' }]}
        />
      ))}
      {/* Maintenance dots */}
      {row.maintenanceMarkers.map((m) => (
        <View
          key={m.ticketId}
          style={[
            styles.markerDot,
            {
              left: m.col * DAY_CELL_W + 9,
              backgroundColor: m.priority === 'urgent' ? '#EF4444' : '#6B7280',
            },
          ]}
        />
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function CalendarScreen() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [filter, setFilter] = useState<FilterOption>('active');

  // Detail card state
  const [selectedResId, setSelectedResId] = useState<string | null>(null);

  // Availability card state
  const [availability, setAvailability] = useState<{
    propertyId: string;
    propertyName: string;
    date: string;
  } | null>(null);

  // Reservation form state — owned here (NOT inside AvailabilityCard) so that
  // ReservationForm (FormModal → Modal) is never stacked inside another Modal.
  const [showReservationForm, setShowReservationForm] = useState(false);
  const [reservationFormPrefill, setReservationFormPrefill] = useState<{
    propertyId: string;
    date: string;
  } | null>(null);

  const queryClient = useQueryClient();
  const createReservation = useCreateReservation();

  const { data, isLoading, error } = usePortfolioCalendar(year, month);

  const { data: todayMetrics } = useQuery({
    queryKey: ['dashboard-metrics-calendar-today'],
    queryFn: () => getDashboardMetrics(todayDateRange()),
    staleTime: 5 * 60 * 1000,
  });

  const filteredRows = useMemo(() => {
    if (!data) return [];
    switch (filter) {
      case 'conflicts': return data.rows.filter((r) => r.hasConflict);
      case 'active': return data.rows.filter((r) =>
        r.property.status === 'active' || r.reservationBlocks.length > 0
      );
      default: return data.rows;
    }
  }, [data, filter]);

  const totalDayWidth = (data?.days.length ?? 31) * DAY_CELL_W;

  // Refs for scroll sync
  const leftFlatRef = useRef<FlatList>(null);
  const rightFlatRef = useRef<FlatList>(null);
  const dayHdrScrollRef = useRef<ScrollView>(null);
  const outerHScrollRef = useRef<ScrollView>(null);

  function goTo(y: number, m: number) {
    let ny = y, nm = m;
    if (nm < 1) { ny--; nm = 12; }
    if (nm > 12) { ny++; nm = 1; }
    setYear(ny);
    setMonth(nm);
  }

  const onHScroll = useCallback((x: number) => {
    dayHdrScrollRef.current?.scrollTo({ x, animated: false });
  }, []);

  const onVScroll = useCallback((y: number) => {
    leftFlatRef.current?.scrollToOffset({ offset: y, animated: false });
  }, []);

  // Tapping a block → open detail card (no immediate navigation)
  const handleTapBlock = useCallback((id: string) => {
    setSelectedResId(id);
  }, []);

  // Tapping an empty date → open availability card
  const handleTapEmpty = useCallback((propertyId: string, date: string) => {
    const row = data?.rows.find((r) => r.property.id === propertyId);
    setAvailability({
      propertyId,
      propertyName: row?.property.name ?? '',
      date,
    });
  }, [data?.rows]);

  // Tapping the property label → drill into apartment calendar
  const handleTapProperty = useCallback((propertyId: string) => {
    router.push({ pathname: '/calendar/[propertyId]' as never, params: { propertyId, year: String(year), month: String(month) } });
  }, [year, month]);

  // After any mutation → refresh calendar data
  const handleCalendarMutated = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['calendar-reservations'] });
    queryClient.invalidateQueries({ queryKey: ['calendar-cleaning'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard-metrics-calendar-today'] });
  }, [queryClient]);

  // "+ Nouvelle réservation" tapped: save pre-fill data, close the card,
  // then open ReservationForm at root level (avoids stacked modals).
  const handleRequestNewReservation = useCallback(() => {
    if (!availability) return;
    setReservationFormPrefill({ propertyId: availability.propertyId, date: availability.date });
    setAvailability(null);      // close AvailabilityCard
    setShowReservationForm(true);
  }, [availability]);

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

  const renderLabel = useCallback(({ item }: { item: PropertyCalendarRow }) => (
    <LabelCell row={item} onPress={() => handleTapProperty(item.property.id)} />
  ), [handleTapProperty]);

  const renderTimeline = useCallback(({ item }: { item: PropertyCalendarRow }) => (
    <TimelineCell
      row={item}
      days={data?.days ?? []}
      onTapBlock={handleTapBlock}
      onTapEmpty={handleTapEmpty}
    />
  ), [data?.days, handleTapBlock, handleTapEmpty]);

  const getItemLayout = useCallback((_: unknown, index: number) => ({
    length: ROW_H,
    offset: ROW_H * index,
    index,
  }), []);

  const days = data?.days ?? [];

  return (
    <AccessGuard resource="reservations">
      <SafeAreaView style={styles.root}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.screenTitle}>Calendrier</Text>
        </View>

        {/* Summary strip */}
        {todayMetrics && (
          <SummaryStrip
            totalProperties={data?.totalProperties ?? 0}
            avgOccupancy={data?.avgOccupancy ?? 0}
            totalRevenue={data?.totalRevenue ?? 0}
            occupiedToday={todayMetrics.occupiedPropertiesCount}
            availableToday={todayMetrics.availablePropertiesCount}
            arrivalsToday={todayMetrics.checkIns}
            departurestoday={todayMetrics.checkOuts}
            cleaningToday={todayMetrics.cleaningTasksDueCount}
            maintenanceOpen={todayMetrics.maintenanceOpenCount}
            adr={todayMetrics.averageDailyRate}
          />
        )}

        {/* Month navigation */}
        <MonthNav
          year={year}
          month={month}
          onPrev={() => goTo(year, month - 1)}
          onNext={() => goTo(year, month + 1)}
          onToday={() => { setYear(now.getFullYear()); setMonth(now.getMonth() + 1); }}
        />

        {/* Filter bar */}
        <FilterBar active={filter} onChange={setFilter} />

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

        {/* Gantt grid */}
        {!isLoading && data && (
          <View style={styles.gantt}>
            {/* Fixed left column */}
            <View style={{ width: LABEL_W }}>
              <View style={{ height: DAY_HDR_H, backgroundColor: AmkouyColors.surface, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' }} />
              <FlatList
                ref={leftFlatRef}
                data={filteredRows}
                renderItem={renderLabel}
                keyExtractor={(item) => item.property.id}
                scrollEnabled={false}
                getItemLayout={getItemLayout}
                removeClippedSubviews
                maxToRenderPerBatch={15}
                windowSize={5}
              />
            </View>

            {/* Right: horizontal scroll wrapper */}
            <ScrollView
              ref={outerHScrollRef}
              horizontal
              showsHorizontalScrollIndicator
              onScroll={(e) => onHScroll(e.nativeEvent.contentOffset.x)}
              scrollEventThrottle={16}
              style={{ flex: 1 }}
            >
              <View style={{ width: totalDayWidth }}>
                <ScrollView
                  ref={dayHdrScrollRef}
                  horizontal
                  scrollEnabled={false}
                  style={{ width: totalDayWidth }}
                >
                  <DayHeader days={days} />
                </ScrollView>

                <FlatList
                  ref={rightFlatRef}
                  data={filteredRows}
                  renderItem={renderTimeline}
                  keyExtractor={(item) => item.property.id}
                  onScroll={(e) => onVScroll(e.nativeEvent.contentOffset.y)}
                  scrollEventThrottle={16}
                  getItemLayout={getItemLayout}
                  removeClippedSubviews
                  maxToRenderPerBatch={15}
                  windowSize={5}
                  style={{ width: totalDayWidth }}
                />
              </View>
            </ScrollView>
          </View>
        )}

        {/* Empty state */}
        {!isLoading && data && filteredRows.length === 0 && (
          <View style={styles.center}>
            <Icon name="calendar_today" size={40} color="#CBD5E1" />
            <Text style={styles.emptyText}>Aucun bien pour ce filtre</Text>
          </View>
        )}
      </SafeAreaView>

      {/* Reservation detail card — opens on block tap */}
      <ReservationDetailCard
        reservationId={selectedResId}
        onClose={() => setSelectedResId(null)}
        onCalendarMutated={handleCalendarMutated}
      />

      {/* Availability card — opens on empty date tap */}
      <AvailabilityCard
        visible={!!availability}
        propertyId={availability?.propertyId ?? null}
        propertyName={availability?.propertyName ?? null}
        date={availability?.date ?? null}
        onClose={() => setAvailability(null)}
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
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 4,
  },
  screenTitle: {
    ...robotoText(700, 22, { color: AmkouyColors.primary }),
  },
  summaryScroll: {
    flexGrow: 0,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: AmkouyColors.surface,
  },
  summaryContent: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
  },
  summaryChip: {
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    minWidth: 60,
  },
  summaryValue: {
    ...robotoText(700, 14),
  },
  summaryLabel: {
    ...robotoText(400, 10, { color: '#64748B', marginTop: 1 }),
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 8,
    backgroundColor: AmkouyColors.surface,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  navBtn: {
    padding: 8,
  },
  monthTitleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  monthTitleText: {
    ...robotoText(600, 16, { color: '#0F1F3D' }),
  },
  todayDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: AmkouyColors.primary,
  },
  filterScroll: {
    backgroundColor: AmkouyColors.surface,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  filterContent: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  filterChipActive: {
    backgroundColor: AmkouyColors.primary,
    borderColor: AmkouyColors.primary,
  },
  filterChipText: {
    ...robotoText(500, 12, { color: '#374151' }),
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  gantt: {
    flex: 1,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  dayHdrCell: {
    width: DAY_CELL_W,
    height: DAY_HDR_H,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: '#E5E7EB',
  },
  dayHdrCellToday: {
    backgroundColor: '#EFF6FF',
  },
  dayHdrNum: {
    ...robotoText(600, 12, { color: '#374151' }),
  },
  dayHdrNumToday: {
    color: AmkouyColors.primary,
  },
  dayHdrLetter: {
    ...robotoText(400, 9, { color: '#9CA3AF' }),
  },
  dayHdrWeekend: {
    color: '#EF4444',
  },
  labelCell: {
    width: LABEL_W,
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
    borderRightWidth: 1,
    borderRightColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  labelName: {
    ...robotoText(500, 12, { color: '#111827' }),
  },
  labelStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  labelOcc: {
    ...robotoText(600, 11),
  },
  labelRev: {
    ...robotoText(400, 10, { color: '#6B7280', flex: 1 }),
  },
  conflictDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EF4444',
  },
  bgCell: {
    width: DAY_CELL_W,
    height: ROW_H,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: '#F3F4F6',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F3F4F6',
  },
  bgCellWeekend: {
    backgroundColor: '#FFF7ED',
  },
  bgCellToday: {
    backgroundColor: '#EFF6FF',
  },
  resBlock: {
    position: 'absolute',
    top: 10,
    bottom: 10,
    borderRadius: 4,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    paddingHorizontal: 5,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  resBlockText: {
    ...robotoText(500, 10),
  },
  markerDot: {
    position: 'absolute',
    bottom: 4,
    width: 5,
    height: 5,
    borderRadius: 2.5,
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
  emptyText: {
    ...robotoText(400, 14, { color: '#94A3B8' }),
  },
});

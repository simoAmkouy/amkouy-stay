import { router } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { AccessGuard } from '@/components/amkouy/access-guard';
import { Badge } from '@/components/amkouy/badge';
import { ReservationForm } from '@/components/forms/reservation-form';
import { Icon } from '@/components/icon';
import { AmkouyColors } from '@/constants/amkouy-theme';
import { robotoText } from '@/constants/typography';
import { usePortfolioCalendar } from '@/hooks/use-portfolio-calendar';
import { useReservation, useUpdateReservation } from '@/hooks/use-reservations';
import {
  type CalendarDay,
  type CalendarReservationBlock,
  type PropertyCalendarRow,
} from '@/lib/queries/portfolio-calendar';
import type { ReservationFormInput } from '@/lib/queries/reservations';

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------

const LABEL_W = 152;
const DAY_CELL_W = 30;
const ROW_H = 58;
const DAY_HDR_H = 42;
const BLOCK_INSET_V = 9; // vertical inset for blocks inside a row

// ---------------------------------------------------------------------------
// Locale helpers
// ---------------------------------------------------------------------------

const MONTH_NAMES = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

const DAY_LETTERS = ['D', 'L', 'M', 'M', 'J', 'V', 'S']; // Sun=0 in JS

function formatMAD(n: number): string {
  return (
    n.toLocaleString('fr-MA', { maximumFractionDigits: 0 }) + ' MAD'
  );
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

// ---------------------------------------------------------------------------
// Block visual styles
// ---------------------------------------------------------------------------

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

function blockColors(status: string): BlockStyle {
  return BLOCK_COLORS[status] ?? { bg: '#E5E7EB', text: '#374151', border: '#9CA3AF' };
}

// Occupancy color thresholds
function occColor(pct: number): string {
  if (pct >= 75) return '#15803D';
  if (pct >= 40) return '#B45309';
  return '#B91C1C';
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function MonthNavBar({
  year,
  month,
  onPrev,
  onNext,
  onToday,
}: {
  year: number;
  month: number;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}) {
  const now = new Date();
  const isCurrent = now.getFullYear() === year && now.getMonth() + 1 === month;
  return (
    <View style={styles.monthNav}>
      <TouchableOpacity onPress={onPrev} style={styles.navArrow} hitSlop={10}>
        <Icon name="chevron_left" size={24} color={AmkouyColors.primary} />
      </TouchableOpacity>
      <TouchableOpacity onPress={onToday} style={styles.monthTitle}>
        <Text style={styles.monthTitleText}>
          {MONTH_NAMES[month - 1]} {year}
        </Text>
        {!isCurrent && (
          <View style={styles.todayDot} />
        )}
      </TouchableOpacity>
      <TouchableOpacity onPress={onNext} style={styles.navArrow} hitSlop={10}>
        <Icon name="chevron_right" size={24} color={AmkouyColors.primary} />
      </TouchableOpacity>
    </View>
  );
}

function StatsRow({
  totalProperties,
  avgOccupancy,
  totalRevenue,
}: {
  totalProperties: number;
  avgOccupancy: number;
  totalRevenue: number;
}) {
  return (
    <View style={styles.statsRow}>
      <View style={styles.statChip}>
        <Text style={styles.statValue}>{totalProperties}</Text>
        <Text style={styles.statLabel}>Biens</Text>
      </View>
      <View style={styles.statDivider} />
      <View style={styles.statChip}>
        <Text style={[styles.statValue, { color: occColor(avgOccupancy) }]}>
          {avgOccupancy.toFixed(1)}%
        </Text>
        <Text style={styles.statLabel}>Occ. moy.</Text>
      </View>
      <View style={styles.statDivider} />
      <View style={styles.statChip}>
        <Text style={styles.statValue}>{formatMAD(totalRevenue)}</Text>
        <Text style={styles.statLabel}>Revenus du mois</Text>
      </View>
    </View>
  );
}

type FilterOption = 'active' | 'all' | 'conflicts';
const FILTER_OPTIONS: FilterOption[] = ['active', 'all', 'conflicts'];
const FILTER_LABELS: Record<FilterOption, string> = {
  active: 'Actifs',
  all: 'Tous',
  conflicts: 'Conflits',
};

function FilterBar({
  active,
  onChange,
}: {
  active: FilterOption;
  onChange: (v: FilterOption) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.filterBar}
      contentContainerStyle={styles.filterBarContent}
    >
      {FILTER_OPTIONS.map((opt) => (
        <TouchableOpacity
          key={opt}
          style={[styles.filterChip, active === opt && styles.filterChipActive]}
          onPress={() => onChange(opt)}
        >
          <Text
            style={[
              styles.filterChipText,
              active === opt && styles.filterChipTextActive,
            ]}
          >
            {FILTER_LABELS[opt]}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

function DayHeaderRow({ days }: { days: CalendarDay[] }) {
  return (
    <View style={[styles.dayHeaderRow, { width: days.length * DAY_CELL_W }]}>
      {days.map((day) => (
        <View
          key={day.dayOfMonth}
          style={[
            styles.dayHeaderCell,
            day.isToday && styles.dayHeaderToday,
          ]}
        >
          <Text
            style={[
              styles.dayHeaderNum,
              day.isWeekend && styles.dayHeaderWeekend,
              day.isToday && styles.dayHeaderTodayText,
            ]}
          >
            {day.dayOfMonth}
          </Text>
          <Text style={[styles.dayHeaderLetter, day.isWeekend && styles.dayHeaderWeekend]}>
            {DAY_LETTERS[day.dayOfWeek]}
          </Text>
        </View>
      ))}
    </View>
  );
}

function PropertyLabelCell({
  row,
  onPress,
}: {
  row: PropertyCalendarRow;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.labelCell} onPress={onPress} activeOpacity={0.7}>
      <Text style={styles.labelName} numberOfLines={1}>
        {row.property.name}
      </Text>
      <View style={styles.labelStats}>
        <Text style={[styles.labelOcc, { color: occColor(row.occupancyPct) }]}>
          {row.occupancyPct.toFixed(0)}%
        </Text>
        <Text style={styles.labelRev} numberOfLines={1}>
          {formatMAD(row.monthRevenue)}
        </Text>
      </View>
      {row.hasConflict && (
        <Badge label="Conflit" bg="#FEE2E2" color="#991B1B" size="sm" />
      )}
    </TouchableOpacity>
  );
}

function TimelineRow({
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

  function handleCellPress(day: CalendarDay) {
    const block = row.reservationBlocks.find(
      (b) =>
        day.date >= b.checkIn &&
        day.date < b.checkOut &&
        b.status !== 'cancelled' &&
        b.status !== 'no_show'
    );
    if (block) {
      onTapBlock(block.id);
    } else {
      onTapEmpty(row.property.id, day.date);
    }
  }

  return (
    <View style={[styles.timelineRow, { width: totalWidth }]}>
      {/* Background grid cells */}
      <View style={[StyleSheet.absoluteFill, { flexDirection: 'row' }]}>
        {days.map((day, i) => (
          <TouchableOpacity
            key={i}
            style={[
              styles.bgCell,
              day.isWeekend && styles.bgCellWeekend,
              day.isToday && styles.bgCellToday,
            ]}
            onPress={() => handleCellPress(day)}
            activeOpacity={0.6}
          />
        ))}
      </View>

      {/* Reservation blocks */}
      {row.reservationBlocks.map((block) => {
        const colors = blockColors(block.status);
        return (
          <TouchableOpacity
            key={block.id}
            style={[
              styles.block,
              {
                left: block.startCol * DAY_CELL_W + 1,
                width: block.spanCols * DAY_CELL_W - 2,
                backgroundColor: colors.bg,
                borderLeftColor: colors.border,
                borderTopLeftRadius: block.isStart ? 5 : 0,
                borderBottomLeftRadius: block.isStart ? 5 : 0,
                borderTopRightRadius: block.isEnd ? 5 : 0,
                borderBottomRightRadius: block.isEnd ? 5 : 0,
              },
            ]}
            onPress={() => onTapBlock(block.id)}
            activeOpacity={0.8}
          >
            {block.spanCols >= 3 && block.guestName ? (
              <Text
                numberOfLines={1}
                style={[styles.blockText, { color: colors.text }]}
              >
                {block.guestName.split(' ')[0]}
              </Text>
            ) : null}
          </TouchableOpacity>
        );
      })}

      {/* Cleaning markers */}
      {row.cleaningMarkers.map((m) => (
        <View
          key={m.taskId}
          style={[
            styles.markerDot,
            {
              left: m.col * DAY_CELL_W + DAY_CELL_W / 2 - 3,
              backgroundColor: '#A78BFA',
            },
          ]}
        />
      ))}

      {/* Maintenance markers */}
      {row.maintenanceMarkers.map((m) => (
        <View
          key={m.ticketId}
          style={[
            styles.markerDot,
            {
              left: m.col * DAY_CELL_W + DAY_CELL_W / 2 - 3,
              bottom: 3,
              backgroundColor: m.priority === 'urgent' ? '#EF4444' : '#F59E0B',
            },
          ]}
        />
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Reservation detail modal
// ---------------------------------------------------------------------------

function ReservationDetailModal({
  reservationId,
  onClose,
}: {
  reservationId: string;
  onClose: () => void;
}) {
  const { data: reservation, isLoading } = useReservation(reservationId);
  const updateReservation = useUpdateReservation();
  const [showEdit, setShowEdit] = useState(false);

  const initialEditValues = useMemo(() => {
    if (!reservation) return undefined;
    return {
      propertyId: reservation.property_id,
      channelId: reservation.channel_id ?? '',
      guestName: reservation.guest?.full_name ?? '',
      guestPhone: reservation.guest?.phone ?? '',
      checkInDate: reservation.check_in_date,
      checkOutDate: reservation.check_out_date,
      nightlyRate: reservation.nightly_rate,
      cleaningFeeAmount: reservation.cleaning_fee_amount,
      adults: reservation.adults,
      children: reservation.children,
      status: reservation.status,
      specialRequests: reservation.special_requests ?? '',
    };
  }, [reservation]);

  function handleEditSubmit(values: ReservationFormInput) {
    if (!reservation) return;
    updateReservation.mutate(
      { id: reservation.id, input: values },
      { onSuccess: () => setShowEdit(false) }
    );
  }

  return (
    <>
      {/* Backdrop */}
      <Pressable style={styles.detailBackdrop} onPress={onClose} />

      {/* Panel */}
      <View style={styles.detailPanel}>
        {/* Handle bar */}
        <View style={styles.detailHandle} />

        {isLoading || !reservation ? (
          <View style={styles.detailLoading}>
            <ActivityIndicator color={AmkouyColors.primary} />
          </View>
        ) : (
          <>
            {/* Header */}
            <View style={styles.detailHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.detailCode}>{reservation.reservation_code}</Text>
                <Text style={styles.detailGuest} numberOfLines={1}>
                  {reservation.guest?.full_name ?? '—'}
                </Text>
              </View>
              <Badge
                label={STATUS_LABELS[reservation.status] ?? reservation.status}
                bg={blockColors(reservation.status).bg}
                color={blockColors(reservation.status).text}
              />
            </View>

            {/* Info rows */}
            <View style={styles.detailBody}>
              <DetailRow icon="apartment" label="Bien" value={reservation.property?.name ?? '—'} />
              <DetailRow
                icon="calendar_today"
                label="Séjour"
                value={`${reservation.check_in_date} → ${reservation.check_out_date} (${reservation.nights ?? '?'} nuits)`}
              />
              <DetailRow
                icon="people"
                label="Voyageurs"
                value={`${reservation.adults} adulte(s)${reservation.children ? `, ${reservation.children} enfant(s)` : ''}`}
              />
              <DetailRow
                icon="payments"
                label="Total"
                value={formatMAD(reservation.total_amount)}
              />
            </View>

            {/* Actions */}
            <View style={styles.detailActions}>
              <TouchableOpacity
                style={[styles.detailBtn, styles.detailBtnSecondary]}
                onPress={() => setShowEdit(true)}
              >
                <Icon name="edit" size={16} color={AmkouyColors.primary} />
                <Text style={styles.detailBtnSecondaryText}>Modifier</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.detailBtn, styles.detailBtnPrimary]}
                onPress={() => {
                  onClose();
                  router.push(`/reservations/${reservation.id}` as any);
                }}
              >
                <Icon name="open_in_new" size={16} color="#fff" />
                <Text style={styles.detailBtnPrimaryText}>Voir la fiche</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>

      {/* Edit form */}
      {reservation && (
        <ReservationForm
          visible={showEdit}
          mode="edit"
          initialValues={initialEditValues}
          onClose={() => setShowEdit(false)}
          onSubmit={handleEditSubmit}
          submitting={updateReservation.isPending}
        />
      )}
    </>
  );
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.detailRow}>
      <Icon name={icon} size={15} color={AmkouyColors.textFaint} />
      <Text style={styles.detailRowLabel}>{label}</Text>
      <Text style={styles.detailRowValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

function CalendarContent() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [filter, setFilter] = useState<FilterOption>('active');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newResContext, setNewResContext] = useState<{
    propertyId: string;
    date: string;
  } | null>(null);

  const { data, isLoading, error, refetch } = usePortfolioCalendar(year, month);

  const leftRef = useRef<ScrollView>(null);

  function prevMonth() {
    if (month === 1) { setYear((y) => y - 1); setMonth(12); }
    else setMonth((m) => m - 1);
  }
  function nextMonth() {
    if (month === 12) { setYear((y) => y + 1); setMonth(1); }
    else setMonth((m) => m + 1);
  }
  function goToday() {
    const n = new Date();
    setYear(n.getFullYear());
    setMonth(n.getMonth() + 1);
  }

  const filteredRows = useMemo(() => {
    if (!data) return [];
    let rows = data.rows;
    if (filter === 'active')
      rows = rows.filter((r) => r.property.status === 'active');
    if (filter === 'conflicts') rows = rows.filter((r) => r.hasConflict);
    return [...rows].sort((a, b) => b.occupancyPct - a.occupancyPct);
  }, [data, filter]);

  const handleTapBlock = useCallback((id: string) => {
    setSelectedId(id);
  }, []);

  const handleTapEmpty = useCallback((propertyId: string, date: string) => {
    setNewResContext({ propertyId, date });
  }, []);

  const handleGoToApartment = useCallback(
    (row: PropertyCalendarRow) => {
      router.push({
        pathname: '/more/reports/apartment-calendar' as any,
        params: {
          propertyId: row.property.id,
          year: String(year),
          month: String(month),
        },
      });
    },
    [year, month]
  );

  const days = data?.days ?? [];
  const totalGridWidth = days.length * DAY_CELL_W;

  return (
    <SafeAreaView style={styles.safe}>
      {/* Screen header */}
      <View style={styles.screenHeader}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          hitSlop={8}
        >
          <Icon name="arrow_back" size={22} color={AmkouyColors.primary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Calendrier portefeuille</Text>
          <Text style={styles.headerSub}>Vue mensuelle — toutes résidences</Text>
        </View>
        <TouchableOpacity onPress={refetch} hitSlop={8}>
          <Icon name="refresh" size={20} color={AmkouyColors.textFaint} />
        </TouchableOpacity>
      </View>

      {/* Month navigation */}
      <MonthNavBar
        year={year}
        month={month}
        onPrev={prevMonth}
        onNext={nextMonth}
        onToday={goToday}
      />

      {/* Stats */}
      {data && (
        <StatsRow
          totalProperties={filteredRows.length}
          avgOccupancy={
            filteredRows.length > 0
              ? filteredRows.reduce((s, r) => s + r.occupancyPct, 0) / filteredRows.length
              : 0
          }
          totalRevenue={filteredRows.reduce((s, r) => s + r.monthRevenue, 0)}
        />
      )}

      {/* Filters */}
      <FilterBar active={filter} onChange={setFilter} />

      {/* Gantt table */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={AmkouyColors.primary} />
          <Text style={styles.loadingText}>Chargement du calendrier…</Text>
        </View>
      ) : error ? (
        <View style={styles.loadingContainer}>
          <Icon name="error_outline" size={32} color={AmkouyColors.error} />
          <Text style={styles.loadingText}>Erreur lors du chargement</Text>
          <TouchableOpacity onPress={refetch} style={styles.retryBtn}>
            <Text style={styles.retryText}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      ) : filteredRows.length === 0 ? (
        <View style={styles.loadingContainer}>
          <Icon name="event_busy" size={40} color={AmkouyColors.textFainter} />
          <Text style={styles.emptyText}>
            {filter === 'conflicts'
              ? 'Aucun conflit détecté ce mois-ci'
              : 'Aucune résidence à afficher'}
          </Text>
        </View>
      ) : (
        <View style={styles.ganttContainer}>
          {/* Fixed left column */}
          <View style={[styles.leftColumn, { width: LABEL_W }]}>
            <View style={{ height: DAY_HDR_H }} />
            <ScrollView
              ref={leftRef}
              scrollEnabled={false}
              showsVerticalScrollIndicator={false}
            >
              {filteredRows.map((row) => (
                <PropertyLabelCell
                  key={row.property.id}
                  row={row}
                  onPress={() => handleGoToApartment(row)}
                />
              ))}
            </ScrollView>
          </View>

          {/* Horizontally scrollable grid */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={true}
            style={{ flex: 1 }}
          >
            <ScrollView
              showsVerticalScrollIndicator={false}
              stickyHeaderIndices={[0]}
              scrollEventThrottle={16}
              onScroll={(e) => {
                leftRef.current?.scrollTo({
                  y: e.nativeEvent.contentOffset.y,
                  animated: false,
                });
              }}
            >
              {/* Sticky day header */}
              <View style={styles.dayHeaderWrapper}>
                <DayHeaderRow days={days} />
              </View>

              {/* Timeline rows */}
              {filteredRows.map((row) => (
                <TimelineRow
                  key={row.property.id}
                  row={row}
                  days={days}
                  onTapBlock={handleTapBlock}
                  onTapEmpty={handleTapEmpty}
                />
              ))}

              {/* Grid bottom border */}
              <View style={{ width: totalGridWidth, height: 1, backgroundColor: AmkouyColors.hairline }} />
            </ScrollView>
          </ScrollView>
        </View>
      )}

      {/* Legend */}
      {!isLoading && !error && filteredRows.length > 0 && (
        <View style={styles.legend}>
          {(['confirmed', 'checked_in', 'pending'] as const).map((s) => (
            <View key={s} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: blockColors(s).bg, borderColor: blockColors(s).border }]} />
              <Text style={styles.legendLabel}>{STATUS_LABELS[s]}</Text>
            </View>
          ))}
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#A78BFA', borderColor: '#7C3AED' }]} />
            <Text style={styles.legendLabel}>Ménage</Text>
          </View>
        </View>
      )}

      {/* Reservation detail overlay */}
      {selectedId && (
        <View style={[StyleSheet.absoluteFill, { pointerEvents: 'box-none' }]}>
          <ReservationDetailModal
            reservationId={selectedId}
            onClose={() => setSelectedId(null)}
          />
        </View>
      )}

      {/* New reservation form */}
      <ReservationForm
        visible={!!newResContext}
        mode="create"
        initialValues={
          newResContext
            ? {
                propertyId: newResContext.propertyId,
                checkInDate: newResContext.date,
              }
            : undefined
        }
        onClose={() => setNewResContext(null)}
        onSubmit={() => setNewResContext(null)}
        submitting={false}
      />
    </SafeAreaView>
  );
}

export default function PortfolioCalendarScreen() {
  return (
    <AccessGuard resource="reports">
      <CalendarContent />
    </AccessGuard>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: AmkouyColors.surface,
  },

  // Screen header
  screenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: AmkouyColors.hairline,
    backgroundColor: AmkouyColors.surface,
  },
  backBtn: { padding: 2 },
  headerTitle: {
    ...robotoText(700, 17, { color: AmkouyColors.primary }),
  },
  headerSub: {
    ...robotoText(400, 11, { color: AmkouyColors.textFaint, marginTop: 1 }),
  },

  // Month nav
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: AmkouyColors.surface,
  },
  navArrow: { padding: 4 },
  monthTitle: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  monthTitleText: {
    ...robotoText(700, 18, { color: AmkouyColors.primary }),
  },
  todayDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: AmkouyColors.secondary,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 14,
    marginBottom: 8,
    backgroundColor: AmkouyColors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: AmkouyColors.hairline,
    paddingVertical: 10,
  },
  statChip: { flex: 1, alignItems: 'center' },
  statValue: {
    ...robotoText(700, 14, { color: AmkouyColors.primary }),
  },
  statLabel: {
    ...robotoText(400, 10, { color: AmkouyColors.textFaint, marginTop: 1 }),
  },
  statDivider: { width: 1, height: 28, backgroundColor: AmkouyColors.hairline },

  // Filter bar
  filterBar: { marginBottom: 4 },
  filterBarContent: { paddingHorizontal: 14, gap: 7 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: AmkouyColors.border,
    backgroundColor: AmkouyColors.card,
  },
  filterChipActive: {
    backgroundColor: AmkouyColors.primary,
    borderColor: AmkouyColors.primary,
  },
  filterChipText: {
    ...robotoText(500, 12, { color: AmkouyColors.textMuted }),
  },
  filterChipTextActive: { color: '#fff' },

  // Gantt
  ganttContainer: {
    flex: 1,
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: AmkouyColors.hairline,
  },
  leftColumn: {
    borderRightWidth: 1,
    borderRightColor: AmkouyColors.hairline,
    backgroundColor: AmkouyColors.surface,
  },

  // Day header
  dayHeaderWrapper: {
    backgroundColor: AmkouyColors.surface,
    borderBottomWidth: 1,
    borderBottomColor: AmkouyColors.hairline,
  },
  dayHeaderRow: { flexDirection: 'row', height: DAY_HDR_H },
  dayHeaderCell: {
    width: DAY_CELL_W,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 0.5,
    borderRightColor: AmkouyColors.hairline,
  },
  dayHeaderToday: { backgroundColor: '#FFF8E1' },
  dayHeaderNum: {
    ...robotoText(700, 10, { color: AmkouyColors.textFaint }),
  },
  dayHeaderLetter: {
    ...robotoText(400, 8, { color: AmkouyColors.textFainter }),
  },
  dayHeaderWeekend: { color: AmkouyColors.secondary },
  dayHeaderTodayText: { color: AmkouyColors.primary },

  // Property label
  labelCell: {
    height: ROW_H,
    paddingHorizontal: 10,
    paddingVertical: 6,
    justifyContent: 'center',
    borderBottomWidth: 0.5,
    borderBottomColor: AmkouyColors.hairline,
    gap: 2,
  },
  labelName: {
    ...robotoText(600, 11, { color: AmkouyColors.primary }),
  },
  labelStats: { flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' },
  labelOcc: { ...robotoText(700, 10) },
  labelRev: { ...robotoText(400, 9, { color: AmkouyColors.textFaint }), flex: 1 },

  // Timeline row
  timelineRow: {
    height: ROW_H,
    position: 'relative',
    borderBottomWidth: 0.5,
    borderBottomColor: AmkouyColors.hairline,
  },
  bgCell: {
    width: DAY_CELL_W,
    height: ROW_H,
    borderRightWidth: 0.5,
    borderRightColor: AmkouyColors.hairline,
  },
  bgCellWeekend: { backgroundColor: '#F9F8F5' },
  bgCellToday: { backgroundColor: '#FFFDF0' },

  // Reservation block
  block: {
    position: 'absolute',
    top: BLOCK_INSET_V,
    height: ROW_H - BLOCK_INSET_V * 2,
    justifyContent: 'center',
    paddingHorizontal: 5,
    borderLeftWidth: 2.5,
    overflow: 'hidden',
  },
  blockText: { ...robotoText(500, 9) },

  // Markers (cleaning/maintenance dots)
  markerDot: {
    position: 'absolute',
    bottom: 4,
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  // Loading / empty
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: { ...robotoText(400, 14, { color: AmkouyColors.textFaint }) },
  emptyText: { ...robotoText(400, 14, { color: AmkouyColors.textFaint }), textAlign: 'center' },
  retryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: AmkouyColors.primary,
    borderRadius: 8,
  },
  retryText: { ...robotoText(600, 13, { color: '#fff' }) },

  // Legend
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: AmkouyColors.hairline,
    backgroundColor: AmkouyColors.surface,
    flexWrap: 'wrap',
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 3,
    borderWidth: 1.5,
  },
  legendLabel: { ...robotoText(400, 10, { color: AmkouyColors.textFaint }) },

  // Reservation detail panel
  detailBackdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(10,16,30,0.4)',
  },
  detailPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: AmkouyColors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 12,
  },
  detailHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: AmkouyColors.border,
    alignSelf: 'center',
    marginVertical: 10,
  },
  detailLoading: { height: 120, alignItems: 'center', justifyContent: 'center' },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 18,
    paddingBottom: 12,
    gap: 10,
  },
  detailCode: { ...robotoText(700, 15, { color: AmkouyColors.primary }) },
  detailGuest: { ...robotoText(400, 13, { color: AmkouyColors.textMuted, marginTop: 2 }) },
  detailBody: { paddingHorizontal: 18, gap: 9, marginBottom: 14 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  detailRowLabel: {
    ...robotoText(500, 12, { color: AmkouyColors.textFaint, width: 60 }),
  },
  detailRowValue: { ...robotoText(400, 12, { color: AmkouyColors.text, flex: 1 }) },
  detailActions: {
    flexDirection: 'row',
    paddingHorizontal: 18,
    gap: 10,
    marginTop: 4,
  },
  detailBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 44,
    borderRadius: 12,
  },
  detailBtnPrimary: { backgroundColor: AmkouyColors.primary },
  detailBtnSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: AmkouyColors.primary,
  },
  detailBtnPrimaryText: { ...robotoText(600, 13, { color: '#fff' }) },
  detailBtnSecondaryText: { ...robotoText(600, 13, { color: AmkouyColors.primary }) },
});

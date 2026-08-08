import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
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
import { useApartmentCalendar } from '@/hooks/use-portfolio-calendar';
import { useReservation, useUpdateReservation } from '@/hooks/use-reservations';
import {
  buildWeekRows,
  getBlockForDate,
  type CalendarDay,
  type CalendarReservationBlock,
} from '@/lib/queries/portfolio-calendar';
import type { ReservationFormInput } from '@/lib/queries/reservations';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MONTH_NAMES = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

const WEEK_DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

function formatMAD(n: number): string {
  return n.toLocaleString('fr-MA', { maximumFractionDigits: 0 }) + ' MAD';
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
// Block styles — same palette as portfolio calendar for visual consistency
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

function blockStyle(status: string): BlockStyle {
  return BLOCK_COLORS[status] ?? { bg: '#E5E7EB', text: '#374151', border: '#9CA3AF' };
}

function occColor(pct: number): string {
  if (pct >= 75) return '#15803D';
  if (pct >= 40) return '#B45309';
  return '#B91C1C';
}

// ---------------------------------------------------------------------------
// Day cell
// ---------------------------------------------------------------------------

function DayCell({
  day,
  block,
  isCheckIn,
  hasClean,
  hasMaintenance,
  onPress,
}: {
  day: CalendarDay;
  block: CalendarReservationBlock | null;
  isCheckIn: boolean;
  hasClean: boolean;
  hasMaintenance: boolean;
  onPress: () => void;
}) {
  const colors = block ? blockStyle(block.status) : null;
  const isCheckOut = block ? day.date === block.checkOut : false;

  return (
    <TouchableOpacity
      style={[
        styles.dayCell,
        day.isWeekend && styles.dayCellWeekend,
        day.isToday && styles.dayCellToday,
        colors && { backgroundColor: colors.bg },
        isCheckIn && styles.dayCellCheckIn,
        isCheckOut && styles.dayCellCheckOut,
      ]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Text
        style={[
          styles.dayNum,
          day.isToday && styles.dayNumToday,
          colors && { color: colors.text },
        ]}
      >
        {day.dayOfMonth}
      </Text>

      {/* Guest first name on check-in day */}
      {isCheckIn && block?.guestName && (
        <Text
          numberOfLines={1}
          style={[styles.guestTag, { color: colors!.text }]}
        >
          {block.guestName.split(' ')[0]}
        </Text>
      )}

      {/* Indicators */}
      <View style={styles.cellIndicators}>
        {hasClean && <View style={styles.indClean} />}
        {hasMaintenance && <View style={styles.indMaint} />}
      </View>
    </TouchableOpacity>
  );
}

function EmptyCell() {
  return <View style={styles.emptyCell} />;
}

// ---------------------------------------------------------------------------
// Reservation detail modal (shared with portfolio calendar)
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
      <Pressable style={styles.detailBackdrop} onPress={onClose} />
      <View style={styles.detailPanel}>
        <View style={styles.detailHandle} />

        {isLoading || !reservation ? (
          <View style={styles.detailLoading}>
            <ActivityIndicator color={AmkouyColors.primary} />
          </View>
        ) : (
          <>
            <View style={styles.detailHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.detailCode}>{reservation.reservation_code}</Text>
                <Text style={styles.detailGuest} numberOfLines={1}>
                  {reservation.guest?.full_name ?? '—'}
                </Text>
              </View>
              <Badge
                label={STATUS_LABELS[reservation.status] ?? reservation.status}
                bg={blockStyle(reservation.status).bg}
                color={blockStyle(reservation.status).text}
              />
            </View>

            <View style={styles.detailInfo}>
              <InfoRow icon="calendar_today" label="Séjour"
                value={`${reservation.check_in_date} → ${reservation.check_out_date} (${reservation.nights ?? '?'} nuits)`} />
              <InfoRow icon="people" label="Voyageurs"
                value={`${reservation.adults} adulte(s)${reservation.children ? `, ${reservation.children} enfant(s)` : ''}`} />
              <InfoRow icon="payments" label="Total" value={formatMAD(reservation.total_amount)} />
            </View>

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

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Icon name={icon} size={14} color={AmkouyColors.textFaint} />
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Availability summary strip
// ---------------------------------------------------------------------------

function AvailabilityStrip({
  occupancyPct,
  monthRevenue,
  hasConflict,
}: {
  occupancyPct: number;
  monthRevenue: number;
  hasConflict: boolean;
}) {
  return (
    <View style={styles.availStrip}>
      <View style={styles.availStat}>
        <Text style={[styles.availValue, { color: occColor(occupancyPct) }]}>
          {occupancyPct.toFixed(1)}%
        </Text>
        <Text style={styles.availLabel}>Occupation</Text>
      </View>
      <View style={styles.availDivider} />
      <View style={styles.availStat}>
        <Text style={styles.availValue}>{formatMAD(monthRevenue)}</Text>
        <Text style={styles.availLabel}>Revenus du mois</Text>
      </View>
      {hasConflict && (
        <>
          <View style={styles.availDivider} />
          <View style={styles.availStat}>
            <Icon name="warning" size={18} color="#991B1B" />
            <Text style={[styles.availLabel, { color: '#991B1B' }]}>Conflit</Text>
          </View>
        </>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

function ApartmentCalendarContent() {
  const params = useLocalSearchParams<{
    propertyId: string;
    year: string;
    month: string;
  }>();

  const [year, setYear] = useState(
    params.year ? parseInt(params.year, 10) : new Date().getFullYear()
  );
  const [month, setMonth] = useState(
    params.month ? parseInt(params.month, 10) : new Date().getMonth() + 1
  );

  const { data, property, isLoading, error, refetch } = useApartmentCalendar(
    params.propertyId,
    year,
    month
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newResContext, setNewResContext] = useState<string | null>(null); // date string

  function prevMonth() {
    if (month === 1) { setYear((y) => y - 1); setMonth(12); }
    else setMonth((m) => m - 1);
  }
  function nextMonth() {
    if (month === 12) { setYear((y) => y + 1); setMonth(1); }
    else setMonth((m) => m + 1);
  }

  const propertyRow = data?.rows[0] ?? null;
  const blocks = propertyRow?.reservationBlocks ?? [];
  const cleaningCols = new Set(propertyRow?.cleaningMarkers.map((m) => m.col) ?? []);
  const maintCols = new Set(propertyRow?.maintenanceMarkers.map((m) => m.col) ?? []);
  const days = data?.days ?? [];
  const weekRows = useMemo(() => (days.length > 0 ? buildWeekRows(days, year, month) : []), [days, year, month]);

  function handleDayPress(day: CalendarDay) {
    const block = getBlockForDate(day.date, blocks);
    if (block) {
      setSelectedId(block.id);
    } else {
      setNewResContext(day.date);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.screenHeader}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
          <Icon name="arrow_back" size={22} color={AmkouyColors.primary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {property?.name ?? 'Appartement'}
          </Text>
          <Text style={styles.headerSub}>{property?.city ?? ''}</Text>
        </View>
        <TouchableOpacity
          onPress={() => {
            router.push('/more/reports/calendar' as any);
          }}
          hitSlop={8}
        >
          <Icon name="grid_view" size={20} color={AmkouyColors.textFaint} />
        </TouchableOpacity>
      </View>

      {/* Month navigation */}
      <View style={styles.monthNav}>
        <TouchableOpacity onPress={prevMonth} hitSlop={10}>
          <Icon name="chevron_left" size={24} color={AmkouyColors.primary} />
        </TouchableOpacity>
        <Text style={styles.monthTitle}>
          {MONTH_NAMES[month - 1]} {year}
        </Text>
        <TouchableOpacity onPress={nextMonth} hitSlop={10}>
          <Icon name="chevron_right" size={24} color={AmkouyColors.primary} />
        </TouchableOpacity>
      </View>

      {/* Occupancy strip */}
      {propertyRow && (
        <AvailabilityStrip
          occupancyPct={propertyRow.occupancyPct}
          monthRevenue={propertyRow.monthRevenue}
          hasConflict={propertyRow.hasConflict}
        />
      )}

      {/* Calendar body */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={AmkouyColors.primary} />
        </View>
      ) : error ? (
        <View style={styles.loadingContainer}>
          <Icon name="error_outline" size={32} color={AmkouyColors.error} />
          <Text style={styles.loadingText}>Erreur lors du chargement</Text>
          <TouchableOpacity onPress={refetch} style={styles.retryBtn}>
            <Text style={styles.retryText}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.calendarScroll}
          showsVerticalScrollIndicator={false}
        >
          {/* Week day header */}
          <View style={styles.weekHeader}>
            {WEEK_DAYS.map((d) => (
              <View key={d} style={styles.weekHeaderCell}>
                <Text style={styles.weekHeaderText}>{d}</Text>
              </View>
            ))}
          </View>

          {/* Week rows */}
          {weekRows.map((week, wi) => (
            <View key={wi} style={styles.weekRow}>
              {week.map((day, di) =>
                day ? (
                  <DayCell
                    key={day.date}
                    day={day}
                    block={getBlockForDate(day.date, blocks)}
                    isCheckIn={blocks.some((b) => b.checkIn === day.date && b.status !== 'cancelled' && b.status !== 'no_show')}
                    hasClean={cleaningCols.has(day.dayOfMonth - 1)}
                    hasMaintenance={maintCols.has(day.dayOfMonth - 1)}
                    onPress={() => handleDayPress(day)}
                  />
                ) : (
                  <EmptyCell key={`empty-${wi}-${di}`} />
                )
              )}
            </View>
          ))}

          {/* Reservation list for the month */}
          {blocks.length > 0 && (
            <View style={styles.resList}>
              <Text style={styles.resListTitle}>Réservations du mois</Text>
              {blocks.map((b) => {
                const colors = blockStyle(b.status);
                return (
                  <TouchableOpacity
                    key={b.id}
                    style={styles.resListItem}
                    onPress={() => setSelectedId(b.id)}
                  >
                    <View style={[styles.resListColor, { backgroundColor: colors.bg, borderColor: colors.border }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.resListGuest} numberOfLines={1}>
                        {b.guestName ?? '—'}
                      </Text>
                      <Text style={styles.resListDates}>
                        {b.checkIn} → {b.checkOut}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 3 }}>
                      <Badge
                        label={STATUS_LABELS[b.status] ?? b.status}
                        bg={colors.bg}
                        color={colors.text}
                        size="sm"
                      />
                      <Text style={styles.resListAmount}>{formatMAD(b.totalAmount)}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Cleaning tasks */}
          {(propertyRow?.cleaningMarkers.length ?? 0) > 0 && (
            <View style={styles.resList}>
              <Text style={styles.resListTitle}>Ménages planifiés</Text>
              {propertyRow!.cleaningMarkers.map((m) => (
                <View key={m.taskId} style={styles.resListItem}>
                  <View style={[styles.resListColor, { backgroundColor: '#EDE9FE', borderColor: '#7C3AED' }]} />
                  <Text style={styles.resListGuest}>Ménage — Jour {m.col + 1}</Text>
                  <Badge label={m.status} bg="#EDE9FE" color="#5B21B6" size="sm" />
                </View>
              ))}
            </View>
          )}

          {/* Maintenance tickets */}
          {(propertyRow?.maintenanceMarkers.length ?? 0) > 0 && (
            <View style={styles.resList}>
              <Text style={styles.resListTitle}>Tickets de maintenance</Text>
              {propertyRow!.maintenanceMarkers.map((m) => (
                <View key={m.ticketId} style={styles.resListItem}>
                  <View style={[styles.resListColor, {
                    backgroundColor: m.priority === 'urgent' ? '#FEE2E2' : '#FEF3C7',
                    borderColor: m.priority === 'urgent' ? '#EF4444' : '#F59E0B',
                  }]} />
                  <Text style={styles.resListGuest}>Maintenance — Jour {m.col + 1}</Text>
                  <Badge
                    label={m.priority === 'urgent' ? 'Urgent' : 'Normal'}
                    bg={m.priority === 'urgent' ? '#FEE2E2' : '#FEF3C7'}
                    color={m.priority === 'urgent' ? '#991B1B' : '#92400E'}
                    size="sm"
                  />
                </View>
              ))}
            </View>
          )}

          {/* Legend */}
          <View style={styles.legend}>
            {(['confirmed', 'checked_in', 'pending'] as const).map((s) => (
              <View key={s} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: blockStyle(s).bg, borderColor: blockStyle(s).border }]} />
                <Text style={styles.legendLabel}>{STATUS_LABELS[s]}</Text>
              </View>
            ))}
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#EDE9FE', borderColor: '#7C3AED' }]} />
              <Text style={styles.legendLabel}>Ménage</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#FEE2E2', borderColor: '#EF4444' }]} />
              <Text style={styles.legendLabel}>Maintenance</Text>
            </View>
          </View>
        </ScrollView>
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
          newResContext && params.propertyId
            ? { propertyId: params.propertyId, checkInDate: newResContext }
            : undefined
        }
        onClose={() => setNewResContext(null)}
        onSubmit={() => setNewResContext(null)}
        submitting={false}
      />
    </SafeAreaView>
  );
}

export default function ApartmentCalendarScreen() {
  return (
    <AccessGuard resource="reports">
      <ApartmentCalendarContent />
    </AccessGuard>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const CELL_SIZE = 48; // px — each day cell is a near-square

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: AmkouyColors.surface },

  screenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: AmkouyColors.hairline,
  },
  backBtn: { padding: 2 },
  headerTitle: { ...robotoText(700, 17, { color: AmkouyColors.primary }) },
  headerSub: { ...robotoText(400, 11, { color: AmkouyColors.textFaint, marginTop: 1 }) },

  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  monthTitle: { ...robotoText(700, 18, { color: AmkouyColors.primary }) },

  // Availability strip
  availStrip: {
    flexDirection: 'row',
    marginHorizontal: 14,
    marginBottom: 10,
    backgroundColor: AmkouyColors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: AmkouyColors.hairline,
    paddingVertical: 10,
  },
  availStat: { flex: 1, alignItems: 'center', gap: 2 },
  availValue: { ...robotoText(700, 14, { color: AmkouyColors.primary }) },
  availLabel: { ...robotoText(400, 10, { color: AmkouyColors.textFaint }) },
  availDivider: { width: 1, height: 28, backgroundColor: AmkouyColors.hairline },

  // Calendar grid
  calendarScroll: { paddingBottom: 32 },
  weekHeader: {
    flexDirection: 'row',
    paddingHorizontal: 6,
    marginBottom: 4,
  },
  weekHeaderCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
  },
  weekHeaderText: { ...robotoText(600, 11, { color: AmkouyColors.textFaint }) },
  weekRow: {
    flexDirection: 'row',
    paddingHorizontal: 6,
    marginBottom: 3,
  },

  // Day cell
  dayCell: {
    flex: 1,
    minHeight: CELL_SIZE,
    margin: 1.5,
    borderRadius: 8,
    padding: 5,
    backgroundColor: AmkouyColors.card,
    borderWidth: 1,
    borderColor: AmkouyColors.hairline,
    alignItems: 'flex-start',
  },
  dayCellWeekend: { backgroundColor: '#F9F8F5' },
  dayCellToday: {
    borderColor: AmkouyColors.primary,
    borderWidth: 1.5,
  },
  dayCellCheckIn: {
    borderTopLeftRadius: 10,
    borderBottomLeftRadius: 10,
  },
  dayCellCheckOut: {
    borderTopRightRadius: 10,
    borderBottomRightRadius: 10,
  },
  emptyCell: { flex: 1, margin: 1.5 },
  dayNum: { ...robotoText(600, 13, { color: AmkouyColors.text }) },
  dayNumToday: { color: AmkouyColors.primary },
  guestTag: {
    ...robotoText(400, 9, { marginTop: 2 }),
    width: '100%',
  },
  cellIndicators: {
    flexDirection: 'row',
    gap: 3,
    marginTop: 3,
  },
  indClean: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#7C3AED',
  },
  indMaint: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#EF4444',
  },

  // Reservation list
  resList: {
    marginTop: 16,
    marginHorizontal: 14,
    backgroundColor: AmkouyColors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: AmkouyColors.hairline,
    overflow: 'hidden',
  },
  resListTitle: {
    ...robotoText(600, 12, {
      color: AmkouyColors.textFaint,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: AmkouyColors.hairline,
    }),
  },
  resListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 0.5,
    borderBottomColor: AmkouyColors.hairline,
  },
  resListColor: {
    width: 4,
    alignSelf: 'stretch',
    borderRadius: 2,
    borderWidth: 1,
  },
  resListGuest: { ...robotoText(500, 13, { color: AmkouyColors.text, flex: 1 }) },
  resListDates: { ...robotoText(400, 10, { color: AmkouyColors.textFaint, marginTop: 1 }) },
  resListAmount: { ...robotoText(500, 10, { color: AmkouyColors.textFaint }) },

  // Legend
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 16,
    marginTop: 8,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 12, height: 12, borderRadius: 3, borderWidth: 1.5 },
  legendLabel: { ...robotoText(400, 10, { color: AmkouyColors.textFaint }) },

  // Loading
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: { ...robotoText(400, 14, { color: AmkouyColors.textFaint }) },
  retryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: AmkouyColors.primary,
    borderRadius: 8,
  },
  retryText: { ...robotoText(600, 13, { color: '#fff' }) },

  // Detail modal
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
  detailInfo: { paddingHorizontal: 18, gap: 8, marginBottom: 14 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoLabel: { ...robotoText(500, 12, { color: AmkouyColors.textFaint, width: 55 }) },
  infoValue: { ...robotoText(400, 12, { color: AmkouyColors.text, flex: 1 }) },
  detailActions: { flexDirection: 'row', paddingHorizontal: 18, gap: 10, marginTop: 4 },
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

import { differenceInCalendarDays, subDays } from 'date-fns';
import React, { ReactNode, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { AmkouyColors, CardShadow } from '@/constants/amkouy-theme';
import { robotoText } from '@/constants/typography';
import { usePropertyPerformanceReport, usePropertyReservationHistory } from '@/hooks/use-intelligence';
import { PropertyReservationRecord } from '@/lib/queries/intelligence';
import { DateRange, toDateOnlyString } from '@/utils/date-range';

function fmtMAD(value: number): string {
  return `MAD ${value.toLocaleString('fr-FR', { maximumFractionDigits: 2 })}`;
}

function fmtPct(value: number): string {
  return `${value.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`;
}

type Period = '1M' | '3M' | '6M' | '12M';
const PERIOD_LABELS: Record<Period, string> = { '1M': '1 mois', '3M': '3 mois', '6M': '6 mois', '12M': '12 mois' };
const PERIOD_DAYS: Record<Period, number> = { '1M': 30, '3M': 90, '6M': 180, '12M': 365 };

function makeRange(days: number): DateRange {
  const end = new Date();
  const start = subDays(end, days - 1);
  return { start, end };
}

// ── Analytics helpers (pure, no side effects) ─────────────────────────────────

function active(reservations: PropertyReservationRecord[]) {
  return reservations.filter((r) => r.status !== 'cancelled' && r.status !== 'no_show');
}

function computePricingStats(reservations: PropertyReservationRecord[]) {
  const valid = active(reservations).filter((r) => r.nightlyRate > 0);
  if (valid.length === 0) return null;
  const rates = valid.map((r) => r.nightlyRate);
  return {
    count: valid.length,
    avg: rates.reduce((a, b) => a + b, 0) / rates.length,
    min: Math.min(...rates),
    max: Math.max(...rates),
  };
}

function computeLeadTimeStats(reservations: PropertyReservationRecord[]) {
  const days = active(reservations)
    .map((r) => differenceInCalendarDays(new Date(r.checkInDate + 'T12:00:00'), new Date(r.createdAt)))
    .filter((d) => d >= 0 && d <= 365);
  if (days.length < 3) return null;
  const avg = days.reduce((a, b) => a + b, 0) / days.length;
  const sorted = [...days].sort((a, b) => a - b);
  return { count: days.length, avg: Math.round(avg), median: sorted[Math.floor(sorted.length / 2)] };
}

function computeAvgStayFromRaw(reservations: PropertyReservationRecord[]) {
  const valid = active(reservations).filter((r) => r.computedNights > 0);
  if (valid.length === 0) return null;
  return Math.round((valid.reduce((a, r) => a + r.computedNights, 0) / valid.length) * 10) / 10;
}

function computeMonthlyBreakdown(reservations: PropertyReservationRecord[], range: DateRange) {
  const start = toDateOnlyString(range.start);
  const end = toDateOnlyString(range.end);
  const filtered = active(reservations).filter((r) => r.checkInDate >= start && r.checkInDate <= end);
  const byMonth = new Map<string, { reservations: number; nights: number; revenue: number }>();
  for (const r of filtered) {
    const month = r.checkInDate.slice(0, 7);
    const cur = byMonth.get(month) ?? { reservations: 0, nights: 0, revenue: 0 };
    byMonth.set(month, {
      reservations: cur.reservations + 1,
      nights: cur.nights + r.computedNights,
      revenue: cur.revenue + r.nightlyRate * r.computedNights,
    });
  }
  return Array.from(byMonth.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([month, data]) => ({ month, ...data, adr: data.nights > 0 ? data.revenue / data.nights : 0 }));
}

const DOW_LABELS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

function computeDayOfWeek(reservations: PropertyReservationRecord[]) {
  const counts = new Array<number>(7).fill(0);
  for (const r of active(reservations)) {
    counts[new Date(r.checkInDate + 'T12:00:00').getDay()]++;
  }
  const peak = Math.max(...counts, 1);
  return DOW_LABELS.map((label, i) => ({ label, count: counts[i], pct: counts[i] / peak }));
}

type StatusResult = 'strong' | 'normal' | 'attention' | 'insufficient';

function computeStatus(reservationsCount: number, occupancyRate: number, cancelledCount: number): StatusResult {
  if (reservationsCount < 5) return 'insufficient';
  const cancelRate = reservationsCount > 0 ? cancelledCount / reservationsCount : 0;
  if (occupancyRate >= 70 && cancelRate < 0.15) return 'strong';
  if (occupancyRate >= 40 && cancelRate < 0.30) return 'normal';
  return 'attention';
}

const STATUS_CONFIG: Record<StatusResult, { label: string; color: string; bg: string }> = {
  strong: { label: 'Fortes performances', color: '#15803D', bg: '#DEF7E6' },
  normal: { label: 'Performances normales', color: '#B45309', bg: '#FDEBC8' },
  attention: { label: 'Attention requise', color: '#B91C1C', bg: '#FAD9D9' },
  insufficient: { label: 'Données insuffisantes', color: AmkouyColors.textFaint, bg: AmkouyColors.hairline },
};

// ── Component ─────────────────────────────────────────────────────────────────

type Props = { propertyId: string; propertyName: string; baseNightlyRate: number | null };

export function PropertyIntelligencePanel({ propertyId, propertyName, baseNightlyRate }: Props) {
  const [period, setPeriod] = useState<Period>('12M');
  const [openInfo, setOpenInfo] = useState<string | null>(null);
  const range = makeRange(PERIOD_DAYS[period]);

  const { data: perf, isLoading: perfLoading } = usePropertyPerformanceReport(propertyId, range);
  const { data: history = [], isLoading: histLoading } = usePropertyReservationHistory(propertyId);

  const isLoading = perfLoading || histLoading;

  const pricing = computePricingStats(history);
  const leadTime = computeLeadTimeStats(history);
  const avgStay = computeAvgStayFromRaw(history);
  const monthly = computeMonthlyBreakdown(history, range);
  const dow = computeDayOfWeek(history);
  const status = perf
    ? computeStatus(perf.reservationsCount, perf.occupancyRate, perf.cancelledCount)
    : 'insufficient';
  const statusConf = STATUS_CONFIG[status];

  return (
    <View style={styles.root}>
      {/* Header */}
      <Text style={styles.panelTitle}>Intelligence · {propertyName}</Text>
      <Text style={styles.panelNote}>Lecture seule — source : Core AMKOUY</Text>

      {/* Period selector */}
      <View style={styles.periodRow}>
        {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
          <Pressable
            key={p}
            onPress={() => setPeriod(p)}
            style={[styles.periodBtn, period === p && styles.periodBtnActive]}>
            <Text style={[styles.periodBtnText, period === p && styles.periodBtnTextActive]}>
              {p}
            </Text>
          </Pressable>
        ))}
      </View>

      {isLoading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="small" color={AmkouyColors.primary} />
          <Text style={styles.loadingText}>Chargement des données…</Text>
        </View>
      ) : (
        <>
          {/* Status badge — Change 1: labeled as heuristic with ⓘ tooltip */}
          <View style={styles.statusBadgeRow}>
            <View style={[styles.statusBadge, { backgroundColor: statusConf.bg }]}>
              <Text style={[styles.statusText, { color: statusConf.color }]}>{statusConf.label}</Text>
            </View>
            <Pressable onPress={() => setOpenInfo(openInfo === 'status' ? null : 'status')} hitSlop={8}>
              <Text style={styles.infoIcon}>ⓘ</Text>
            </Pressable>
            <Text style={styles.heuristicNote}>Évaluation indicative</Text>
          </View>
          {openInfo === 'status' && (
            <View style={styles.tooltipBox}>
              <Text style={styles.tooltipText}>
                {'Évaluation basée sur le taux d\'occupation et le taux d\'annulation fournis par Core AMKOUY.\n\n'}
                {'Fortes performances : occupation ≥ 70 % et annulations < 15 %.\n'}
                {'Performances normales : occupation ≥ 40 % et annulations < 30 %.\n'}
                {'Attention requise : en dessous de ces seuils.\n\n'}
                {'Il s\'agit d\'indicateurs AMKOUY Intelligence — une heuristique de présentation, non un fait Core.'}
              </Text>
            </View>
          )}

          {/* ── Section 1: Performance Overview ── */}
          <SectionTitle>Performance — {PERIOD_LABELS[period]}</SectionTitle>
          {perf && perf.reservationsCount > 0 ? (
            <View style={styles.card}>
              <KpiRow label="Revenu net" value={fmtMAD(perf.netRevenue)} />
              <KpiRow label="Profit" value={fmtMAD(perf.profit)} />
              <KpiRow label="ADR" value={perf.adr > 0 ? fmtMAD(perf.adr) : '–'} />
              <KpiRow label="Taux d'occupation" value={fmtPct(perf.occupancyRate)} />
              <KpiRow label="Durée moyenne" value={perf.avgStay > 0 ? `${perf.avgStay.toFixed(1)} nuits` : '–'} />
              <KpiRow label="Réservations" value={`${perf.reservationsCount}`} />
              <KpiRow
                label="Annulations"
                value={`${perf.cancelledCount} (${fmtPct(perf.reservationsCount > 0 ? (perf.cancelledCount / perf.reservationsCount) * 100 : 0)})`}
                last
              />
            </View>
          ) : (
            <View style={styles.card}>
              <Text style={styles.noData}>Aucune donnée sur cette période</Text>
            </View>
          )}

          {/* ── Section 2: Pricing Performance (all-time) ── */}
          <SectionTitle>Tarification (historique complet)</SectionTitle>
          {pricing ? (
            <View style={styles.card}>
              {baseNightlyRate != null && baseNightlyRate > 0 && (
                <KpiRow label="Tarif de base configuré" value={fmtMAD(baseNightlyRate)} />
              )}
              <KpiRow label="Tarif moyen réalisé" value={fmtMAD(pricing.avg)} />
              <KpiRow label="Tarif minimum" value={fmtMAD(pricing.min)} />
              <KpiRow label="Tarif maximum" value={fmtMAD(pricing.max)} />
              {baseNightlyRate != null && baseNightlyRate > 0 && (
                <>
                  <View style={[styles.kpiRow]}>
                    <View style={styles.kpiLabelRow}>
                      <Text style={styles.kpiLabel}>Écart vs tarif de base actuel</Text>
                      <Pressable onPress={() => setOpenInfo(openInfo === 'base-gap' ? null : 'base-gap')} hitSlop={8}>
                        <Text style={styles.infoIcon}>ⓘ</Text>
                      </Pressable>
                    </View>
                    <Text style={styles.kpiValue}>{`${pricing.avg >= baseNightlyRate ? '+' : ''}${fmtPct(((pricing.avg - baseNightlyRate) / baseNightlyRate) * 100)}`}</Text>
                  </View>
                  {openInfo === 'base-gap' && (
                    <View style={styles.tooltipBox}>
                      <Text style={styles.tooltipText}>
                        {'Comparaison entre les tarifs historiques réservés et le tarif de base actuellement configuré. Core ne conserve pas encore l\'historique des changements de tarif.'}
                      </Text>
                    </View>
                  )}
                </>
              )}
              {baseNightlyRate == null && <KpiRow label="Réservations analysées" value={`${pricing.count}`} last />}
            </View>
          ) : (
            <View style={styles.card}>
              <Text style={styles.noData}>Données insuffisantes</Text>
            </View>
          )}

          {/* ── Section 3: Booking Behavior ── */}
          <SectionTitle>Comportement de réservation</SectionTitle>
          <View style={styles.card}>
            {leadTime ? (
              <>
                <KpiRow label="Délai moyen (création → arrivée)" value={`${leadTime.avg} jours`} />
                <KpiRow label="Délai médian" value={`${leadTime.median} jours`} last={!avgStay} />
              </>
            ) : (
              <KpiRow label="Délai de réservation" value="Données insuffisantes" />
            )}
            {avgStay != null ? (
              <KpiRow label="Durée de séjour moyenne" value={`${avgStay} nuits`} last />
            ) : null}
            {!leadTime && !avgStay && (
              <Text style={styles.noData}>Données insuffisantes (min. 3 réservations)</Text>
            )}
          </View>

          {/* ── Section 4: Monthly Breakdown ── */}
          <SectionTitle>Répartition mensuelle — {PERIOD_LABELS[period]}</SectionTitle>
          {monthly.length > 0 ? (
            <View style={styles.card}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableCell, styles.tableCellWide, styles.tableHeaderText]}>Mois</Text>
                <Text style={[styles.tableCell, styles.tableHeaderText]}>Rés.</Text>
                <Text style={[styles.tableCell, styles.tableHeaderText]}>Nuits</Text>
                <Text style={[styles.tableCell, styles.tableCellWide, styles.tableHeaderText]}>Rev. héb.</Text>
              </View>
              {monthly.map((row) => (
                <View key={row.month} style={styles.tableRow}>
                  <Text style={[styles.tableCell, styles.tableCellWide]}>{formatMonth(row.month)}</Text>
                  <Text style={styles.tableCell}>{row.reservations}</Text>
                  <Text style={styles.tableCell}>{row.nights}</Text>
                  <Text style={[styles.tableCell, styles.tableCellWide]}>{fmtMAD(row.revenue)}</Text>
                </View>
              ))}
              <Text style={styles.tableNote}>Tarif réservé × nuits, attribué au mois d'arrivée.</Text>
            </View>
          ) : (
            <View style={styles.card}>
              <Text style={styles.noData}>Aucune réservation sur cette période</Text>
            </View>
          )}

          {/* ── Section 5: Day-of-Week Pattern ── */}
          <SectionTitle>Arrivées par jour de semaine (historique)</SectionTitle>
          <View style={styles.card}>
            {dow.some((d) => d.count > 0) ? (
              dow.map((d) => (
                <View key={d.label} style={styles.dowRow}>
                  <Text style={styles.dowLabel}>{d.label}</Text>
                  <View style={styles.dowBarTrack}>
                    <View style={[styles.dowBarFill, { width: `${Math.round(d.pct * 100)}%` }]} />
                  </View>
                  <Text style={styles.dowCount}>{d.count}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.noData}>Données insuffisantes</Text>
            )}
          </View>

          <Text style={styles.footer}>
            Intelligence AMKOUY · Lecture seule · Données Core uniquement
          </Text>
        </>
      )}
    </View>
  );
}

// ── Small sub-components ───────────────────────────────────────────────────────

function SectionTitle({ children }: { children: ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

function KpiRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.kpiRow, !last && styles.kpiRowBorder]}>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={styles.kpiValue}>{value}</Text>
    </View>
  );
}

const MONTH_FR = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
function formatMonth(ym: string): string {
  const [year, month] = ym.split('-').map(Number);
  return `${MONTH_FR[month - 1]} ${year}`;
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
  },
  panelTitle: {
    ...robotoText(700, 20, { color: AmkouyColors.primary, marginBottom: 2 }),
  },
  panelNote: {
    ...robotoText(400, 11, { color: AmkouyColors.textFaint, marginBottom: 14 }),
  },
  periodRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  periodBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: AmkouyColors.hairline,
  },
  periodBtnActive: {
    backgroundColor: AmkouyColors.primary,
  },
  periodBtnText: {
    ...robotoText(500, 13, { color: AmkouyColors.textFaint }),
  },
  periodBtnTextActive: {
    color: '#fff',
  },
  loadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 20,
  },
  loadingText: {
    ...robotoText(400, 13, { color: AmkouyColors.textFaint }),
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    marginBottom: 16,
  },
  statusText: {
    ...robotoText(600, 13),
  },
  sectionTitle: {
    ...robotoText(600, 14, { color: AmkouyColors.primary, marginTop: 18, marginBottom: 8 }),
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    ...CardShadow,
  },
  kpiRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 9,
  },
  kpiRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: AmkouyColors.border,
  },
  kpiLabel: {
    ...robotoText(400, 13, { color: AmkouyColors.textMuted, flex: 1 }),
  },
  kpiValue: {
    ...robotoText(600, 13, { color: AmkouyColors.primary }),
  },
  noData: {
    ...robotoText(400, 13, { color: AmkouyColors.textFaint, fontStyle: 'italic', paddingVertical: 8 }),
  },
  tableHeader: {
    flexDirection: 'row',
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: AmkouyColors.border,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: AmkouyColors.border,
  },
  tableCell: {
    ...robotoText(400, 12, { color: AmkouyColors.textMuted, flex: 1, textAlign: 'right' }),
  },
  tableCellWide: {
    flex: 2,
    textAlign: 'left',
  },
  tableHeaderText: {
    ...robotoText(600, 11, { color: AmkouyColors.textFaint }),
  },
  tableNote: {
    ...robotoText(400, 10, { color: AmkouyColors.textFaint, marginTop: 6, fontStyle: 'italic' }),
  },
  dowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    gap: 8,
  },
  dowLabel: {
    ...robotoText(500, 12, { color: AmkouyColors.textMuted, width: 28 }),
  },
  dowBarTrack: {
    flex: 1,
    height: 10,
    backgroundColor: AmkouyColors.hairline,
    borderRadius: 5,
    overflow: 'hidden',
  },
  dowBarFill: {
    height: '100%',
    backgroundColor: AmkouyColors.primaryContainer,
    borderRadius: 5,
  },
  dowCount: {
    ...robotoText(500, 12, { color: AmkouyColors.primary, width: 24, textAlign: 'right' }),
  },
  footer: {
    ...robotoText(400, 10, { color: AmkouyColors.textFainter, textAlign: 'center', marginTop: 24 }),
  },
  statusBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  heuristicNote: {
    ...robotoText(400, 11, { color: AmkouyColors.textFaint, fontStyle: 'italic' }),
  },
  infoIcon: {
    ...robotoText(400, 14, { color: AmkouyColors.textMuted }),
  },
  tooltipBox: {
    marginTop: 6,
    marginBottom: 4,
    padding: 10,
    backgroundColor: AmkouyColors.hairline,
    borderRadius: 8,
  },
  tooltipText: {
    ...robotoText(400, 12, { color: AmkouyColors.textMuted }),
    lineHeight: 18,
  },
  kpiLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
});

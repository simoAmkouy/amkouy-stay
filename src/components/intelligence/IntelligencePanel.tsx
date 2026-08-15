import { differenceInCalendarDays } from 'date-fns';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AmkouyColors, CardShadow } from '@/constants/amkouy-theme';
import { canAccess } from '@/constants/permissions';
import { robotoText } from '@/constants/typography';
import { useAuth } from '@/hooks/use-auth';
import { usePortfolioReport } from '@/hooks/use-reports';
import { DateRange } from '@/utils/date-range';

interface Props {
  range: DateRange;
}

// ─── Local MAD formatter ──────────────────────────────────────────────────────
// Scoped to Intelligence only — does NOT modify the shared formatMAD utility.
// Caps at 2 decimal places; uses fr-FR locale (space thousands, comma decimal).
// Examples: 766 → "MAD 766", 716.581 → "MAD 716,58", 22214 → "MAD 22 214"
function fmtMAD(value: number): string {
  return `MAD ${value.toLocaleString('fr-FR', { maximumFractionDigits: 2 })}`;
}

// ─── Tooltip content ─────────────────────────────────────────────────────────

const KPIS: {
  key: string;
  label: string;
  name: string;
  formula: string;
  why: string;
}[] = [
  {
    key: 'adr',
    label: 'ADR',
    name: 'Revenu Moyen par Nuit',
    formula: 'Revenus hébergement ÷ nuits occupées',
    why: "Mesure la valeur unitaire de chaque nuit vendue. Un ADR faible peut indiquer une sous-tarification ou une forte dépendance aux promotions.",
  },
  {
    key: 'occupancy',
    label: "Taux d'Occupation",
    name: "Taux d'Occupation",
    formula: 'Nuits occupées ÷ nuits disponibles × 100',
    why: "Indique quelle proportion du parc génère de la valeur. En dessous de 60 %, le potentiel de revenus n'est pas pleinement exploité.",
  },
  {
    key: 'revpan',
    label: 'RevPAN estimé',
    name: 'Revenu par Appartement par Nuit',
    formula: 'Revenus nets ÷ (jours de période × biens actifs)',
    why: "Mesure la performance globale du portefeuille. Estimé : les nuits disponibles exactes par bien ne sont pas modélisées — utiliser comme indicateur de tendance.",
  },
  {
    key: 'profit',
    label: 'Profit AMKOUY',
    name: 'Profit Net AMKOUY',
    formula: 'Revenus nets − charges propriétaires − dépenses',
    why: 'Résultat net de la société après tous les reversements et charges. Indicateur clé de santé financière.',
  },
  {
    key: 'concierge',
    label: 'Rev. Conciergerie',
    name: 'Revenus Conciergerie',
    formula: 'Somme des services conciergerie facturés sur la période',
    why: "Source de revenus complémentaire à l'hébergement. Une conciergerie active diversifie les revenus et améliore l'expérience client.",
  },
];

// ─── Public entry point ───────────────────────────────────────────────────────

export function IntelligencePanel({ range }: Props) {
  const { profile } = useAuth();
  if (!canAccess(profile?.role, 'intelligence')) return null;
  return <IntelligenceContent range={range} />;
}

// ─── Main content ─────────────────────────────────────────────────────────────

function IntelligenceContent({ range }: Props) {
  const { data: report, isLoading } = usePortfolioReport(range, null);
  const [openTooltip, setOpenTooltip] = useState<string | null>(null);

  const daysInRange = Math.max(1, differenceInCalendarDays(range.end, range.start) + 1);
  const s = report?.summary;

  // Data-sufficiency guards — used to distinguish "no data" from "poor performance"
  // ADR requires occupied nights as its denominator; without them the value is 0 but not meaningful.
  const hasNightsData = (s?.totalNights ?? 0) > 0;
  // Occupancy, RevPAN, and the cancellation rate all require at least one reservation.
  const hasReservationData = (s?.totalReservations ?? 0) > 0;

  const revPAN =
    s && hasReservationData && s.activeProperties > 0
      ? s.totalNetRevenue / (daysInRange * s.activeProperties)
      : 0;

  // Returns the formatted display string for a KPI card.
  // "Données insuffisantes" is only shown when the underlying denominator is zero,
  // making the metric undefined — NOT when the metric is genuinely zero but meaningful
  // (e.g. zero profit or zero concierge revenue are valid values).
  const kpiDisplay = (key: string): string => {
    if (!s) return '—';
    switch (key) {
      case 'adr':
        return hasNightsData ? fmtMAD(s.adr) : 'Données insuffisantes';
      case 'occupancy':
        return hasReservationData ? `${s.occupancyRate.toFixed(1)} %` : 'Données insuffisantes';
      case 'revpan':
        return hasReservationData ? fmtMAD(revPAN) : 'Données insuffisantes';
      case 'profit':
        return fmtMAD(s.totalProfit); // zero profit is a meaningful value
      case 'concierge':
        return fmtMAD(s.totalConciergeRevenue); // zero concierge is a meaningful value
      default:
        return '—';
    }
  };

  // Whether a KPI's display value is in "insufficient data" state (used for styling).
  const kpiInsufficient = (key: string): boolean => {
    if (!s) return false;
    if (key === 'adr' || key === 'revpan') return !hasNightsData;
    if (key === 'occupancy') return !hasReservationData;
    return false;
  };

  // Analyse tarifaire — read-only threshold alerts.
  // Each alert is only emitted when its underlying metric has a valid denominator,
  // to avoid misclassifying a "no data" period as genuinely poor performance.
  const alerts: { key: string; text: string; warning: boolean }[] = [];
  if (s) {
    // Occupancy alert: only when Core reported at least one reservation (valid denominator).
    if (hasReservationData && s.occupancyRate < 60) {
      alerts.push({
        key: 'low_occ',
        text: `Taux d'occupation faible (${s.occupancyRate.toFixed(1)} %). Analyse tarifaire recommandée : vérifiez vos prix minimum et vos fenêtres de disponibilité.`,
        warning: true,
      });
    }
    // ADR alert: only when Core reported at least one occupied night (valid denominator).
    if (hasNightsData && s.adr < 300) {
      alerts.push({
        key: 'low_adr',
        text: `ADR bas (${fmtMAD(s.adr)}). Revoyez vos tarifs de base ou vos politiques de remise sur les longs séjours.`,
        warning: true,
      });
    }
    // Cancellation alert: only when there is at least one reservation as denominator.
    // Shows the raw counts alongside the rate for transparency.
    if (hasReservationData && s.cancelledReservations / s.totalReservations > 0.2) {
      alerts.push({
        key: 'cancel_rate',
        text: `Taux d'annulation élevé (${((s.cancelledReservations / s.totalReservations) * 100).toFixed(0)} %). ${s.cancelledReservations} annulation${s.cancelledReservations > 1 ? 's' : ''} sur ${s.totalReservations} réservation${s.totalReservations > 1 ? 's' : ''}.`,
        warning: true,
      });
    }
    if (s.totalConciergeRevenue > 0) {
      alerts.push({
        key: 'concierge_active',
        text: `Conciergerie active : ${fmtMAD(s.totalConciergeRevenue)} générés sur la période.`,
        warning: false,
      });
    }
  }

  // getPortfolioReport already returns properties sorted by revenue desc (reports.ts:256).
  const topProperties = (report?.properties ?? []).slice(0, 5);

  return (
    <>
      <Text style={styles.sectionTitle}>AMKOUY Intelligence</Text>

      {/* ── KPI Cards ── */}
      <View style={styles.kpiGrid}>
        {KPIS.map((kpi) => {
          const display = isLoading ? '—' : kpiDisplay(kpi.key);
          const insufficient = !isLoading && kpiInsufficient(kpi.key);
          const isOpen = openTooltip === kpi.key;
          return (
            <View key={kpi.key} style={styles.kpiCard}>
              <View style={styles.kpiLabelRow}>
                <Text style={styles.kpiLabel} numberOfLines={1}>{kpi.label}</Text>
                <Pressable
                  onPress={() => setOpenTooltip(isOpen ? null : kpi.key)}
                  hitSlop={10}
                  style={styles.infoBtn}
                >
                  <Text style={styles.infoIcon}>ⓘ</Text>
                </Pressable>
              </View>
              <Text style={[styles.kpiValue, insufficient && styles.kpiValueInsufficient]}>
                {display}
              </Text>
              {isOpen && (
                <View style={styles.tooltipBox}>
                  <Text style={styles.tooltipName}>{kpi.name}</Text>
                  <Text style={styles.tooltipLine}>Formule : {kpi.formula}</Text>
                  <Text style={styles.tooltipLine}>{kpi.why}</Text>
                </View>
              )}
            </View>
          );
        })}
      </View>

      {/* ── Analyse tarifaire alerts ── */}
      {alerts.length > 0 && (
        <View style={styles.alertsWrap}>
          {alerts.map((a) => (
            <View
              key={a.key}
              style={[styles.alertRow, a.warning ? styles.alertWarning : styles.alertInfo]}
            >
              <Text style={styles.alertIcon}>{a.warning ? '⚠' : 'ℹ'}</Text>
              <Text style={[styles.alertText, a.warning ? styles.alertTextWarning : styles.alertTextInfo]}>
                {a.text}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* ── Business Intelligence ── */}
      <Text style={styles.subTitle}>Business Intelligence</Text>

      <View style={styles.biCard}>
        <Text style={styles.biSection}>Hébergement</Text>
        <BiRow label="Revenus nets" value={isLoading ? '—' : fmtMAD(s?.totalNetRevenue ?? 0)} />
        <BiRow label="ADR" value={isLoading ? '—' : (hasNightsData ? `${fmtMAD(s?.adr ?? 0)} / nuit` : 'Données insuffisantes')} />
        <BiRow label="Durée moyenne de séjour" value={isLoading ? '—' : (hasReservationData ? `${(s?.avgStay ?? 0).toFixed(1)} nuits` : 'Données insuffisantes')} />
        <BiRow label="Nuits facturées" value={isLoading ? '—' : `${s?.totalNights ?? 0}`} />
        <BiRow label="Réservations" value={isLoading ? '—' : `${s?.totalReservations ?? 0}`} />
        <BiRow label="Annulations" value={isLoading ? '—' : `${s?.cancelledReservations ?? 0}`} last />
      </View>

      <View style={styles.biCard}>
        <Text style={styles.biSection}>Conciergerie</Text>
        <BiRow label="Revenus conciergerie" value={isLoading ? '—' : fmtMAD(s?.totalConciergeRevenue ?? 0)} last />
      </View>

      <View style={styles.biCard}>
        <Text style={styles.biSection}>Total</Text>
        <BiRow label="Profit AMKOUY" value={isLoading ? '—' : fmtMAD(s?.totalProfit ?? 0)} highlight />
        <BiRow label="Taux d'occupation" value={isLoading ? '—' : (hasReservationData ? `${(s?.occupancyRate ?? 0).toFixed(1)} %` : 'Données insuffisantes')} />
        <BiRow label="Biens actifs" value={isLoading ? '—' : `${s?.activeProperties ?? 0}`} last />
      </View>

      {/* ── Property ranking ── */}
      {topProperties.length > 0 && (
        <>
          <Text style={styles.subTitle}>Classement Biens — Revenus</Text>
          <View style={styles.rankCard}>
            {topProperties.map((p, i) => (
              <View
                key={p.propertyId}
                style={[styles.rankRow, i < topProperties.length - 1 && styles.rankRowBorder]}
              >
                <Text style={styles.rankPos}>{i + 1}</Text>
                <View style={styles.rankInfo}>
                  <Text style={styles.rankName} numberOfLines={1}>{p.propertyName}</Text>
                  <Text style={styles.rankSub}>
                    {p.city ?? '—'} · {p.reservationsCount} rés. · Occ. {p.occupancyRate.toFixed(0)} %
                  </Text>
                </View>
                <Text style={styles.rankValue}>{fmtMAD(p.revenue)}</Text>
              </View>
            ))}
          </View>
        </>
      )}

      {/* Bottom spacer */}
      <View style={{ height: 20 }} />
    </>
  );
}

// ─── Reusable row ─────────────────────────────────────────────────────────────

function BiRow({
  label,
  value,
  highlight,
  last,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  last?: boolean;
}) {
  return (
    <View style={[styles.biRow, !last && styles.biRowBorder]}>
      <Text style={styles.biLabel}>{label}</Text>
      <Text style={[styles.biValue, highlight && styles.biValueHighlight]}>{value}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  sectionTitle: {
    ...robotoText(700, 11, {
      color: AmkouyColors.textFaint,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      paddingHorizontal: 22,
      marginTop: 28,
      marginBottom: 12,
    }),
  },
  subTitle: {
    ...robotoText(600, 12, {
      color: AmkouyColors.textFaint,
      letterSpacing: 0.5,
      textTransform: 'uppercase',
      paddingHorizontal: 22,
      marginTop: 20,
      marginBottom: 10,
    }),
  },

  // KPI grid
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 14,
    gap: 8,
  },
  kpiCard: {
    width: '46%',
    flexGrow: 1,
    backgroundColor: AmkouyColors.card,
    borderRadius: 13,
    padding: 12,
    borderWidth: 1,
    borderColor: AmkouyColors.hairline,
    ...CardShadow,
  },
  kpiLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  kpiLabel: {
    ...robotoText(500, 10, { color: AmkouyColors.textFaint, flex: 1 }),
  },
  infoBtn: {
    marginLeft: 4,
  },
  infoIcon: {
    ...robotoText(400, 13, { color: AmkouyColors.primary }),
  },
  kpiValue: {
    ...robotoText(700, 16, { color: AmkouyColors.text }),
  },
  kpiValueInsufficient: {
    // Visually de-emphasised — not an error, just "not enough data yet"
    ...robotoText(400, 11, { color: AmkouyColors.textFaint, fontStyle: 'italic' }),
  },
  tooltipBox: {
    marginTop: 8,
    backgroundColor: '#F0F4FF',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: '#C7D5F8',
  },
  tooltipName: {
    ...robotoText(600, 10, { color: AmkouyColors.primary, marginBottom: 3 }),
  },
  tooltipLine: {
    ...robotoText(400, 9.5, { color: AmkouyColors.text, marginTop: 2, lineHeight: 13 }),
  },

  // Alerts
  alertsWrap: {
    paddingHorizontal: 14,
    marginTop: 10,
    gap: 6,
  },
  alertRow: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 10,
    alignItems: 'flex-start',
    gap: 8,
  },
  alertWarning: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  alertInfo: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  alertIcon: {
    ...robotoText(500, 13, { color: AmkouyColors.text, marginTop: 1 }),
  },
  alertText: {
    flex: 1,
    ...robotoText(400, 11, { lineHeight: 15 }),
  },
  alertTextWarning: {
    color: '#92400E',
  },
  alertTextInfo: {
    color: '#1E40AF',
  },

  // Business Intelligence card
  biCard: {
    marginHorizontal: 14,
    marginBottom: 8,
    backgroundColor: AmkouyColors.card,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: AmkouyColors.hairline,
    overflow: 'hidden',
    ...CardShadow,
  },
  biSection: {
    ...robotoText(600, 11, {
      color: AmkouyColors.primary,
      paddingHorizontal: 14,
      paddingVertical: 9,
      backgroundColor: '#F4F7FF',
      borderBottomWidth: 1,
      borderBottomColor: AmkouyColors.hairline,
    }),
  },
  biRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  biRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: AmkouyColors.hairline,
  },
  biLabel: {
    ...robotoText(400, 11.5, { color: AmkouyColors.textFaint, flex: 1 }),
  },
  biValue: {
    ...robotoText(600, 12, { color: AmkouyColors.text }),
  },
  biValueHighlight: {
    color: AmkouyColors.secondary,
  },

  // Property ranking
  rankCard: {
    marginHorizontal: 14,
    backgroundColor: AmkouyColors.card,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: AmkouyColors.hairline,
    overflow: 'hidden',
    ...CardShadow,
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  rankRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: AmkouyColors.hairline,
  },
  rankPos: {
    ...robotoText(700, 13, { color: AmkouyColors.textFaint, width: 18, textAlign: 'center' }),
  },
  rankInfo: {
    flex: 1,
  },
  rankName: {
    ...robotoText(600, 12, { color: AmkouyColors.text }),
  },
  rankSub: {
    ...robotoText(400, 10, { color: AmkouyColors.textFaint, marginTop: 2 }),
  },
  rankValue: {
    ...robotoText(700, 12, { color: AmkouyColors.secondary }),
  },
});

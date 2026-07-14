import { router } from 'expo-router';
import { useMemo } from 'react';
import { DimensionValue, Pressable, StyleSheet, Text, View } from 'react-native';

import { AccessGuard } from '@/components/amkouy/access-guard';
import { Avatar } from '@/components/amkouy/avatar';
import { BarChart } from '@/components/amkouy/bar-chart';
import { Card } from '@/components/amkouy/card';
import { ErrorState } from '@/components/amkouy/error-state';
import { Icon } from '@/components/icon';
import { LoadingState } from '@/components/amkouy/loading-state';
import { Screen } from '@/components/amkouy/screen';
import { ScreenHeader } from '@/components/amkouy/screen-header';
import { AmkouyColors } from '@/constants/amkouy-theme';
import { robotoText } from '@/constants/typography';
import { useExpenseCategoryBreakdown, useExpenses } from '@/hooks/use-expenses';
import { useOwnerPayments } from '@/hooks/use-owner-payments';
import { usePortfolioSummary, usePortfolioTimeline } from '@/hooks/use-reports';
import { computeDisplayStatus, DisplayStatus } from '@/lib/queries/owner-payments';
import { PortfolioTimelinePoint } from '@/lib/queries/reports';
import { EXPENSE_CATEGORY_OPTIONS } from '@/lib/validation/expense';
import { DISPLAY_STATUS_OPTIONS } from '@/lib/validation/owner-payment';
import { computeRangeForFilter, formatRangeLabel, toDateOnlyString } from '@/utils/date-range';
import { formatMAD } from '@/utils/format';

/** No business rule anywhere in the app defines "high value" for an expense — this threshold is
 * a documented, adjustable placeholder (not a fake/invented data point; the *comparison* against
 * real expense amounts is real, only the cutoff itself is a judgment call). Revisit if Finance
 * wants this configurable per-property or per-category. */
const HIGH_VALUE_EXPENSE_THRESHOLD_MAD = 5000;

const CATEGORY_LABEL = Object.fromEntries(EXPENSE_CATEGORY_OPTIONS.map((o) => [o.value, o.label]));
const CATEGORY_COLORS = ['#C9A84C', '#1E3A6E', '#B45309', '#15803D', '#6D4FC9', '#B91C1C', '#0C5C8A', '#8a6d1c'];

const STATUS_LABEL = Object.fromEntries(DISPLAY_STATUS_OPTIONS.map((o) => [o.value, o.label]));
const STATUS_COLOR: Record<DisplayStatus, { bg: string; text: string }> = {
  upcoming: { bg: '#E3E9F4', text: '#1E3A6E' },
  due: { bg: '#F8EFD4', text: '#8a6d1c' },
  overdue: { bg: '#FAD9D9', text: '#B91C1C' },
  approved: { bg: '#E4E9FA', text: '#3730A3' },
  paid: { bg: '#DEF7E6', text: '#15803D' },
  cancelled: { bg: '#EEF0F4', text: '#5A5E66' },
};

function monthLabel(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { month: 'short' });
}

function seriesToBars(points: PortfolioTimelinePoint[], key: keyof PortfolioTimelinePoint, color: string) {
  const values = points.map((p) => Number(p[key]));
  const max = Math.max(1, ...values);
  return points.map((p) => ({
    m: monthLabel(p.month),
    h: `${Math.max(4, Math.round((Number(p[key]) / max) * 100))}%`,
    color,
  }));
}

export default function FinanceScreen() {
  return (
    <AccessGuard resource="finance">
      <FinanceContent />
    </AccessGuard>
  );
}

function FinanceContent() {
  const thisMonthRange = useMemo(() => computeRangeForFilter('this_month'), []);
  const sixMonthsRange = useMemo(() => computeRangeForFilter('this_year'), []);

  const { data: summary, isLoading: summaryLoading, isError: summaryError } = usePortfolioSummary(thisMonthRange);
  const { data: timeline, isError: timelineError } = usePortfolioTimeline(sixMonthsRange);
  const { data: expenseBreakdown, isError: expenseBreakdownError } = useExpenseCategoryBreakdown(thisMonthRange);
  const { data: ownerPayments, isError: ownerPaymentsError } = useOwnerPayments();
  const { data: expenses, isError: expensesError } = useExpenses();
  // CB-07 (Launch Readiness Audit): these 4 queries used to have no error check at all, so a
  // failed fetch silently rendered every dependent tile as "0"/"empty" — indistinguishable from a
  // genuinely quiet day. They now fold into the same full-screen error gate as the portfolio
  // summary below, rather than each card silently lying about its own data.
  const hasLoadError = summaryError || timelineError || expenseBreakdownError || ownerPaymentsError || expensesError;

  const recentPoints = (timeline ?? []).slice(-6);
  const revenueGrowth = useMemo(() => {
    if (recentPoints.length < 2) return null;
    const prev = recentPoints[recentPoints.length - 2].revenue;
    const last = recentPoints[recentPoints.length - 1].revenue;
    if (prev <= 0) return null;
    return ((last - prev) / prev) * 100;
  }, [recentPoints]);

  const totalExpensesForBreakdown = (expenseBreakdown ?? []).reduce((sum, e) => sum + e.total, 0);

  const pendingOwnerPayments = (ownerPayments ?? [])
    .filter((p) => p.status !== 'paid' && p.status !== 'cancelled')
    .sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? ''))
    .slice(0, 5);
  const pendingCount = (ownerPayments ?? []).filter((p) => p.status === 'pending' || p.status === 'approved').length;

  // Payments (Phase 3): due-date buckets computed the same way as the Operations Center's Owner
  // Payments panel (`computeOwnerPaymentsPanel`) — not a second engine, just the same read applied
  // to a monthly bucket that panel doesn't have.
  const paymentsBuckets = useMemo(() => {
    const today = new Date();
    const todayStr = toDateOnlyString(today);
    const weekEnd = toDateOnlyString(new Date(today.getTime() + 7 * 86_400_000));
    const monthEnd = toDateOnlyString(new Date(today.getFullYear(), today.getMonth() + 1, 0));
    const active = (ownerPayments ?? []).filter((p) => p.status !== 'paid' && p.status !== 'cancelled');
    return {
      dueThisWeek: active.filter((p) => p.due_date && p.due_date >= todayStr && p.due_date <= weekEnd),
      dueThisMonth: active.filter((p) => p.due_date && p.due_date >= todayStr && p.due_date <= monthEnd),
      overdue: active.filter((p) => computeDisplayStatus(p) === 'overdue'),
      approvedUnpaid: (ownerPayments ?? []).filter((p) => p.status === 'approved' || p.status === 'processing'),
    };
  }, [ownerPayments]);

  // Owner Finance (Phase 3): "Awaiting Settlement" / "Paid This Month" are read off the distinct
  // owners behind the same payment rows above — no separate settlement-cadence engine exists (a
  // contract's payout_schedule isn't tracked against "has a payment been generated yet" anywhere),
  // so this reflects payments that already exist, not a gap-detection of missing ones. See the
  // mission report's Bugs Found/Recommendations for that distinction.
  const ownerFinance = useMemo(() => {
    const today = new Date();
    const monthStart = toDateOnlyString(new Date(today.getFullYear(), today.getMonth(), 1));
    const settlementQueue = (ownerPayments ?? []).filter((p) => p.status === 'pending' || p.status === 'approved' || p.status === 'processing');
    const paidThisMonth = (ownerPayments ?? []).filter((p) => p.status === 'paid' && p.paid_at && toDateOnlyString(new Date(p.paid_at)) >= monthStart);
    return {
      settlementQueue,
      ownersAwaitingSettlement: new Set(settlementQueue.map((p) => p.owner_id)).size,
      ownersPaidThisMonth: new Set(paidThisMonth.map((p) => p.owner_id)).size,
    };
  }, [ownerPayments]);

  // Expenses (Phase 3): "Missing Category" is not implemented — `expenses.category` is a NOT NULL
  // column (enforced at insert), so no expense can ever exist without one. Documented, not faked.
  const expensesMissingReceipt = (expenses ?? []).filter((e) => !e.receipt_url);
  const highValueExpenses = (expenses ?? [])
    .filter((e) => e.amount >= HIGH_VALUE_EXPENSE_THRESHOLD_MAD)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  if (summaryLoading) {
    return (
      <Screen>
        <ScreenHeader title="Finance" subtitle="Vue consolidée" showBack fallbackHref="/more" />
        <LoadingState label="Chargement des données financières…" />
      </Screen>
    );
  }
  if (hasLoadError || !summary) {
    return (
      <Screen>
        <ScreenHeader title="Finance" subtitle="Vue consolidée" showBack fallbackHref="/more" />
        <ErrorState message="Impossible de charger les données financières." />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader title="Finance" subtitle={`Vue consolidée · ${formatRangeLabel(thisMonthRange)}`} showBack fallbackHref="/more" />

      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, styles.summaryRevenue]}>
          <Text style={styles.summaryLabelDark}>Revenus</Text>
          <Text style={styles.summaryValueDark}>{formatMAD(summary.totalRevenue + summary.totalConciergeRevenue)}</Text>
        </View>
        <View style={[styles.summaryCard, styles.summaryExpenses]}>
          <Text style={styles.summaryLabelLight}>Dépenses</Text>
          <Text style={[styles.summaryValueLight, { color: AmkouyColors.error }]}>{formatMAD(summary.totalExpenses)}</Text>
        </View>
        <View style={[styles.summaryCard, styles.summaryProfit]}>
          <Text style={[styles.summaryLabelLight, { color: '#8a6d1c' }]}>Marge brute</Text>
          <Text style={[styles.summaryValueLight, { color: AmkouyColors.secondary }]}>{formatMAD(summary.totalProfit)}</Text>
        </View>
      </View>

      {/* Financial Truth Remediation, Phase 4: refunds now visibly reduce Revenue → Net Revenue,
          which is what Marge brute above is actually computed from. */}
      <View style={styles.miniKpiRow}>
        <View style={styles.miniKpiTile}>
          <Text style={[styles.miniKpiValue, { color: AmkouyColors.error }]}>- {formatMAD(summary.totalRefunds)}</Text>
          <Text style={styles.miniKpiLabel}>Remboursements</Text>
        </View>
        <View style={styles.miniKpiTile}>
          <Text style={styles.miniKpiValue}>{formatMAD(summary.totalNetRevenue + summary.totalConciergeRevenue)}</Text>
          <Text style={styles.miniKpiLabel}>Revenu net (après remboursements)</Text>
        </View>
      </View>

      <Card style={styles.chartCard}>
        <View style={styles.chartHeader}>
          <Text style={styles.chartTitle}>Revenus — 6 mois</Text>
          {revenueGrowth !== null && (
            <Text style={[styles.chartGrowth, revenueGrowth < 0 && { color: AmkouyColors.error }]}>
              {revenueGrowth >= 0 ? '+' : ''}
              {revenueGrowth.toFixed(1)}%
            </Text>
          )}
        </View>
        <View style={styles.chartWrap}>
          <BarChart data={seriesToBars(recentPoints, 'revenue', AmkouyColors.primary)} />
        </View>
      </Card>

      <Card style={styles.chartCard}>
        <Text style={styles.expenseTitle}>Répartition des dépenses</Text>
        {(expenseBreakdown ?? []).length === 0 ? (
          <Text style={styles.expenseLabel}>Aucune dépense ce mois-ci.</Text>
        ) : (
          (expenseBreakdown ?? []).map((expense, index) => (
            <View key={expense.category} style={styles.expenseItem}>
              <View style={styles.expenseRow}>
                <Text style={styles.expenseLabel}>{CATEGORY_LABEL[expense.category] ?? expense.category}</Text>
                <Text style={styles.expenseAmount}>{formatMAD(expense.total)}</Text>
              </View>
              <View style={styles.expenseTrack}>
                <View
                  style={[
                    styles.expenseFill,
                    {
                      width: `${totalExpensesForBreakdown > 0 ? Math.round((expense.total / totalExpensesForBreakdown) * 100) : 0}%` as DimensionValue,
                      backgroundColor: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
                    },
                  ]}
                />
              </View>
            </View>
          ))
        )}
      </Card>

      <Card style={styles.chartCard}>
        <View style={styles.chartHeader}>
          <Text style={styles.chartTitle}>Paiements propriétaires</Text>
          <Text style={styles.pendingText}>{pendingCount} en attente</Text>
        </View>
        {pendingOwnerPayments.length === 0 ? (
          <Text style={styles.expenseLabel}>Aucun versement en attente.</Text>
        ) : (
          pendingOwnerPayments.map((payment) => {
            const displayStatus = computeDisplayStatus(payment);
            const colors = STATUS_COLOR[displayStatus];
            const name = payment.owner?.full_name ?? '—';
            const initials = name
              .split(' ')
              .map((w) => w[0])
              .slice(0, 2)
              .join('')
              .toUpperCase();
            return (
              <View key={payment.id} style={styles.paymentRow}>
                <Avatar initials={initials} size={34} bg={AmkouyColors.hairline} color={AmkouyColors.primaryContainer} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.paymentName}>{name}</Text>
                  <Text style={styles.paymentDate}>
                    Échéance {payment.due_date ?? '—'}
                    {payment.is_manual_adjustment ? ' · Ajustement manuel' : ''}
                  </Text>
                </View>
                <Text style={styles.paymentAmount}>{formatMAD(payment.net_amount)}</Text>
                <View style={[styles.paymentBadge, { backgroundColor: colors.bg }]}>
                  <Text style={[styles.paymentBadgeText, { color: colors.text }]}>{STATUS_LABEL[displayStatus] ?? displayStatus}</Text>
                </View>
              </View>
            );
          })
        )}
      </Card>

      <Text style={styles.blockTitle}>Versements — échéances</Text>
      <View style={styles.miniKpiRow}>
        <Pressable style={styles.miniKpiTile} onPress={() => router.push('/more/owner-payments')}>
          <Text style={styles.miniKpiValue}>{paymentsBuckets.dueThisWeek.length}</Text>
          <Text style={styles.miniKpiLabel}>Dus cette semaine</Text>
        </Pressable>
        <Pressable style={styles.miniKpiTile} onPress={() => router.push('/more/owner-payments')}>
          <Text style={styles.miniKpiValue}>{paymentsBuckets.dueThisMonth.length}</Text>
          <Text style={styles.miniKpiLabel}>Dus ce mois</Text>
        </Pressable>
      </View>
      <View style={styles.miniKpiRow}>
        <Pressable style={styles.miniKpiTile} onPress={() => router.push('/more/owner-payments')}>
          <Text style={[styles.miniKpiValue, { color: AmkouyColors.error }]}>{paymentsBuckets.overdue.length}</Text>
          <Text style={styles.miniKpiLabel}>En retard</Text>
        </Pressable>
        <Pressable style={styles.miniKpiTile} onPress={() => router.push('/more/owner-payments')}>
          <Text style={styles.miniKpiValue}>{paymentsBuckets.approvedUnpaid.length}</Text>
          <Text style={styles.miniKpiLabel}>Approuvés, non payés</Text>
        </Pressable>
      </View>

      <Text style={styles.blockTitle}>Règlements propriétaires</Text>
      <View style={styles.miniKpiRow}>
        <Pressable style={styles.miniKpiTile} onPress={() => router.push('/more/owner-payments')}>
          <Text style={styles.miniKpiValue}>{ownerFinance.ownersAwaitingSettlement}</Text>
          <Text style={styles.miniKpiLabel}>Propriétaires en attente</Text>
        </Pressable>
        <Pressable style={styles.miniKpiTile} onPress={() => router.push('/more/owner-payments')}>
          <Text style={[styles.miniKpiValue, { color: AmkouyColors.success }]}>{ownerFinance.ownersPaidThisMonth}</Text>
          <Text style={styles.miniKpiLabel}>Payés ce mois</Text>
        </Pressable>
        <Pressable style={styles.miniKpiTile} onPress={() => router.push('/more/owner-payments')}>
          <Text style={styles.miniKpiValue}>{ownerFinance.settlementQueue.length}</Text>
          <Text style={styles.miniKpiLabel}>File de règlement</Text>
        </Pressable>
      </View>

      <Text style={styles.blockTitle}>Dépenses à vérifier</Text>
      <View style={styles.miniKpiRow}>
        <Pressable style={styles.miniKpiTile} onPress={() => router.push('/more/expenses')}>
          <Text style={styles.miniKpiValue}>{expensesMissingReceipt.length}</Text>
          <Text style={styles.miniKpiLabel}>Reçu manquant</Text>
        </Pressable>
        <Pressable style={styles.miniKpiTile} onPress={() => router.push('/more/expenses')}>
          <Text style={styles.miniKpiValue}>{highValueExpenses.length}</Text>
          <Text style={styles.miniKpiLabel}>Montant élevé (≥ {formatMAD(HIGH_VALUE_EXPENSE_THRESHOLD_MAD)})</Text>
        </Pressable>
      </View>
      {highValueExpenses.length > 0 && (
        <Card style={styles.chartCard}>
          <Text style={styles.expenseTitle}>Dépenses les plus élevées</Text>
          {highValueExpenses.map((expense) => (
            <Pressable key={expense.id} onPress={() => router.push(`/more/expenses/${expense.id}`)}>
              <View style={styles.paymentRow}>
                <Icon name="receipt_long" size={22} color={AmkouyColors.error} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.paymentName}>{expense.description}</Text>
                  <Text style={styles.paymentDate}>
                    {CATEGORY_LABEL[expense.category] ?? expense.category} · {expense.expense_date}
                  </Text>
                </View>
                <Text style={styles.paymentAmount}>{formatMAD(expense.amount)}</Text>
              </View>
            </Pressable>
          ))}
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  summaryRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 22,
  },
  summaryCard: {
    flex: 1,
    borderRadius: 15,
    padding: 15,
  },
  summaryRevenue: {
    backgroundColor: AmkouyColors.primary,
  },
  summaryExpenses: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: AmkouyColors.hairline,
  },
  summaryProfit: {
    backgroundColor: 'rgba(201,168,76,.14)',
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,.3)',
  },
  summaryLabelDark: {
    ...robotoText(400, 11, { color: AmkouyColors.onPrimaryMuted }),
  },
  summaryValueDark: {
    ...robotoText(900, 19, { color: '#fff', marginTop: 5 }),
  },
  summaryLabelLight: {
    ...robotoText(400, 11, { color: AmkouyColors.textFaint }),
  },
  summaryValueLight: {
    ...robotoText(900, 19, { marginTop: 5 }),
  },
  chartCard: {
    marginHorizontal: 22,
    marginTop: 14,
    padding: 16,
  },
  blockTitle: {
    ...robotoText(700, 14, { color: AmkouyColors.primary, paddingHorizontal: 22, marginTop: 22, marginBottom: 8 }),
  },
  miniKpiRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 22,
    marginBottom: 10,
  },
  miniKpiTile: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: AmkouyColors.hairline,
    borderRadius: 13,
    padding: 12,
  },
  miniKpiValue: {
    ...robotoText(900, 18, { color: AmkouyColors.text }),
  },
  miniKpiLabel: {
    ...robotoText(500, 10.5, { color: AmkouyColors.textFaint, marginTop: 2 }),
  },
  chartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  chartTitle: {
    ...robotoText(700, 14, { color: AmkouyColors.primary }),
  },
  chartGrowth: {
    ...robotoText(600, 11, { color: AmkouyColors.success }),
  },
  chartWrap: {
    marginTop: 18,
  },
  expenseTitle: {
    ...robotoText(700, 14, { color: AmkouyColors.primary, marginBottom: 14 }),
  },
  expenseItem: {
    marginBottom: 13,
  },
  expenseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  expenseLabel: {
    ...robotoText(500, 12.5, { color: '#3a3f47' }),
  },
  expenseAmount: {
    ...robotoText(700, 12.5, { color: AmkouyColors.text }),
  },
  expenseTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: AmkouyColors.hairline,
    overflow: 'hidden',
  },
  expenseFill: {
    height: '100%',
    borderRadius: 4,
  },
  pendingText: {
    ...robotoText(600, 11, { color: AmkouyColors.secondary }),
  },
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingVertical: 9,
    borderTopWidth: 1,
    borderTopColor: AmkouyColors.hairline,
  },
  paymentName: {
    ...robotoText(500, 12.5, { color: AmkouyColors.text }),
  },
  paymentDate: {
    ...robotoText(400, 10.5, { color: AmkouyColors.textFainter }),
  },
  paymentAmount: {
    ...robotoText(700, 12.5, { color: AmkouyColors.text }),
  },
  paymentBadge: {
    borderRadius: 7,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  paymentBadgeText: {
    ...robotoText(700, 9.5, {}),
  },
});

import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AccessGuard } from '@/components/amkouy/access-guard';
import { Card } from '@/components/amkouy/card';
import { DateFilterBar } from '@/components/amkouy/date-filter-bar';
import { ErrorState } from '@/components/amkouy/error-state';
import { HeroHeader } from '@/components/amkouy/hero-header';
import { LoadingState } from '@/components/amkouy/loading-state';
import { OccupancyRing } from '@/components/amkouy/occupancy-ring';
import { Screen } from '@/components/amkouy/screen';
import { Icon } from '@/components/icon';
import { AmkouyColors } from '@/constants/amkouy-theme';
import { robotoText } from '@/constants/typography';
import { useAuth } from '@/hooks/use-auth';
import { DateFilterProvider, useDateFilter } from '@/hooks/use-date-filter';
import { useDashboardMetrics, useRecentActivity } from '@/hooks/use-dashboard-metrics';
import { useNotifications } from '@/hooks/use-notifications';
import { useTranslation } from '@/hooks/use-translation';
import { ActivityLogRow } from '@/lib/queries/activity-log';
import { formatRangeLabel } from '@/utils/date-range';
import { formatMAD } from '@/utils/format';

// Locale-aware but deliberately kept as a plain lookup table rather than routed through the
// strict-keyed `t()` system — these are `activity_logs.action` values (dotted event names), not
// UI copy, and forcing them through the dotted TranslationKey path type would fight the type
// system for no benefit since this table is only ever read here.
const ACTIVITY_LABELS_FR: Record<string, string> = {
  'reservation.created': 'Nouvelle réservation',
  'reservation.updated': 'Réservation modifiée',
  'reservation_service.added': 'Service ajouté',
  'reservation_service.updated': 'Service modifié',
  'reservation_service.removed': 'Service supprimé',
  'reservation_service.confirmed': 'Service confirmé',
  'reservation_service.provider_assigned': 'Prestataire assigné',
  'reservation_service.scheduled': 'Service planifié',
  'reservation_service.started': 'Service démarré',
  'reservation_service.completed': 'Service terminé',
  'reservation_service.cancelled': 'Service annulé',
  'reservation_service.refunded': 'Service remboursé',
  'service_provider.created': 'Prestataire créé',
  'service_provider.updated': 'Prestataire modifié',
  'service.created': 'Service ajouté au catalogue',
  'service.updated': 'Catalogue modifié',
};
const ACTIVITY_LABELS_AR: Record<string, string> = {
  'reservation.created': 'حجز جديد',
  'reservation.updated': 'تعديل الحجز',
  'reservation_service.added': 'إضافة خدمة',
  'reservation_service.updated': 'تعديل الخدمة',
  'reservation_service.removed': 'حذف الخدمة',
  'reservation_service.confirmed': 'تأكيد الخدمة',
  'reservation_service.provider_assigned': 'إسناد مقدم الخدمة',
  'reservation_service.scheduled': 'جدولة الخدمة',
  'reservation_service.started': 'بدء الخدمة',
  'reservation_service.completed': 'إنهاء الخدمة',
  'reservation_service.cancelled': 'إلغاء الخدمة',
  'reservation_service.refunded': 'استرداد الخدمة',
  'service_provider.created': 'إنشاء مقدم خدمة',
  'service_provider.updated': 'تعديل مقدم الخدمة',
  'service.created': 'إضافة خدمة للكتالوج',
  'service.updated': 'تعديل الكتالوج',
};
const ACTIVITY_ICON: Record<string, { icon: string; bg: string; color: string }> = {
  'reservation.created': { icon: 'event_available', bg: '#EEEAFB', color: '#6D4FC9' },
  'reservation.updated': { icon: 'edit', bg: '#E3F0FF', color: AmkouyColors.primaryContainer },
  'reservation_service.added': { icon: 'room_service', bg: '#F8EFD4', color: '#8a6d1c' },
  'reservation_service.updated': { icon: 'sync', bg: '#F8EFD4', color: '#8a6d1c' },
  'reservation_service.removed': { icon: 'remove_circle', bg: '#FDEBEB', color: AmkouyColors.error },
  'reservation_service.confirmed': { icon: 'thumb_up', bg: '#F8EFD4', color: '#8a6d1c' },
  'reservation_service.provider_assigned': { icon: 'person_add', bg: '#EEEAFB', color: '#6D4FC9' },
  'reservation_service.scheduled': { icon: 'event', bg: '#EEEAFB', color: '#6D4FC9' },
  'reservation_service.started': { icon: 'play_circle', bg: '#FDEBC8', color: '#B45309' },
  'reservation_service.completed': { icon: 'check_circle', bg: '#DEF7E6', color: AmkouyColors.success },
  'reservation_service.cancelled': { icon: 'cancel', bg: '#FDEBEB', color: AmkouyColors.error },
  'reservation_service.refunded': { icon: 'replay', bg: '#EEF0F4', color: AmkouyColors.textFaint },
  'service_provider.created': { icon: 'groups', bg: '#EEEAFB', color: '#6D4FC9' },
  'service_provider.updated': { icon: 'groups', bg: '#EEEAFB', color: '#6D4FC9' },
  'service.created': { icon: 'room_service', bg: '#F8EFD4', color: '#8a6d1c' },
  'service.updated': { icon: 'room_service', bg: '#F8EFD4', color: '#8a6d1c' },
};
const DEFAULT_ACTIVITY_META = { icon: 'notifications', bg: '#EEF0F4', color: AmkouyColors.textFaint };

function describeActivity(row: ActivityLogRow, locale: 'fr' | 'ar'): string {
  const changes = row.changes as Record<string, unknown> | null;
  const labels = locale === 'ar' ? ACTIVITY_LABELS_AR : ACTIVITY_LABELS_FR;
  const base = labels[row.action] ?? row.action;
  const guest = changes?.guest as string | undefined;
  return guest ? `${base} · ${guest}` : base;
}

function formatActivityTime(isoDate: string, locale: 'fr' | 'ar'): string {
  return new Date(isoDate).toLocaleString(locale === 'ar' ? 'ar-MA' : 'fr-FR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Exported so other screens showing a period-over-period comparison (e.g. the Executive Command
 * Center) reuse this exact formatting rather than reimplementing it. */
export function growthLabel(current: number, previous: number): string {
  if (previous === 0) return current > 0 ? '+100%' : '0%';
  const pct = ((current - previous) / previous) * 100;
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(1).replace('.', ',')}%`;
}

export default function DashboardScreen() {
  return (
    <AccessGuard resource="dashboard">
      <DateFilterProvider>
        <DashboardContent />
      </DateFilterProvider>
    </AccessGuard>
  );
}

function DashboardContent() {
  const { profile } = useAuth();
  // Phase 5 (role-based dashboard experience): Accountant's focus is Payments/Owner Payouts/
  // Financial KPIs — the occupancy ring and the cleaning/maintenance/contracts-expiring tiles are
  // purely operational and stay hidden for them, same shared dashboard otherwise (no new
  // component, just fewer visible widgets). Manager/Admin/Super Admin see every widget, unchanged.
  const isAccountant = profile?.role === 'accountant';
  const { t, locale } = useTranslation();
  const { range, comparisonRange, comparisonMode } = useDateFilter();
  const { data: metrics, isLoading, isError, refetch } = useDashboardMetrics(range);
  const { data: comparisonMetrics } = useDashboardMetrics(comparisonRange ?? range);
  const { data: activity } = useRecentActivity(range);
  const { data: notifications } = useNotifications();
  const unreadNotificationsCount = (notifications ?? []).filter((n) => !n.read_at).length;

  const periodLabel = formatRangeLabel(range, locale);
  const today = new Date().toLocaleDateString(locale === 'ar' ? 'ar-MA' : 'fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const showGrowth = comparisonMode !== 'none' && !!comparisonRange && !!comparisonMetrics;

  return (
    <Screen contentPadding={false}>
      <HeroHeader>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerDate}>{today.charAt(0).toUpperCase() + today.slice(1)}</Text>
            <Text style={styles.headerGreeting}>{t('dashboard.greeting', { name: profile?.full_name?.split(' ')[0] ?? '' })}</Text>
          </View>
          <Pressable onPress={() => router.push('/more/notifications')} style={styles.bell}>
            <Icon name="notifications" size={24} color="#fff" />
            {unreadNotificationsCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadNotificationsCount}</Text>
              </View>
            )}
          </Pressable>
        </View>

        <View style={styles.heroCardsRow}>
          <View style={[styles.heroCard, styles.heroCardRevenue]}>
            <Text style={styles.heroCardLabel}>{t('dashboard.revenueForPeriod', { period: periodLabel })}</Text>
            <Text style={styles.heroCardValue}>{metrics ? formatMAD(metrics.revenueTotal) : '—'}</Text>
            {showGrowth && (
              <View style={styles.trendRow}>
                <Icon name="trending_up" size={14} color={AmkouyColors.success} />
                <Text style={styles.trendText}>
                  {growthLabel(metrics?.revenueTotal ?? 0, comparisonMetrics?.revenueTotal ?? 0)}
                </Text>
              </View>
            )}
          </View>
          <View style={[styles.heroCard, styles.heroCardProfit]}>
            <Text style={[styles.heroCardLabel, { color: '#e8d6a4' }]}>{t('dashboard.profitForPeriod', { period: periodLabel })}</Text>
            <Text style={[styles.heroCardValue, { color: AmkouyColors.secondary }]}>
              {metrics ? formatMAD(metrics.profit) : '—'}
            </Text>
            {showGrowth && (
              <View style={styles.trendRow}>
                <Icon name="trending_up" size={14} color={AmkouyColors.success} />
                <Text style={styles.trendText}>
                  {growthLabel(metrics?.profit ?? 0, comparisonMetrics?.profit ?? 0)}
                </Text>
              </View>
            )}
          </View>
        </View>
      </HeroHeader>

      <DateFilterBar />

      {isLoading && <LoadingState label={t('dashboard.loading')} />}
      {isError && <ErrorState message={t('dashboard.loadError')} onRetry={refetch} />}

      {!isLoading && !isError && metrics && (
        <>
          {!isAccountant && (
            <View style={styles.occupancyRow}>
              <Card style={styles.ringCard}>
                <OccupancyRing pct={Math.round(metrics.occupancyRate)} />
                <Text style={styles.ringLabel}>{t('dashboard.occupancy')}</Text>
              </Card>
              <View style={styles.statGrid}>
                <Card style={styles.smallStat}>
                  <Text style={[styles.smallStatValue, { color: AmkouyColors.primaryContainer }]}>
                    {metrics.occupiedPropertiesCount}
                  </Text>
                  <Text style={styles.smallStatLabel}>{t('dashboard.occupied')}</Text>
                </Card>
                <Card style={styles.smallStat}>
                  <Text style={[styles.smallStatValue, { color: AmkouyColors.success }]}>
                    {metrics.availablePropertiesCount}
                  </Text>
                  <Text style={styles.smallStatLabel}>{t('dashboard.available')}</Text>
                </Card>
                <Card style={styles.smallStat}>
                  <View style={styles.iconValueRow}>
                    <Icon name="login" size={16} color={AmkouyColors.success} />
                    <Text style={styles.smallStatValue}>{metrics.checkIns}</Text>
                  </View>
                  <Text style={styles.smallStatLabel}>{t('dashboard.arrivals')}</Text>
                </Card>
                <Card style={styles.smallStat}>
                  <View style={styles.iconValueRow}>
                    <Icon name="logout" size={16} color={AmkouyColors.error} />
                    <Text style={styles.smallStatValue}>{metrics.checkOuts}</Text>
                  </View>
                  <Text style={styles.smallStatLabel}>{t('dashboard.departures')}</Text>
                </Card>
              </View>
            </View>
          )}

          <View style={styles.alertGrid}>
            {!isAccountant && (
              <>
                <AlertCard
                  count={metrics.cleaningTasksDueCount}
                  label={t('dashboard.cleaningDue')}
                  icon="cleaning_services"
                  iconBg="#E3F0FF"
                  iconColor={AmkouyColors.primaryContainer}
                  onPress={() => router.push('/more/cleaning')}
                />
                <AlertCard
                  count={metrics.maintenanceOpenCount}
                  label={t('dashboard.maintenanceOpen')}
                  icon="build"
                  iconBg="#FDEBEB"
                  iconColor={AmkouyColors.error}
                  onPress={() => router.push('/more/maintenance')}
                />
              </>
            )}
            <AlertCard
              count={metrics.ownerPaymentsDueCount}
              label={t('dashboard.paymentsDue')}
              icon="payments"
              iconBg="#F8EFD4"
              iconColor="#8a6d1c"
              onPress={() => router.push('/more/owner-payments')}
            />
            {!isAccountant && (
              <AlertCard
                count={metrics.contractsExpiringCount}
                label={t('dashboard.contractsExpiring')}
                icon="description"
                iconBg="#EEEAFB"
                iconColor="#6D4FC9"
                onPress={() => router.push('/more/contracts?health=expiring')}
              />
            )}
          </View>

          <Text style={styles.sectionTitle}>{t('dashboard.paymentsModule')}</Text>
          <View style={styles.alertGrid}>
            <AlertCard
              count={formatMAD(metrics.cashReceived)}
              label={t('dashboard.cashReceived')}
              icon="payments"
              iconBg="#DEF7E6"
              iconColor={AmkouyColors.success}
            />
            <AlertCard
              count={formatMAD(metrics.outstandingBalances)}
              label={t('dashboard.outstandingBalance')}
              icon="hourglass_empty"
              iconBg="#FDEBC8"
              iconColor="#B45309"
            />
            <AlertCard count={metrics.pendingDeposits} label={t('dashboard.missingDeposits')} icon="lock_open" iconBg="#FAD9D9" iconColor={AmkouyColors.error} />
            <AlertCard count={formatMAD(metrics.refundsTotal)} label={t('dashboard.refunds')} icon="undo" iconBg="#EEEAFB" iconColor="#6D4FC9" />
            <AlertCard count={`${metrics.collectionRate}%`} label={t('dashboard.collectionRate')} icon="trending_up" iconBg="#E3E9F4" iconColor={AmkouyColors.primaryContainer} />
            <AlertCard
              count={metrics.avgCollectionDelayDays != null ? `${metrics.avgCollectionDelayDays}j` : '—'}
              label={t('dashboard.avgDelay')}
              icon="schedule"
              iconBg="#E3F0FF"
              iconColor={AmkouyColors.primaryContainer}
            />
          </View>

          <Text style={styles.sectionTitle}>{t('dashboard.recentActivity')}</Text>
          <Card style={styles.activityCard}>
            {(!activity || activity.length === 0) && (
              <View style={styles.activityRow}>
                <Text style={styles.activityTitle}>{t('dashboard.noActivity')}</Text>
              </View>
            )}
            {(activity ?? []).map((row, index) => {
              const meta = ACTIVITY_ICON[row.action] ?? DEFAULT_ACTIVITY_META;
              return (
                <View
                  key={row.id}
                  style={[
                    styles.activityRow,
                    index < (activity?.length ?? 0) - 1 && styles.activityRowBorder,
                  ]}>
                  <View style={[styles.activityIcon, { backgroundColor: meta.bg }]}>
                    <Icon name={meta.icon} size={19} color={meta.color} />
                  </View>
                  <View style={styles.activityText}>
                    <Text style={styles.activityTitle}>{describeActivity(row, locale)}</Text>
                    <Text style={styles.activityTime}>{formatActivityTime(row.created_at, locale)}</Text>
                  </View>
                </View>
              );
            })}
          </Card>
        </>
      )}
    </Screen>
  );
}

function AlertCard({
  count,
  label,
  icon,
  iconBg,
  iconColor,
  onPress,
}: {
  count: number | string;
  label: string;
  icon: string;
  iconBg: string;
  iconColor: string;
  onPress?: () => void;
}) {
  return (
    <Pressable onPress={onPress} disabled={!onPress}>
      <Card style={styles.alertCard}>
        <View style={[styles.alertIcon, { backgroundColor: iconBg }]}>
          <Icon name={icon} size={21} color={iconColor} />
        </View>
        <View>
          <Text style={styles.alertCount}>{count}</Text>
          <Text style={styles.alertLabel}>{label}</Text>
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  headerDate: {
    ...robotoText(400, 13, { color: AmkouyColors.onPrimaryMuted }),
  },
  headerGreeting: {
    ...robotoText(700, 25, { color: '#fff', marginTop: 2 }),
  },
  bell: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 6,
    right: 7,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: AmkouyColors.error,
    borderWidth: 2,
    borderColor: AmkouyColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    ...robotoText(700, 9, { color: '#fff' }),
  },
  heroCardsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 18,
  },
  heroCard: {
    flex: 1,
    borderRadius: 14,
    padding: 14,
  },
  heroCardRevenue: {
    backgroundColor: 'rgba(255,255,255,.07)',
  },
  heroCardProfit: {
    backgroundColor: 'rgba(201,168,76,.16)',
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,.3)',
  },
  heroCardLabel: {
    ...robotoText(400, 11, { color: AmkouyColors.onPrimaryMuted }),
  },
  heroCardValue: {
    ...robotoText(900, 22, { color: '#fff', marginTop: 5 }),
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 4,
  },
  trendText: {
    ...robotoText(600, 11, { color: AmkouyColors.success }),
  },
  occupancyRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 22,
    paddingTop: 16,
  },
  ringCard: {
    width: 120,
    alignItems: 'center',
    padding: 16,
  },
  ringLabel: {
    ...robotoText(500, 12, { color: AmkouyColors.textMuted, marginTop: 10 }),
  },
  statGrid: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  smallStat: {
    width: '47%',
    padding: 12,
  },
  smallStatValue: {
    ...robotoText(900, 20, { color: AmkouyColors.text }),
  },
  smallStatLabel: {
    ...robotoText(500, 10.5, { color: AmkouyColors.textFaint, marginTop: 1 }),
  },
  iconValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  alertGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 22,
    paddingTop: 14,
  },
  alertCard: {
    width: '47%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    padding: 13,
  },
  alertIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertCount: {
    ...robotoText(900, 18, { color: AmkouyColors.text }),
  },
  alertLabel: {
    ...robotoText(500, 10.5, { color: AmkouyColors.textFaint }),
  },
  sectionTitle: {
    ...robotoText(700, 17, { color: AmkouyColors.primary, paddingHorizontal: 22, paddingTop: 24, paddingBottom: 10 }),
  },
  activityCard: {
    marginHorizontal: 22,
    overflow: 'hidden',
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 13,
    paddingHorizontal: 15,
  },
  activityRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: AmkouyColors.hairline,
  },
  activityIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityText: {
    flex: 1,
  },
  activityTitle: {
    ...robotoText(500, 13, { color: AmkouyColors.text }),
  },
  activityTime: {
    ...robotoText(400, 11, { color: AmkouyColors.textFainter, marginTop: 1 }),
  },
});

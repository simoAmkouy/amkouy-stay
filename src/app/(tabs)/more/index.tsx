import { Href, router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/amkouy/card';
import { Screen } from '@/components/amkouy/screen';
import { ScreenHeader } from '@/components/amkouy/screen-header';
import { Icon } from '@/components/icon';
import { robotoText } from '@/constants/typography';
import { Resource } from '@/constants/permissions';
import { MoreItemKey, ROLE_MORE_VISIBLE } from '@/constants/role-navigation';
import { useAuth } from '@/hooks/use-auth';
import { usePermissions } from '@/hooks/use-permissions';
import { useTranslation } from '@/hooks/use-translation';
import { TranslationKey } from '@/i18n';

const MORE_ITEMS: {
  key: MoreItemKey;
  labelKey: TranslationKey;
  icon: string;
  bg: string;
  color: string;
  href: Href;
  /** A single resource, or (for tiles that lead to a hub covering several resource-gated
   * sub-screens, like Commercial) an array meaning "visible if the role holds ANY of these". */
  resource: Resource | Resource[] | null;
}[] = [
  {
    key: 'executive_command_center',
    labelKey: 'more.executiveCommandCenter',
    icon: 'insights',
    bg: '#E3E9F4',
    color: '#1E3A6E',
    href: '/more/executive-command-center',
    resource: 'executive_command_center',
  },
  { key: 'owners', labelKey: 'more.owners', icon: 'real_estate_agent', bg: '#F8EFD4', color: '#8a6d1c', href: '/more/owners', resource: 'owners' },
  { key: 'activation_center', labelKey: 'more.activationCenter', icon: 'rocket_launch', bg: '#DEF7E6', color: '#15803D', href: '/more/activation-center', resource: 'property_activation' },
  {
    key: 'commercial',
    labelKey: 'more.commercial',
    icon: 'trending_up',
    bg: '#FCEFD0',
    color: '#8a6d1c',
    href: '/more/commercial',
    resource: ['commercial_leads', 'reservation_leads', 'commercial_dashboard', 'commercial_management'],
  },
  { key: 'finance', labelKey: 'more.finance', icon: 'account_balance', bg: '#DEF7E6', color: '#15803D', href: '/more/finance', resource: 'finance' },
  { key: 'expenses', labelKey: 'more.expenses', icon: 'receipt_long', bg: '#FDEBEB', color: '#B45309', href: '/more/expenses', resource: 'expenses' },
  { key: 'owner_payments', labelKey: 'more.ownerPayments', icon: 'account_balance_wallet', bg: '#DEF7E6', color: '#15803D', href: '/more/owner-payments', resource: 'owner_payments' },
  { key: 'contracts', labelKey: 'more.contracts', icon: 'description', bg: '#E3E9F4', color: '#1E3A6E', href: '/more/contracts', resource: 'contracts' },
  { key: 'reports', labelKey: 'more.reports', icon: 'insights', bg: '#DEF7E6', color: '#15803D', href: '/more/reports', resource: 'reports' },
  { key: 'cleaning', labelKey: 'more.cleaning', icon: 'cleaning_services', bg: '#E3F0FF', color: '#1E3A6E', href: '/more/cleaning', resource: 'cleaning' },
  { key: 'maintenance', labelKey: 'more.maintenance', icon: 'build', bg: '#FDEBEB', color: '#EF4444', href: '/more/maintenance', resource: 'maintenance' },
  { key: 'concierge_catalog', labelKey: 'more.serviceCatalog', icon: 'room_service', bg: '#F8EFD4', color: '#8a6d1c', href: '/more/concierge/catalog', resource: 'concierge' },
  { key: 'concierge_providers', labelKey: 'more.providers', icon: 'groups', bg: '#EEEAFB', color: '#6D4FC9', href: '/more/concierge/providers', resource: 'concierge' },
  { key: 'concierge_reports', labelKey: 'more.concierge_reports', icon: 'insights', bg: '#DEF7E6', color: '#15803D', href: '/more/concierge/reports', resource: 'concierge_reports' },
  { key: 'notifications', labelKey: 'more.notifications', icon: 'notifications', bg: '#EEEAFB', color: '#6D4FC9', href: '/more/notifications', resource: null },
  { key: 'owner_portal', labelKey: 'more.ownerPortal', icon: 'badge', bg: '#FCEFD0', color: '#8a6d1c', href: '/more/owner-portal', resource: 'owner_portal' },
  { key: 'archived_items', labelKey: 'more.archivedItems', icon: 'restore_from_trash', bg: '#EEF0F4', color: '#5A5E66', href: '/more/archived-items', resource: 'archived_items' },
  { key: 'settings', labelKey: 'more.settings', icon: 'settings', bg: '#EEF0F4', color: '#5A5E66', href: '/more/settings', resource: null },
];

export default function MoreScreen() {
  const { profile } = useAuth();
  const { can } = usePermissions();
  const { t } = useTranslation();
  // Security boundary first (unchanged): a role only ever sees what `canAccess` already allows.
  // `ROLE_MORE_VISIBLE`, when the role has an entry, then narrows that further — visibility never
  // widens access (Phase 6). Roles without an entry (admin/super_admin/manager) keep today's
  // full canAccess-driven grid.
  const roleMoreKeys = profile?.role ? ROLE_MORE_VISIBLE[profile.role] : undefined;
  const visibleItems = MORE_ITEMS.filter((item) => {
    const allowed = !item.resource || (Array.isArray(item.resource) ? item.resource.some(can) : can(item.resource));
    if (!allowed) return false;
    if (roleMoreKeys && !roleMoreKeys.includes(item.key)) return false;
    return true;
  });

  return (
    <Screen>
      <ScreenHeader title={t('more.title')} />
      <View style={styles.grid}>
        {visibleItems.map((item) => (
          <Pressable key={item.labelKey} onPress={() => router.push(item.href)} style={styles.gridItemWrap}>
            <Card style={styles.gridItem}>
              <View style={[styles.iconBox, { backgroundColor: item.bg }]}>
                <Icon name={item.icon} size={24} color={item.color} />
              </View>
              <Text style={styles.label}>{t(item.labelKey)}</Text>
            </Card>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 22,
    gap: 12,
  },
  gridItemWrap: {
    width: '31%',
  },
  gridItem: {
    paddingVertical: 16,
    paddingHorizontal: 10,
    alignItems: 'center',
    gap: 9,
  },
  iconBox: {
    width: 46,
    height: 46,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    ...robotoText(600, 11.5, { textAlign: 'center' }),
  },
});

import { MaterialIcons } from '@expo/vector-icons';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { ComponentProps } from 'react';

import { AmkouyColors } from '@/constants/amkouy-theme';
import { getTabsForRole, TAB_DEFS, TabKey } from '@/constants/role-navigation';
import { useAuth } from '@/hooks/use-auth';
import { useTranslation } from '@/hooks/use-translation';

type MaterialIconName = ComponentProps<typeof MaterialIcons>['name'];

// Every possible tab across every role must be rendered as a Trigger — NativeTabs is built from a
// static route table, and a Trigger conditionally omitted from JSX just leaves that route's
// `hidden` option at its (visible) default rather than actually hiding it. `hidden` is the real,
// reactive visibility switch. Which keys are visible for the signed-in role comes from
// `role-navigation.ts`'s `getTabsForRole` (single source of truth) — no per-tab role checks
// scattered here.
const ALL_TAB_KEYS: TabKey[] = [
  'dashboard',
  'operations',
  'properties',
  'reservations',
  'portal',
  'tasks',
  'tickets',
  'commercial_dashboard',
  'leads',
  'reservation_leads',
  'more',
];

export default function AppTabs() {
  const { profile } = useAuth();
  const { t } = useTranslation();
  const visibleKeys = new Set(getTabsForRole(profile?.role).map((d) => d.key));

  return (
    <NativeTabs
      backgroundColor={AmkouyColors.surface}
      indicatorColor={AmkouyColors.secondaryContainer}
      iconColor={{ default: '#7d828b', selected: AmkouyColors.primary }}
      labelStyle={{
        default: { color: '#7d828b', fontSize: 11 },
        selected: { color: AmkouyColors.primary, fontSize: 11, fontWeight: '600' },
      }}>
      {ALL_TAB_KEYS.map((key) => {
        const def = TAB_DEFS[key];
        return (
          <NativeTabs.Trigger key={key} name={def.name} hidden={!visibleKeys.has(key)}>
            <NativeTabs.Trigger.Label>{t(def.labelKey)}</NativeTabs.Trigger.Label>
            <NativeTabs.Trigger.VectorIcon family={MaterialIcons} name={def.icon.replace(/_/g, '-') as MaterialIconName} />
          </NativeTabs.Trigger>
        );
      })}
    </NativeTabs>
  );
}

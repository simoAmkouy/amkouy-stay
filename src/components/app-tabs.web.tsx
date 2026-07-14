import {
  Tabs,
  TabList,
  TabTrigger,
  TabSlot,
  TabTriggerSlotProps,
  TabListProps,
} from 'expo-router/ui';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/icon';
import { AmkouyColors } from '@/constants/amkouy-theme';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { getTabsForRole, TAB_DEFS, TabKey } from '@/constants/role-navigation';
import { robotoText } from '@/constants/typography';
import { useAuth } from '@/hooks/use-auth';
import { useLocale } from '@/hooks/use-locale';
import { useTranslation } from '@/hooks/use-translation';

// Every possible tab must be registered as a TabTrigger inside TabList — per expo-router/ui,
// that's what defines which routes exist in this Tabs instance at all. A key left out entirely
// (rather than just visually hidden) can't be reached by direct URL: the Tabs router falls back
// to whatever tab was last active instead of mounting that screen's own AccessGuard, which was
// live-verified this session (a role landed on "Plus" when typing an unrelated tab's URL instead
// of seeing "access denied"). Registering everything and only rendering a visible *button* for
// the role's subset fixes that without weakening anything — the target screen's own AccessGuard
// still gates the content once it actually mounts.
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
    <Tabs>
      <TabSlot style={{ height: '100%' }} />
      <TabList asChild>
        <CustomTabList>
          {ALL_TAB_KEYS.map((key) => {
            const def = TAB_DEFS[key];
            return (
              <TabTrigger key={def.name} name={def.name} href={def.href} asChild>
                {visibleKeys.has(key) ? (
                  <TabButton icon={def.icon}>{t(def.labelKey)}</TabButton>
                ) : (
                  <HiddenTabTrigger />
                )}
              </TabTrigger>
            );
          })}
        </CustomTabList>
      </TabList>
    </Tabs>
  );
}

function TabButton({
  children,
  icon,
  isFocused,
  ...props
}: TabTriggerSlotProps & { icon: string }) {
  return (
    <Pressable {...props} style={({ pressed }) => [styles.pressableShrink, pressed && styles.pressed]}>
      <View style={[styles.tabButton, isFocused && styles.tabButtonActive]}>
        <Icon name={icon} size={18} color={isFocused ? AmkouyColors.primary : '#7d828b'} />
        <Text style={[styles.tabLabel, { color: isFocused ? AmkouyColors.primary : '#7d828b' }]} numberOfLines={1}>
          {children}
        </Text>
      </View>
    </Pressable>
  );
}

/** Registers the route without taking any visual space — for tab keys not in the signed-in
 * role's visible set (see the comment on `ALL_TAB_KEYS` above). */
function HiddenTabTrigger(props: TabTriggerSlotProps) {
  return <View {...props} style={styles.hidden} />;
}

function CustomTabList(props: TabListProps) {
  const { t } = useTranslation();
  const { isRTL } = useLocale();
  return (
    <View {...props} style={styles.tabListContainer}>
      <View style={[styles.innerContainer, isRTL && styles.innerContainerRTL]}>
        <Text style={[styles.brandText, isRTL && styles.brandTextRTL]} numberOfLines={1}>
          {t('login.brand')}
        </Text>
        {props.children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tabListContainer: {
    position: 'absolute',
    width: '100%',
    padding: Spacing.three,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  innerContainer: {
    backgroundColor: AmkouyColors.card,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.five,
    borderRadius: Spacing.five,
    flexDirection: 'row',
    alignItems: 'center',
    // Root cause of the mobile tab-bar overflow: React Native's Yoga layout defaults
    // `flexShrink` to 0 (web CSS flexbox defaults to 1), so without this, neither this row nor
    // its children (brand text, each tab button) can compress below their intrinsic content
    // width. `flexGrow: 1` alone only ever handles the *too much space* case — on a narrow
    // viewport where 1-5 tabs + brand text genuinely don't fit, the row rendered at full
    // intrinsic width and spilled off both edges (centered by `justifyContent: 'center'` on the
    // parent). `minWidth: 0` is required alongside `flexShrink` — Yoga (like CSS flexbox) also
    // defaults a flex item's minimum size to its content size, which silently overrides shrink.
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
    gap: Spacing.three,
    maxWidth: MaxContentWidth,
    shadowColor: AmkouyColors.primary,
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  brandText: {
    ...robotoText(700, 14, { color: AmkouyColors.primary, marginRight: 'auto', flexShrink: 1, minWidth: 0 }),
  },
  // RN Web's `flexDirection: 'row'` does not itself mirror with `dir="rtl"` here, so the tab
  // order and the brand's auto-margin side are flipped explicitly rather than relying on it.
  innerContainerRTL: {
    flexDirection: 'row-reverse',
  },
  brandTextRTL: {
    marginRight: 0,
    marginLeft: 'auto',
  },
  pressed: {
    opacity: 0.7,
  },
  // Same flexShrink/minWidth story as innerContainer above — this Pressable (not the View inside
  // it) is the actual flex child of innerContainer's row, so it's the one that needs to be
  // allowed to shrink for the label truncation inside it to ever take effect.
  pressableShrink: {
    flexShrink: 1,
    minWidth: 0,
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    minWidth: 0,
    gap: 6,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },
  tabButtonActive: {
    backgroundColor: AmkouyColors.secondaryContainer,
  },
  tabLabel: {
    ...robotoText(600, 13, { flexShrink: 1 }),
  },
  hidden: {
    width: 0,
    height: 0,
    overflow: 'hidden',
  },
});

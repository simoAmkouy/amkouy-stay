import { Href, router } from 'expo-router';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/amkouy/avatar';
import { Card } from '@/components/amkouy/card';
import { Screen } from '@/components/amkouy/screen';
import { ScreenHeader } from '@/components/amkouy/screen-header';
import { Icon } from '@/components/icon';
import { AmkouyColors } from '@/constants/amkouy-theme';
import { robotoText } from '@/constants/typography';
import { useAuth } from '@/hooks/use-auth';
import { usePermissions } from '@/hooks/use-permissions';
import { useTranslation } from '@/hooks/use-translation';
import { TranslationKey } from '@/i18n';
import { getInitials } from '@/utils/format';

// Notifications, Langue and Équipe & rôles have real screens; the other two don't exist yet, so
// they route to a shared placeholder rather than doing nothing (previously: plain `View` rows
// with no onPress at all). Équipe & rôles is additionally gated — see `items` below.
const BASE_ITEMS: { icon: string; labelKey: TranslationKey; href: Href }[] = [
  { icon: 'notifications', labelKey: 'settings.notifications', href: '/more/notifications' },
  { icon: 'language', labelKey: 'settings.language', href: '/more/language' },
  { icon: 'lock', labelKey: 'settings.security', href: '/more/coming-soon?title=Sécurité %26 connexion&icon=lock' },
  { icon: 'help', labelKey: 'settings.help', href: '/more/coming-soon?title=Aide %26 support&icon=help' },
];

export default function SettingsScreen() {
  const { profile, signOut } = useAuth();
  const { can } = usePermissions();
  const { t } = useTranslation();

  const items = can('team_management')
    ? [...BASE_ITEMS.slice(0, 2), { icon: 'group', labelKey: 'settings.team' as TranslationKey, href: '/more/team' as Href }, ...BASE_ITEMS.slice(2)]
    : BASE_ITEMS;

  const handleLogout = async () => {
    await signOut();
    router.replace('/login');
  };

  return (
    <Screen>
      <ScreenHeader
        title={t('settings.title')}
        showBack
        fallbackHref="/more"
        trailing={
          <Image
            source={require('@/assets/images/amkouy-logo.png')}
            style={styles.headerLogo}
            resizeMode="contain"
            accessibilityLabel="Amkouy Immobilier"
          />
        }
      />

      <Card style={styles.profileCard}>
        <Avatar initials={getInitials(profile?.full_name ?? '?')} size={54} />
        <View style={{ flex: 1 }}>
          <Text style={styles.profileName}>{profile?.full_name ?? '—'}</Text>
          <Text style={styles.profileRole}>{profile ? t(`roles.${profile.role}` as TranslationKey) : ''}</Text>
        </View>
        <Icon name="chevron_right" size={22} color="#c2c7cf" />
      </Card>

      <Card style={styles.itemsCard}>
        {items.map((item, index) => (
          <Pressable key={item.labelKey} onPress={() => router.push(item.href)}>
            <View style={[styles.itemRow, index < items.length - 1 && styles.itemRowBorder]}>
              <Icon name={item.icon} size={22} color={AmkouyColors.primaryContainer} />
              <Text style={styles.itemLabel}>{t(item.labelKey)}</Text>
              <Icon name="chevron_right" size={21} color="#c2c7cf" />
            </View>
          </Pressable>
        ))}
      </Card>

      <Pressable onPress={handleLogout} style={styles.logoutButton}>
        <Icon name="logout" size={21} color={AmkouyColors.error} />
        <Text style={styles.logoutText}>{t('settings.logout')}</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerLogo: {
    width: 54,
    height: 36,
    marginTop: 6,
  },
  profileCard: {
    marginHorizontal: 22,
    marginBottom: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  profileName: {
    ...robotoText(700, 16, { color: AmkouyColors.text }),
  },
  profileRole: {
    ...robotoText(400, 12, { color: AmkouyColors.textFaint, marginTop: 1 }),
  },
  itemsCard: {
    marginHorizontal: 22,
    overflow: 'hidden',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    padding: 14,
    paddingHorizontal: 16,
  },
  itemRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: AmkouyColors.hairline,
  },
  itemLabel: {
    flex: 1,
    ...robotoText(500, 14, { color: AmkouyColors.text }),
  },
  logoutButton: {
    marginHorizontal: 22,
    marginTop: 16,
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: AmkouyColors.error,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  logoutText: {
    ...robotoText(600, 14, { color: AmkouyColors.error }),
  },
});

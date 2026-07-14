import { Href } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/icon';
import { AmkouyColors } from '@/constants/amkouy-theme';
import { robotoText } from '@/constants/typography';
import { useLocale } from '@/hooks/use-locale';
import { goBackOrReplace } from '@/utils/navigation';

/** Large title app-bar used by the light-surface list/detail screens. */
export function ScreenHeader({
  title,
  subtitle,
  showBack = false,
  fallbackHref,
  trailing,
}: {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  /** Where to go if there's no previous screen to return to. Required when showBack is true. */
  fallbackHref?: Href;
  trailing?: React.ReactNode;
}) {
  const { isRTL } = useLocale();
  return (
    <View>
      {showBack && (
        <Pressable
          onPress={() => goBackOrReplace(fallbackHref ?? '/dashboard')}
          style={styles.backButton}
          hitSlop={8}>
          <Icon name={isRTL ? 'arrow_forward' : 'arrow_back'} size={24} color={AmkouyColors.primary} />
        </Pressable>
      )}
      <View style={styles.row}>
        <View style={styles.titleWrap}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {trailing}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 14,
    marginTop: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingTop: 4,
    paddingBottom: 12,
  },
  titleWrap: {
    flex: 1,
  },
  title: {
    ...robotoText(700, 27, { color: AmkouyColors.primary, letterSpacing: -0.4 }),
  },
  subtitle: {
    ...robotoText(400, 13, { color: AmkouyColors.textFaint, marginTop: 3 }),
  },
});

import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/amkouy/card';
import { Screen } from '@/components/amkouy/screen';
import { ScreenHeader } from '@/components/amkouy/screen-header';
import { Icon } from '@/components/icon';
import { AmkouyColors } from '@/constants/amkouy-theme';
import { robotoText } from '@/constants/typography';
import { useLocale } from '@/hooks/use-locale';
import { useTranslation } from '@/hooks/use-translation';
import { LANGUAGE_OPTIONS } from '@/i18n';

export default function LanguageScreen() {
  const { t } = useTranslation();
  const { locale, setLocale } = useLocale();

  return (
    <Screen>
      <ScreenHeader title={t('languageScreen.title')} showBack fallbackHref="/more/settings" />
      <Text style={styles.subtitle}>{t('languageScreen.subtitle')}</Text>

      <Card style={styles.card}>
        {LANGUAGE_OPTIONS.map((option, index) => {
          const selected = option.value === locale;
          return (
            <Pressable key={option.value} onPress={() => setLocale(option.value)}>
              <View style={[styles.row, index < LANGUAGE_OPTIONS.length - 1 && styles.rowBorder]}>
                <Text style={styles.rowLabel}>{t(option.labelKey)}</Text>
                {selected && <Icon name="check" size={20} color={AmkouyColors.primary} />}
              </View>
            </Pressable>
          );
        })}
      </Card>

      <Text style={styles.note}>{t('languageScreen.appliedImmediately')}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  subtitle: {
    ...robotoText(400, 13, { color: AmkouyColors.textFaint, paddingHorizontal: 22, marginBottom: 14 }),
  },
  card: {
    marginHorizontal: 22,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: AmkouyColors.hairline,
  },
  rowLabel: {
    ...robotoText(500, 15, { color: AmkouyColors.text }),
  },
  note: {
    ...robotoText(400, 11.5, { color: AmkouyColors.textFaint, paddingHorizontal: 22, marginTop: 14 }),
  },
});

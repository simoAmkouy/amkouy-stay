import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { AmkouyColors } from '@/constants/amkouy-theme';
import { robotoText } from '@/constants/typography';
import { useTranslation } from '@/hooks/use-translation';

export function LoadingState({ label }: { label?: string }) {
  const { t } = useTranslation();
  return (
    <View style={styles.wrap}>
      <ActivityIndicator color={AmkouyColors.primary} size="large" />
      <Text style={styles.label}>{label ?? t('common.loading')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  label: {
    ...robotoText(500, 13, { color: AmkouyColors.textFaint }),
  },
});

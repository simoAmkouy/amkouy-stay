import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/icon';
import { AmkouyColors } from '@/constants/amkouy-theme';
import { robotoText } from '@/constants/typography';
import { useTranslation } from '@/hooks/use-translation';

export function ErrorState({
  message,
  onRetry,
  icon = 'error_outline',
  iconColor = AmkouyColors.error,
}: {
  message?: string;
  onRetry?: () => void;
  icon?: string;
  iconColor?: string;
}) {
  const { t } = useTranslation();
  return (
    <View style={styles.wrap}>
      <Icon name={icon} size={32} color={iconColor} />
      <Text style={styles.message}>{message ?? t('common.genericError')}</Text>
      {onRetry && (
        <Pressable onPress={onRetry} style={styles.retryButton}>
          <Text style={styles.retryText}>{t('common.retry')}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
    gap: 12,
  },
  message: {
    ...robotoText(500, 13.5, { color: AmkouyColors.textMuted, textAlign: 'center' }),
  },
  retryButton: {
    marginTop: 6,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: AmkouyColors.primary,
  },
  retryText: {
    ...robotoText(600, 13, { color: AmkouyColors.primary }),
  },
});

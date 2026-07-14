import { StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/icon';
import { AmkouyColors } from '@/constants/amkouy-theme';
import { robotoText } from '@/constants/typography';

export function EmptyState({ icon, message }: { icon: string; message: string }) {
  return (
    <View style={styles.wrap}>
      <Icon name={icon} size={32} color={AmkouyColors.textFainter} />
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
    gap: 12,
  },
  message: {
    ...robotoText(500, 13.5, { color: AmkouyColors.textFaint, textAlign: 'center' }),
  },
});

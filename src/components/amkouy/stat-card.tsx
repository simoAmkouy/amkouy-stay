import { StyleSheet, Text, View, ViewStyle } from 'react-native';

import { AmkouyColors, CardShadow } from '@/constants/amkouy-theme';
import { robotoText } from '@/constants/typography';

export function StatCard({
  value,
  label,
  valueColor = AmkouyColors.primary,
  labelColor = AmkouyColors.textFaint,
  bg = AmkouyColors.card,
  bordered = false,
  style,
}: {
  value: string;
  label: string;
  valueColor?: string;
  labelColor?: string;
  bg?: string;
  bordered?: boolean;
  style?: ViewStyle;
}) {
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: bg },
        bordered ? styles.bordered : CardShadow,
        style,
      ]}>
      <Text style={[styles.value, { color: valueColor }]}>{value}</Text>
      <Text style={[styles.label, { color: labelColor }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    padding: 14,
    flex: 1,
  },
  bordered: {
    borderWidth: 1,
    borderColor: AmkouyColors.hairline,
  },
  value: {
    ...robotoText(900, 20),
  },
  label: {
    ...robotoText(500, 11, { marginTop: 2 }),
  },
});

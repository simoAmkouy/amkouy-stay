import { StyleSheet, Text, View, ViewStyle } from 'react-native';

import { robotoText } from '@/constants/typography';

export function Badge({
  label,
  bg,
  color,
  size = 'md',
  style,
}: {
  label: string;
  bg: string;
  color: string;
  size?: 'sm' | 'md';
  style?: ViewStyle;
}) {
  return (
    <View style={[styles.pill, { backgroundColor: bg }, size === 'sm' && styles.pillSmall, style]}>
      <Text style={[styles.label, { color }, size === 'sm' && styles.labelSmall]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  pillSmall: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 7,
  },
  label: {
    ...robotoText(700, 10),
  },
  labelSmall: {
    fontSize: 9.5,
  },
});

import { StyleSheet, Text, View } from 'react-native';

import { AmkouyColors } from '@/constants/amkouy-theme';
import { robotoText } from '@/constants/typography';

export function Avatar({
  initials,
  size = 46,
  bg = AmkouyColors.primaryContainer,
  color = '#fff',
}: {
  initials: string;
  size?: number;
  bg?: string;
  color?: string;
}) {
  return (
    <View
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: bg },
      ]}>
      <Text style={[robotoText(700, size * 0.33), { color }]}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

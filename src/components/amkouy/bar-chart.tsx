import { DimensionValue, StyleSheet, Text, View } from 'react-native';

import { AmkouyColors } from '@/constants/amkouy-theme';
import { robotoText } from '@/constants/typography';

export function BarChart({
  data,
  height = 128,
}: {
  data: { m: string; h: string; color: string }[];
  height?: number;
}) {
  return (
    <View style={[styles.row, { height }]}>
      {data.map((bar) => (
        <View key={bar.m} style={styles.col}>
          <View style={styles.barTrack}>
            <View
              style={[
                styles.bar,
                { height: bar.h as DimensionValue, backgroundColor: bar.color },
              ]}
            />
          </View>
          <Text style={styles.label}>{bar.m}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 9,
  },
  col: {
    flex: 1,
    alignItems: 'center',
    height: '100%',
    justifyContent: 'flex-end',
  },
  barTrack: {
    width: '100%',
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  bar: {
    width: '100%',
    maxWidth: 24,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
  },
  label: {
    ...robotoText(500, 10, { color: AmkouyColors.textFainter, marginTop: 7 }),
  },
});

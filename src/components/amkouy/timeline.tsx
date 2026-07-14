import { StyleSheet, Text, View } from 'react-native';

import { AmkouyColors } from '@/constants/amkouy-theme';
import { robotoText } from '@/constants/typography';

export function Timeline({
  items,
}: {
  items: { dot: string; ring: string; label: string; time: string }[];
}) {
  return (
    <View>
      {items.map((item, index) => (
        <View key={`${index}-${item.label}-${item.time}`} style={styles.row}>
          <View style={styles.dotColumn}>
            <View style={[styles.dot, { backgroundColor: item.dot, borderColor: item.ring }]} />
            {index < items.length - 1 && <View style={styles.line} />}
          </View>
          <View style={styles.textColumn}>
            <Text style={styles.label}>{item.label}</Text>
            <Text style={styles.time}>{item.time}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 14,
  },
  dotColumn: {
    alignItems: 'center',
  },
  dot: {
    width: 11,
    height: 11,
    borderRadius: 6,
    borderWidth: 2,
  },
  line: {
    width: 2,
    flex: 1,
    backgroundColor: AmkouyColors.hairline,
    marginTop: 2,
  },
  textColumn: {
    flex: 1,
    paddingBottom: 16,
  },
  label: {
    ...robotoText(600, 13, { color: AmkouyColors.text }),
  },
  time: {
    ...robotoText(400, 11, { color: AmkouyColors.textFainter, marginTop: 1 }),
  },
});

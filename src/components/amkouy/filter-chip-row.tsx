import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { AmkouyColors } from '@/constants/amkouy-theme';
import { robotoText } from '@/constants/typography';

export function FilterChipRow<T extends string>({
  options,
  active,
  onChange,
  getLabel = (value) => value,
}: {
  options: readonly T[];
  active: T;
  onChange: (value: T) => void;
  /** Optional display-label override per option; defaults to the raw value (existing behavior). */
  getLabel?: (value: T) => string;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}>
      {options.map((option) => {
        const on = option === active;
        return (
          <Pressable
            key={option}
            onPress={() => onChange(option)}
            style={[styles.chip, on ? styles.chipActive : styles.chipInactive]}>
            <Text style={[styles.label, { color: on ? '#fff' : AmkouyColors.textMuted }]}>
              {getLabel(option)}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: 8,
    paddingHorizontal: 22,
    paddingVertical: 4,
  },
  chip: {
    height: 32,
    paddingHorizontal: 14,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: {
    backgroundColor: AmkouyColors.primary,
  },
  chipInactive: {
    borderWidth: 1,
    borderColor: AmkouyColors.border,
  },
  label: {
    ...robotoText(600, 12),
  },
});

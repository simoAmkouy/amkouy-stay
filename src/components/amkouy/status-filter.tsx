import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { AmkouyColors } from '@/constants/amkouy-theme';
import { robotoText } from '@/constants/typography';

export type StatusOption<T extends string> = { label: string; value: T };

/**
 * Status filter chip row, reused across every list screen (Global Sorting & Filtering).
 * `value` is always an array — empty means "All". When `multiple` is false (default), picking a
 * chip replaces the selection (tap again to clear back to All), matching FilterChipRow's existing
 * single-select feel. When `multiple` is true (Reservations, per the mission's explicit ask),
 * chips toggle independently and several can be active at once.
 */
export function StatusFilter<T extends string>({
  options,
  value,
  onChange,
  allLabel = 'Tous',
  multiple = false,
}: {
  options: readonly StatusOption<T>[];
  value: T[];
  onChange: (value: T[]) => void;
  allLabel?: string;
  multiple?: boolean;
}) {
  const isAll = value.length === 0;

  const toggle = (option: T) => {
    if (!multiple) {
      onChange(value.length === 1 && value[0] === option ? [] : [option]);
      return;
    }
    onChange(value.includes(option) ? value.filter((v) => v !== option) : [...value, option]);
  };

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      <Chip label={allLabel} active={isAll} onPress={() => onChange([])} />
      {options.map((option) => (
        <Chip key={option.value} label={option.label} active={value.includes(option.value)} onPress={() => toggle(option.value)} />
      ))}
    </ScrollView>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active ? styles.chipActive : styles.chipInactive]}>
      <Text style={[styles.label, { color: active ? '#fff' : AmkouyColors.textMuted }]}>{label}</Text>
    </Pressable>
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

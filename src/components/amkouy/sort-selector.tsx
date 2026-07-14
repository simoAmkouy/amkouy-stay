import { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text } from 'react-native';

import { Icon } from '@/components/icon';
import { AmkouyColors } from '@/constants/amkouy-theme';
import { robotoText } from '@/constants/typography';

export type SortOption<T extends string> = { label: string; value: T };

/** Compact "Sort by" pill + bottom-sheet picker — the toolbar counterpart to SelectField's
 * bordered form-field picker, reused across every list screen (Global Sorting & Filtering). */
export function SortSelector<T extends string>({
  options,
  value,
  onChange,
  label = 'Trier par',
}: {
  options: readonly SortOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <>
      <Pressable onPress={() => setOpen(true)} style={styles.pill}>
        <Icon name="sort" size={16} color={AmkouyColors.textMuted} />
        <Text style={styles.pillText} numberOfLines={1}>
          {selected ? selected.label : label}
        </Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>{label}</Text>
            <FlatList
              data={options}
              keyExtractor={(item) => item.value}
              style={styles.list}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    onChange(item.value);
                    setOpen(false);
                  }}
                  style={styles.option}>
                  <Text style={styles.optionText}>{item.label}</Text>
                  {item.value === value && <Icon name="check" size={20} color={AmkouyColors.primary} />}
                </Pressable>
              )}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  pill: {
    height: 48,
    maxWidth: 150,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    borderRadius: 24,
    backgroundColor: AmkouyColors.hairline,
  },
  pillText: {
    ...robotoText(600, 12.5, { color: AmkouyColors.textMuted }),
    flexShrink: 1,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(10,16,30,.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: AmkouyColors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    paddingTop: 14,
    paddingBottom: 24,
  },
  sheetTitle: {
    ...robotoText(700, 15, { color: AmkouyColors.primary, paddingHorizontal: 22, paddingBottom: 8 }),
  },
  list: {
    paddingHorizontal: 10,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: AmkouyColors.hairline,
  },
  optionText: {
    ...robotoText(500, 14.5, { color: AmkouyColors.text }),
  },
});

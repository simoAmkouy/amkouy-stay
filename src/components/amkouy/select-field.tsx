import { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/icon';
import { AmkouyColors } from '@/constants/amkouy-theme';
import { robotoText } from '@/constants/typography';

export type SelectOption = { label: string; value: string };

/** Bordered floating-label field that opens a simple picker sheet, matching FormField's look. */
export function SelectField({
  label,
  value,
  options,
  onChange,
  error,
  placeholder = 'Sélectionner…',
}: {
  label: string;
  value: string | null;
  options: SelectOption[];
  onChange: (value: string) => void;
  error?: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <View style={styles.field}>
      <Pressable
        onPress={() => setOpen(true)}
        style={[styles.inputRow, !!error && styles.inputRowError]}>
        <Text style={[styles.value, !selected && styles.placeholder]}>
          {selected ? selected.label : placeholder}
        </Text>
        <Icon name="expand_more" size={20} color={AmkouyColors.textFaint} />
      </Pressable>
      <Text style={styles.fieldLabel}>{label}</Text>
      {!!error && <Text style={styles.errorText}>{error}</Text>}

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
                  {item.value === value && (
                    <Icon name="check" size={20} color={AmkouyColors.primary} />
                  )}
                </Pressable>
              )}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    position: 'relative',
    marginTop: 18,
  },
  inputRow: {
    height: 52,
    borderWidth: 1.5,
    borderColor: AmkouyColors.border,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: '#fff',
  },
  inputRowError: {
    borderColor: AmkouyColors.error,
  },
  value: {
    ...robotoText(400, 15, { color: AmkouyColors.text }),
  },
  placeholder: {
    color: AmkouyColors.textFainter,
  },
  fieldLabel: {
    position: 'absolute',
    top: -9,
    left: 14,
    backgroundColor: AmkouyColors.surface,
    paddingHorizontal: 6,
    ...robotoText(500, 12, { color: AmkouyColors.textFaint }),
  },
  errorText: {
    ...robotoText(500, 11.5, { color: AmkouyColors.error, marginTop: 4, marginLeft: 4 }),
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

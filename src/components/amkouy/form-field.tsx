import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';

import { AmkouyColors } from '@/constants/amkouy-theme';
import { robotoText, robotoWeight } from '@/constants/typography';

/** Bordered floating-label text field, matching the pattern already used on the Login screen. */
export function FormField({
  label,
  error,
  style,
  multiline,
  ...rest
}: TextInputProps & { label: string; error?: string }) {
  return (
    <View style={styles.field}>
      <View
        style={[
          styles.inputRow,
          multiline && styles.inputRowMultiline,
          !!error && styles.inputRowError,
        ]}>
        <TextInput
          style={[styles.input, multiline && styles.inputMultiline, style]}
          placeholderTextColor={AmkouyColors.textFainter}
          multiline={multiline}
          textAlignVertical={multiline ? 'top' : 'center'}
          {...rest}
        />
      </View>
      <Text style={styles.fieldLabel}>{label}</Text>
      {!!error && <Text style={styles.errorText}>{error}</Text>}
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
    paddingHorizontal: 16,
    backgroundColor: '#fff',
  },
  inputRowError: {
    borderColor: AmkouyColors.error,
  },
  inputRowMultiline: {
    height: 96,
    paddingVertical: 12,
    alignItems: 'flex-start',
  },
  input: {
    flex: 1,
    fontFamily: robotoWeight(400),
    fontSize: 15,
    color: AmkouyColors.text,
  },
  inputMultiline: {
    flex: 1,
    alignSelf: 'stretch',
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
});

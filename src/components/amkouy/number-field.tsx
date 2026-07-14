import { ComponentProps } from 'react';

import { FormField } from '@/components/amkouy/form-field';

type BaseProps = ComponentProps<typeof FormField>;

/** FormField specialized for numeric input: form state stays a real number, the TextInput shows/parses a string. */
export function NumberField({
  label,
  value,
  onChangeValue,
  error,
  ...rest
}: {
  label: string;
  value: number | undefined;
  onChangeValue: (value: number | undefined) => void;
  error?: string;
} & Omit<BaseProps, 'label' | 'value' | 'onChangeText' | 'error'>) {
  return (
    <FormField
      label={label}
      value={value != null ? String(value) : ''}
      onChangeText={(text) => {
        const cleaned = text.replace(/[^0-9.]/g, '');
        onChangeValue(cleaned === '' ? undefined : Number(cleaned));
      }}
      keyboardType="decimal-pad"
      error={error}
      {...rest}
    />
  );
}

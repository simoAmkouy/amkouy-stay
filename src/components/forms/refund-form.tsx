import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet, Switch, Text, View } from 'react-native';

import { FormField } from '@/components/amkouy/form-field';
import { FormModal } from '@/components/amkouy/form-modal';
import { NumberField } from '@/components/amkouy/number-field';
import { SelectField } from '@/components/amkouy/select-field';
import { AmkouyColors } from '@/constants/amkouy-theme';
import { robotoText } from '@/constants/typography';
import { createRefundSchema, PAYMENT_METHOD_OPTIONS, RefundFormValues } from '@/lib/validation/payment';

export function RefundForm({
  visible,
  maxRefundable,
  onClose,
  onSubmit,
  submitting,
}: {
  visible: boolean;
  maxRefundable: number;
  onClose: () => void;
  onSubmit: (values: RefundFormValues) => void;
  submitting: boolean;
}) {
  const schema = createRefundSchema(maxRefundable);
  const defaults: RefundFormValues = { amount: 0, isDepositRelease: false, method: 'bank_transfer', notes: '' };
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<RefundFormValues>({ resolver: zodResolver(schema), defaultValues: defaults });

  useEffect(() => {
    if (visible) reset(defaults);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, reset]);

  return (
    <FormModal
      visible={visible}
      title="Émettre un remboursement"
      onClose={onClose}
      onSubmit={handleSubmit(onSubmit)}
      submitting={submitting}
      submitLabel="Rembourser">
      <Text style={styles.maxHint}>Montant encaissé disponible : {maxRefundable} MAD</Text>
      <Controller
        control={control}
        name="amount"
        render={({ field }) => (
          <NumberField label="Montant à rembourser (MAD)" value={field.value} onChangeValue={(v) => field.onChange(v ?? 0)} error={errors.amount?.message} />
        )}
      />
      <Controller
        control={control}
        name="method"
        render={({ field }) => (
          <SelectField label="Moyen de remboursement" value={field.value} options={PAYMENT_METHOD_OPTIONS} onChange={field.onChange} error={errors.method?.message} />
        )}
      />
      <Controller
        control={control}
        name="isDepositRelease"
        render={({ field }) => (
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Libération d&apos;acompte (pas un remboursement client)</Text>
            <Switch value={field.value} onValueChange={field.onChange} trackColor={{ true: AmkouyColors.primary }} />
          </View>
        )}
      />
      <Controller
        control={control}
        name="notes"
        render={({ field }) => <FormField label="Motif / notes" value={field.value ?? ''} onChangeText={field.onChange} multiline />}
      />
    </FormModal>
  );
}

const styles = StyleSheet.create({
  maxHint: {
    ...robotoText(500, 11.5, { color: AmkouyColors.textFaint, marginBottom: 8 }),
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 18,
    gap: 10,
  },
  toggleLabel: {
    flex: 1,
    ...robotoText(500, 12.5, { color: AmkouyColors.text }),
  },
});

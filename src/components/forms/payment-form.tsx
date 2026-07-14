import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { Text } from 'react-native';

import { FormField } from '@/components/amkouy/form-field';
import { FormModal } from '@/components/amkouy/form-modal';
import { NumberField } from '@/components/amkouy/number-field';
import { SelectField } from '@/components/amkouy/select-field';
import { AmkouyColors } from '@/constants/amkouy-theme';
import { robotoText } from '@/constants/typography';
import { createPaymentSchema, PAYMENT_METHOD_OPTIONS, PAYMENT_TYPE_OPTIONS, PaymentFormValues } from '@/lib/validation/payment';

const DEFAULTS: PaymentFormValues = {
  type: 'deposit_hold',
  amount: 0,
  method: 'cash',
  gatewayReference: '',
};

export function PaymentForm({
  visible,
  maxAmount,
  onClose,
  onSubmit,
  submitting,
}: {
  visible: boolean;
  /** Reservation's current outstanding balance — CB-06, caps this form the same way
   * `RefundForm`'s `maxRefundable` already caps refunds. */
  maxAmount: number;
  onClose: () => void;
  onSubmit: (values: PaymentFormValues) => void;
  submitting: boolean;
}) {
  const schema = createPaymentSchema(maxAmount);
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PaymentFormValues>({ resolver: zodResolver(schema), defaultValues: DEFAULTS });

  useEffect(() => {
    if (visible) reset(DEFAULTS);
  }, [visible, reset]);

  return (
    <FormModal
      visible={visible}
      title="Enregistrer un paiement"
      onClose={onClose}
      onSubmit={handleSubmit(onSubmit)}
      submitting={submitting}
      submitLabel="Enregistrer">
      <Text style={{ ...robotoText(500, 11.5, { color: AmkouyColors.textFaint, marginBottom: 8 }) }}>
        Solde restant dû : {maxAmount} MAD
      </Text>
      <Controller
        control={control}
        name="type"
        render={({ field }) => (
          <SelectField label="Type" value={field.value} options={PAYMENT_TYPE_OPTIONS} onChange={field.onChange} />
        )}
      />
      <Controller
        control={control}
        name="amount"
        render={({ field }) => (
          <NumberField label="Montant (MAD)" value={field.value} onChangeValue={(v) => field.onChange(v ?? 0)} error={errors.amount?.message} />
        )}
      />
      <Controller
        control={control}
        name="method"
        render={({ field }) => (
          <SelectField label="Moyen de paiement" value={field.value} options={PAYMENT_METHOD_OPTIONS} onChange={field.onChange} error={errors.method?.message} />
        )}
      />
      <Controller
        control={control}
        name="gatewayReference"
        render={({ field }) => (
          <FormField label="Référence (optionnel)" value={field.value ?? ''} onChangeText={field.onChange} />
        )}
      />
    </FormModal>
  );
}

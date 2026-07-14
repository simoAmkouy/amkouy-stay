import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { FormField } from '@/components/amkouy/form-field';
import { FormModal } from '@/components/amkouy/form-modal';
import { SelectField } from '@/components/amkouy/select-field';
import { MarkAsPaidValues, markAsPaidSchema, PAYOUT_METHOD_OPTIONS } from '@/lib/validation/owner-payment';

const DEFAULTS: MarkAsPaidValues = {
  paidAt: new Date().toISOString().slice(0, 10),
  paymentMethod: 'bank_transfer',
  paymentReference: '',
};

export function MarkPaidForm({
  visible,
  onClose,
  onSubmit,
  submitting,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (values: MarkAsPaidValues) => void;
  submitting: boolean;
}) {
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<MarkAsPaidValues>({
    resolver: zodResolver(markAsPaidSchema),
    defaultValues: DEFAULTS,
  });

  useEffect(() => {
    if (visible) reset(DEFAULTS);
  }, [visible, reset]);

  return (
    <FormModal
      visible={visible}
      title="Marquer comme payé"
      onClose={onClose}
      onSubmit={handleSubmit(onSubmit)}
      submitting={submitting}
      submitLabel="Confirmer le paiement">
      <Controller
        control={control}
        name="paidAt"
        render={({ field }) => (
          <FormField
            label="Date de paiement (AAAA-MM-JJ)"
            value={field.value}
            onChangeText={field.onChange}
            error={errors.paidAt?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="paymentMethod"
        render={({ field }) => (
          <SelectField
            label="Moyen de paiement"
            value={field.value}
            options={PAYOUT_METHOD_OPTIONS}
            onChange={field.onChange}
            error={errors.paymentMethod?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="paymentReference"
        render={({ field }) => (
          <FormField
            label="N° de référence"
            value={field.value ?? ''}
            onChangeText={field.onChange}
            error={errors.paymentReference?.message}
          />
        )}
      />
    </FormModal>
  );
}

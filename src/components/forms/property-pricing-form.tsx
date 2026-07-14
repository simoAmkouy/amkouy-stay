import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';

import { NumberField } from '@/components/amkouy/number-field';
import { FormModal } from '@/components/amkouy/form-modal';

const schema = z.object({
  baseNightlyRate: z.number().positive('Doit être positif.'),
  cleaningFee: z.number().min(0),
  defaultSecurityDepositAmount: z.number().min(0),
  minStayNights: z.number().int().min(1),
});

export type PropertyPricingFormValues = z.infer<typeof schema>;

export function PropertyPricingForm({
  visible,
  initialValues,
  onClose,
  onSubmit,
  submitting,
}: {
  visible: boolean;
  initialValues?: Partial<PropertyPricingFormValues>;
  onClose: () => void;
  onSubmit: (values: PropertyPricingFormValues) => void;
  submitting: boolean;
}) {
  const defaults: PropertyPricingFormValues = { baseNightlyRate: 0, cleaningFee: 0, defaultSecurityDepositAmount: 0, minStayNights: 1 };
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PropertyPricingFormValues>({ resolver: zodResolver(schema), defaultValues: defaults });

  useEffect(() => {
    if (visible) reset({ ...defaults, ...initialValues });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, initialValues, reset]);

  return (
    <FormModal visible={visible} title="Configurer la tarification" onClose={onClose} onSubmit={handleSubmit(onSubmit)} submitting={submitting} submitLabel="Enregistrer">
      <Controller control={control} name="baseNightlyRate" render={({ field }) => <NumberField label="Tarif de base / nuit (MAD)" value={field.value} onChangeValue={(v) => field.onChange(v ?? 0)} error={errors.baseNightlyRate?.message} />} />
      <Controller control={control} name="cleaningFee" render={({ field }) => <NumberField label="Frais de ménage (MAD)" value={field.value} onChangeValue={(v) => field.onChange(v ?? 0)} />} />
      <Controller control={control} name="defaultSecurityDepositAmount" render={({ field }) => <NumberField label="Caution par défaut (MAD)" value={field.value} onChangeValue={(v) => field.onChange(v ?? 0)} />} />
      <Controller control={control} name="minStayNights" render={({ field }) => <NumberField label="Séjour minimum (nuits)" value={field.value} onChangeValue={(v) => field.onChange(v ?? 1)} />} />
    </FormModal>
  );
}

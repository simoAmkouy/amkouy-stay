import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { FormField } from '@/components/amkouy/form-field';
import { FormModal } from '@/components/amkouy/form-modal';
import { GenerateSettlementsValues, generateSettlementsSchema } from '@/lib/validation/owner-payment';

function defaultMonthRange(): GenerateSettlementsValues {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { periodStart: start.toISOString().slice(0, 10), periodEnd: end.toISOString().slice(0, 10) };
}

export function GenerateSettlementsForm({
  visible,
  onClose,
  onSubmit,
  submitting,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (values: GenerateSettlementsValues) => void;
  submitting: boolean;
}) {
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<GenerateSettlementsValues>({
    resolver: zodResolver(generateSettlementsSchema),
    defaultValues: defaultMonthRange(),
  });

  useEffect(() => {
    if (visible) reset(defaultMonthRange());
  }, [visible, reset]);

  return (
    <FormModal
      visible={visible}
      title="Générer les versements"
      onClose={onClose}
      onSubmit={handleSubmit(onSubmit)}
      submitting={submitting}
      submitLabel="Générer">
      <Controller
        control={control}
        name="periodStart"
        render={({ field }) => (
          <FormField
            label="Début de période (AAAA-MM-JJ)"
            value={field.value}
            onChangeText={field.onChange}
            error={errors.periodStart?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="periodEnd"
        render={({ field }) => (
          <FormField
            label="Fin de période (AAAA-MM-JJ)"
            value={field.value}
            onChangeText={field.onChange}
            error={errors.periodEnd?.message}
          />
        )}
      />
    </FormModal>
  );
}

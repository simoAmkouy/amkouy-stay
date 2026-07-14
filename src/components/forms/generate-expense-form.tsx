import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { FormField } from '@/components/amkouy/form-field';
import { FormModal } from '@/components/amkouy/form-modal';
import { NumberField } from '@/components/amkouy/number-field';
import { GenerateExpenseValues, generateExpenseSchema } from '@/lib/validation/maintenance-ticket';

export function GenerateExpenseForm({
  visible,
  initialValues,
  onClose,
  onSubmit,
  submitting,
}: {
  visible: boolean;
  initialValues: GenerateExpenseValues;
  onClose: () => void;
  onSubmit: (values: GenerateExpenseValues) => void;
  submitting: boolean;
}) {
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<GenerateExpenseValues>({
    resolver: zodResolver(generateExpenseSchema),
    defaultValues: initialValues,
  });

  useEffect(() => {
    if (visible) reset(initialValues);
  }, [visible, initialValues, reset]);

  return (
    <FormModal
      visible={visible}
      title="Générer une dépense"
      onClose={onClose}
      onSubmit={handleSubmit(onSubmit)}
      submitting={submitting}
      submitLabel="Créer la dépense">
      <Controller
        control={control}
        name="amount"
        render={({ field }) => (
          <NumberField
            label="Montant (MAD)"
            value={field.value}
            onChangeValue={(v) => field.onChange(v ?? 0)}
            error={errors.amount?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="description"
        render={({ field }) => (
          <FormField
            label="Description"
            value={field.value}
            onChangeText={field.onChange}
            multiline
            error={errors.description?.message}
          />
        )}
      />
    </FormModal>
  );
}

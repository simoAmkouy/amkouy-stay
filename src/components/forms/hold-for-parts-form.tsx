import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { FormField } from '@/components/amkouy/form-field';
import { FormModal } from '@/components/amkouy/form-modal';
import { HoldForPartsValues, holdForPartsSchema } from '@/lib/validation/maintenance-ticket';

const DEFAULTS: HoldForPartsValues = { notes: '' };

export function HoldForPartsForm({
  visible,
  onClose,
  onSubmit,
  submitting,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (values: HoldForPartsValues) => void;
  submitting: boolean;
}) {
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<HoldForPartsValues>({
    resolver: zodResolver(holdForPartsSchema),
    defaultValues: DEFAULTS,
  });

  useEffect(() => {
    if (visible) reset(DEFAULTS);
  }, [visible, reset]);

  return (
    <FormModal
      visible={visible}
      title="Mettre en attente de pièces"
      onClose={onClose}
      onSubmit={handleSubmit(onSubmit)}
      submitting={submitting}
      submitLabel="Confirmer">
      <Controller
        control={control}
        name="notes"
        render={({ field }) => (
          <FormField
            label="Pièces attendues"
            value={field.value}
            onChangeText={field.onChange}
            multiline
            error={errors.notes?.message}
          />
        )}
      />
    </FormModal>
  );
}

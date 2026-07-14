import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { FormField } from '@/components/amkouy/form-field';
import { FormModal } from '@/components/amkouy/form-modal';
import { CompleteTaskValues, completeTaskSchema } from '@/lib/validation/cleaning-task';

const DEFAULTS: CompleteTaskValues = { notes: '' };

export function CompleteTaskForm({
  visible,
  onClose,
  onSubmit,
  submitting,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (values: CompleteTaskValues) => void;
  submitting: boolean;
}) {
  const {
    control,
    handleSubmit,
    reset,
  } = useForm<CompleteTaskValues>({
    resolver: zodResolver(completeTaskSchema),
    defaultValues: DEFAULTS,
  });

  useEffect(() => {
    if (visible) reset(DEFAULTS);
  }, [visible, reset]);

  return (
    <FormModal
      visible={visible}
      title="Marquer comme terminé"
      onClose={onClose}
      onSubmit={handleSubmit(onSubmit)}
      submitting={submitting}
      submitLabel="Confirmer">
      <Controller
        control={control}
        name="notes"
        render={({ field }) => (
          <FormField
            label="Notes de fin de tâche (optionnel)"
            value={field.value ?? ''}
            onChangeText={field.onChange}
            multiline
          />
        )}
      />
    </FormModal>
  );
}

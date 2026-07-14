import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { FormField } from '@/components/amkouy/form-field';
import { FormModal } from '@/components/amkouy/form-modal';
import { NumberField } from '@/components/amkouy/number-field';
import { CompleteTicketValues, completeTicketSchema } from '@/lib/validation/maintenance-ticket';

const DEFAULTS: CompleteTicketValues = { actualCost: null, notes: '' };

export function CompleteTicketForm({
  visible,
  onClose,
  onSubmit,
  submitting,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (values: CompleteTicketValues) => void;
  submitting: boolean;
}) {
  const { control, handleSubmit, reset } = useForm<CompleteTicketValues>({
    resolver: zodResolver(completeTicketSchema),
    defaultValues: DEFAULTS,
  });

  useEffect(() => {
    if (visible) reset(DEFAULTS);
  }, [visible, reset]);

  return (
    <FormModal
      visible={visible}
      title="Marquer la réparation terminée"
      onClose={onClose}
      onSubmit={handleSubmit(onSubmit)}
      submitting={submitting}
      submitLabel="Confirmer">
      <Controller
        control={control}
        name="actualCost"
        render={({ field }) => (
          <NumberField
            label="Coût réel (MAD)"
            value={field.value ?? undefined}
            onChangeValue={(v) => field.onChange(v ?? null)}
          />
        )}
      />
      <Controller
        control={control}
        name="notes"
        render={({ field }) => (
          <FormField label="Notes de réparation" value={field.value ?? ''} onChangeText={field.onChange} multiline />
        )}
      />
    </FormModal>
  );
}

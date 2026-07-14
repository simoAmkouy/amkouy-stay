import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { FormField } from '@/components/amkouy/form-field';
import { FormModal } from '@/components/amkouy/form-modal';
import { SelectField } from '@/components/amkouy/select-field';
import {
  ESCALATION_REASON_OPTIONS,
  EscalateTicketValues,
  MAINTENANCE_PRIORITY_OPTIONS,
  escalateTicketSchema,
} from '@/lib/validation/maintenance-ticket';

const DEFAULTS: EscalateTicketValues = {
  reason: 'other',
  reasonLabel: '',
  description: '',
  priority: 'normal',
};

export function EscalateTicketForm({
  visible,
  onClose,
  onSubmit,
  submitting,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (values: EscalateTicketValues) => void;
  submitting: boolean;
}) {
  const {
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<EscalateTicketValues>({
    resolver: zodResolver(escalateTicketSchema),
    defaultValues: DEFAULTS,
  });

  useEffect(() => {
    if (visible) reset(DEFAULTS);
  }, [visible, reset]);

  return (
    <FormModal
      visible={visible}
      title="Signaler un problème"
      onClose={onClose}
      onSubmit={handleSubmit(onSubmit)}
      submitting={submitting}
      submitLabel="Créer le ticket">
      <Controller
        control={control}
        name="reason"
        render={({ field }) => (
          <SelectField
            label="Motif"
            value={field.value}
            options={ESCALATION_REASON_OPTIONS}
            onChange={(value) => {
              field.onChange(value);
              const option = ESCALATION_REASON_OPTIONS.find((o) => o.value === value);
              setValue('reasonLabel', option?.label ?? '');
            }}
            error={errors.reason?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="description"
        render={({ field }) => (
          <FormField
            label="Décrivez ce que vous avez constaté"
            value={field.value}
            onChangeText={field.onChange}
            multiline
            error={errors.description?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="priority"
        render={({ field }) => (
          <SelectField label="Priorité" value={field.value} options={MAINTENANCE_PRIORITY_OPTIONS} onChange={field.onChange} />
        )}
      />
    </FormModal>
  );
}

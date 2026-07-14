import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { FormModal } from '@/components/amkouy/form-modal';
import { SelectField } from '@/components/amkouy/select-field';
import { useCleaners } from '@/hooks/use-cleaning-tasks';
import { AssignCleanerValues, assignCleanerSchema } from '@/lib/validation/cleaning-task';

const DEFAULTS: AssignCleanerValues = { assignedToUserId: '' };

export function AssignCleanerForm({
  visible,
  onClose,
  onSubmit,
  submitting,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (values: AssignCleanerValues) => void;
  submitting: boolean;
}) {
  const { data: cleaners } = useCleaners();
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AssignCleanerValues>({
    resolver: zodResolver(assignCleanerSchema),
    defaultValues: DEFAULTS,
  });

  useEffect(() => {
    if (visible) reset(DEFAULTS);
  }, [visible, reset]);

  const cleanerOptions = (cleaners ?? []).map((c) => ({ label: c.full_name, value: c.id }));

  return (
    <FormModal
      visible={visible}
      title="Assigner un agent de ménage"
      onClose={onClose}
      onSubmit={handleSubmit(onSubmit)}
      submitting={submitting}
      submitLabel="Assigner">
      <Controller
        control={control}
        name="assignedToUserId"
        render={({ field }) => (
          <SelectField
            label="Agent de ménage"
            value={field.value || null}
            options={cleanerOptions}
            onChange={field.onChange}
            error={errors.assignedToUserId?.message}
          />
        )}
      />
    </FormModal>
  );
}

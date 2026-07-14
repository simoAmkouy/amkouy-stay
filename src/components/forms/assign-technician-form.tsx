import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { FormModal } from '@/components/amkouy/form-modal';
import { SelectField } from '@/components/amkouy/select-field';
import { useTechnicians } from '@/hooks/use-maintenance-tickets';
import { AssignTechnicianValues, assignTechnicianSchema } from '@/lib/validation/maintenance-ticket';

const DEFAULTS: AssignTechnicianValues = { assignedToUserId: '' };

export function AssignTechnicianForm({
  visible,
  onClose,
  onSubmit,
  submitting,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (values: AssignTechnicianValues) => void;
  submitting: boolean;
}) {
  const { data: technicians } = useTechnicians();
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AssignTechnicianValues>({
    resolver: zodResolver(assignTechnicianSchema),
    defaultValues: DEFAULTS,
  });

  useEffect(() => {
    if (visible) reset(DEFAULTS);
  }, [visible, reset]);

  const technicianOptions = (technicians ?? []).map((t) => ({ label: t.full_name, value: t.id }));

  return (
    <FormModal
      visible={visible}
      title="Assigner un technicien"
      onClose={onClose}
      onSubmit={handleSubmit(onSubmit)}
      submitting={submitting}
      submitLabel="Assigner">
      <Controller
        control={control}
        name="assignedToUserId"
        render={({ field }) => (
          <SelectField
            label="Technicien"
            value={field.value || null}
            options={technicianOptions}
            onChange={field.onChange}
            error={errors.assignedToUserId?.message}
          />
        )}
      />
    </FormModal>
  );
}

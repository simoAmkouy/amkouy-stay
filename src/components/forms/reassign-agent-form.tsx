import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { FormModal } from '@/components/amkouy/form-modal';
import { SelectField } from '@/components/amkouy/select-field';
import { useUsersByRole } from '@/hooks/use-users';

type ReassignAgentValues = { newAgentId: string | null };

export function ReassignAgentForm({
  visible,
  currentAgentId,
  onClose,
  onSubmit,
  submitting,
}: {
  visible: boolean;
  currentAgentId: string | null;
  onClose: () => void;
  onSubmit: (newAgentId: string) => void;
  submitting: boolean;
}) {
  const { data: agents } = useUsersByRole('commercial_agent');
  const { control, handleSubmit, reset } = useForm<ReassignAgentValues>({
    defaultValues: { newAgentId: currentAgentId },
  });

  useEffect(() => {
    if (visible) reset({ newAgentId: currentAgentId });
  }, [visible, currentAgentId, reset]);

  const agentOptions = (agents ?? []).map((a) => ({ label: a.full_name, value: a.id }));

  const submit = handleSubmit((values) => {
    if (values.newAgentId) onSubmit(values.newAgentId);
  });

  return (
    <FormModal
      visible={visible}
      title="Réassigner l'agent"
      onClose={onClose}
      onSubmit={submit}
      submitting={submitting}
      submitLabel="Confirmer le transfert">
      <Controller
        control={control}
        name="newAgentId"
        render={({ field }) => (
          <SelectField
            label="Nouvel agent"
            value={field.value}
            options={agentOptions}
            onChange={field.onChange}
            placeholder="Sélectionner un agent"
          />
        )}
      />
    </FormModal>
  );
}

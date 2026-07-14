import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { FormModal } from '@/components/amkouy/form-modal';
import { SelectField } from '@/components/amkouy/select-field';
import { useServiceProviders } from '@/hooks/use-service-providers';
import { AssignServiceProviderValues, assignServiceProviderSchema } from '@/lib/validation/reservation-service';

const DEFAULTS: AssignServiceProviderValues = { providerId: '' };

export function AssignServiceProviderForm({
  visible,
  onClose,
  onSubmit,
  submitting,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (values: AssignServiceProviderValues) => void;
  submitting: boolean;
}) {
  const { data: providers } = useServiceProviders();
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AssignServiceProviderValues>({
    resolver: zodResolver(assignServiceProviderSchema),
    defaultValues: DEFAULTS,
  });

  useEffect(() => {
    if (visible) reset(DEFAULTS);
  }, [visible, reset]);

  const providerOptions = (providers ?? [])
    .filter((p) => p.status === 'active')
    .map((p) => ({ label: p.name, value: p.id }));

  return (
    <FormModal
      visible={visible}
      title="Assigner un prestataire"
      onClose={onClose}
      onSubmit={handleSubmit(onSubmit)}
      submitting={submitting}
      submitLabel="Assigner">
      <Controller
        control={control}
        name="providerId"
        render={({ field }) => (
          <SelectField
            label="Prestataire"
            value={field.value || null}
            options={providerOptions}
            onChange={field.onChange}
            error={errors.providerId?.message}
          />
        )}
      />
    </FormModal>
  );
}

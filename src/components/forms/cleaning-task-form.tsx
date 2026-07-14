import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { View } from 'react-native';

import { FormField } from '@/components/amkouy/form-field';
import { FormModal } from '@/components/amkouy/form-modal';
import { NumberField } from '@/components/amkouy/number-field';
import { SelectField } from '@/components/amkouy/select-field';
import { useCleaners } from '@/hooks/use-cleaning-tasks';
import { useProperties } from '@/hooks/use-properties';
import { CleaningTaskCreateValues, cleaningTaskCreateSchema } from '@/lib/validation/cleaning-task';

const DEFAULTS: CleaningTaskCreateValues = {
  propertyId: '',
  scheduledDate: '',
  assignedToUserId: null,
  estimatedDurationMinutes: null,
  notes: '',
};

export function CleaningTaskForm({
  visible,
  onClose,
  onSubmit,
  submitting,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (values: CleaningTaskCreateValues) => void;
  submitting: boolean;
}) {
  const { data: properties } = useProperties();
  const { data: cleaners } = useCleaners();
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CleaningTaskCreateValues>({
    resolver: zodResolver(cleaningTaskCreateSchema),
    defaultValues: DEFAULTS,
  });

  useEffect(() => {
    if (visible) reset(DEFAULTS);
  }, [visible, reset]);

  const propertyOptions = (properties ?? []).map((p) => ({ label: `${p.name} · ${p.city}`, value: p.id }));
  const cleanerOptions = (cleaners ?? []).map((c) => ({ label: c.full_name, value: c.id }));

  return (
    <FormModal
      visible={visible}
      title="Nouvelle tâche de ménage"
      onClose={onClose}
      onSubmit={handleSubmit(onSubmit)}
      submitting={submitting}
      submitLabel="Créer la tâche">
      <Controller
        control={control}
        name="propertyId"
        render={({ field }) => (
          <SelectField
            label="Bien"
            value={field.value || null}
            options={propertyOptions}
            onChange={field.onChange}
            error={errors.propertyId?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="scheduledDate"
        render={({ field }) => (
          <FormField
            label="Date prévue (AAAA-MM-JJ)"
            value={field.value}
            onChangeText={field.onChange}
            placeholder="2026-07-04"
            error={errors.scheduledDate?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="assignedToUserId"
        render={({ field }) => (
          <SelectField
            label="Agent de ménage"
            value={field.value}
            options={cleanerOptions}
            onChange={field.onChange}
            placeholder="Non assigné"
          />
        )}
      />
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Controller
            control={control}
            name="estimatedDurationMinutes"
            render={({ field }) => (
              <NumberField
                label="Durée estimée (min)"
                value={field.value ?? undefined}
                onChangeValue={(v) => field.onChange(v ?? null)}
              />
            )}
          />
        </View>
      </View>
      <Controller
        control={control}
        name="notes"
        render={({ field }) => (
          <FormField label="Notes" value={field.value ?? ''} onChangeText={field.onChange} multiline />
        )}
      />
    </FormModal>
  );
}

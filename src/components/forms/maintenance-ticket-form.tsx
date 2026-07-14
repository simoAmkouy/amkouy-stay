import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { View } from 'react-native';

import { FormField } from '@/components/amkouy/form-field';
import { FormModal } from '@/components/amkouy/form-modal';
import { NumberField } from '@/components/amkouy/number-field';
import { SelectField } from '@/components/amkouy/select-field';
import { useProperties } from '@/hooks/use-properties';
import {
  MAINTENANCE_CATEGORY_OPTIONS,
  MAINTENANCE_PRIORITY_OPTIONS,
  MaintenanceTicketCreateValues,
  maintenanceTicketCreateSchema,
} from '@/lib/validation/maintenance-ticket';

const DEFAULTS: MaintenanceTicketCreateValues = {
  propertyId: '',
  category: 'other',
  priority: 'normal',
  issueSummary: '',
  description: '',
  scheduledDate: '',
  estimatedCost: null,
};

export function MaintenanceTicketForm({
  visible,
  onClose,
  onSubmit,
  submitting,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (values: MaintenanceTicketCreateValues) => void;
  submitting: boolean;
}) {
  const { data: properties } = useProperties();
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<MaintenanceTicketCreateValues>({
    resolver: zodResolver(maintenanceTicketCreateSchema),
    defaultValues: DEFAULTS,
  });

  useEffect(() => {
    if (visible) reset(DEFAULTS);
  }, [visible, reset]);

  const propertyOptions = (properties ?? []).map((p) => ({ label: `${p.name} · ${p.city}`, value: p.id }));

  return (
    <FormModal
      visible={visible}
      title="Nouveau ticket de maintenance"
      onClose={onClose}
      onSubmit={handleSubmit(onSubmit)}
      submitting={submitting}
      submitLabel="Créer le ticket">
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
        name="issueSummary"
        render={({ field }) => (
          <FormField
            label="Problème"
            value={field.value}
            onChangeText={field.onChange}
            error={errors.issueSummary?.message}
          />
        )}
      />
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Controller
            control={control}
            name="category"
            render={({ field }) => (
              <SelectField
                label="Catégorie"
                value={field.value}
                options={MAINTENANCE_CATEGORY_OPTIONS}
                onChange={field.onChange}
              />
            )}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Controller
            control={control}
            name="priority"
            render={({ field }) => (
              <SelectField
                label="Priorité"
                value={field.value}
                options={MAINTENANCE_PRIORITY_OPTIONS}
                onChange={field.onChange}
              />
            )}
          />
        </View>
      </View>
      <Controller
        control={control}
        name="description"
        render={({ field }) => (
          <FormField label="Description détaillée" value={field.value ?? ''} onChangeText={field.onChange} multiline />
        )}
      />
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Controller
            control={control}
            name="scheduledDate"
            render={({ field }) => (
              <FormField
                label="Date prévue (AAAA-MM-JJ)"
                value={field.value ?? ''}
                onChangeText={field.onChange}
                placeholder="2026-07-04"
              />
            )}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Controller
            control={control}
            name="estimatedCost"
            render={({ field }) => (
              <NumberField
                label="Coût estimé (MAD)"
                value={field.value ?? undefined}
                onChangeValue={(v) => field.onChange(v ?? null)}
              />
            )}
          />
        </View>
      </View>
    </FormModal>
  );
}

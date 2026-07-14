import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { View } from 'react-native';

import { FormField } from '@/components/amkouy/form-field';
import { FormModal } from '@/components/amkouy/form-modal';
import { NumberField } from '@/components/amkouy/number-field';
import { SelectField } from '@/components/amkouy/select-field';
import { useOwners } from '@/hooks/use-owners';
import { useUsersByRole } from '@/hooks/use-users';
import {
  PROPERTY_STATUS_OPTIONS,
  PROPERTY_TYPE_OPTIONS,
  PropertyFormValues,
  propertyFormSchema,
} from '@/lib/validation/property';

const DEFAULTS: PropertyFormValues = {
  name: '',
  propertyType: 'apartment',
  status: 'onboarding',
  city: '',
  addressLine: '',
  bedrooms: undefined,
  bathrooms: undefined,
  maxGuests: undefined,
  baseNightlyRate: undefined,
  cleaningFee: 0,
  ownerId: null,
  assignedManagerId: null,
  defaultCleanerId: null,
  acquiredByAgent: null,
};

export function PropertyForm({
  visible,
  mode,
  initialValues,
  onClose,
  onSubmit,
  submitting,
}: {
  visible: boolean;
  mode: 'create' | 'edit';
  initialValues?: Partial<PropertyFormValues>;
  onClose: () => void;
  onSubmit: (values: PropertyFormValues) => void;
  submitting: boolean;
}) {
  const { data: owners } = useOwners();
  const { data: managers } = useUsersByRole('manager');
  const { data: cleaners } = useUsersByRole('cleaner');
  const { data: agents } = useUsersByRole('commercial_agent');
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PropertyFormValues>({
    resolver: zodResolver(propertyFormSchema),
    defaultValues: DEFAULTS,
  });

  useEffect(() => {
    if (visible) reset({ ...DEFAULTS, ...initialValues });
  }, [visible, initialValues, reset]);

  const ownerOptions = (owners ?? []).map((o) => ({ label: o.full_name, value: o.id }));
  const managerOptions = (managers ?? []).map((m) => ({ label: m.full_name, value: m.id }));
  const cleanerOptions = (cleaners ?? []).map((c) => ({ label: c.full_name, value: c.id }));
  const agentOptions = (agents ?? []).map((a) => ({ label: a.full_name, value: a.id }));

  return (
    <FormModal
      visible={visible}
      title={mode === 'create' ? 'Nouveau bien' : 'Modifier le bien'}
      onClose={onClose}
      onSubmit={handleSubmit(onSubmit)}
      submitting={submitting}
      submitLabel={mode === 'create' ? 'Créer le bien' : 'Enregistrer'}>
      <Controller
        control={control}
        name="name"
        render={({ field }) => (
          <FormField
            label="Nom du bien"
            value={field.value}
            onChangeText={field.onChange}
            error={errors.name?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="city"
        render={({ field }) => (
          <FormField
            label="Ville"
            value={field.value}
            onChangeText={field.onChange}
            error={errors.city?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="addressLine"
        render={({ field }) => (
          <FormField label="Adresse" value={field.value ?? ''} onChangeText={field.onChange} />
        )}
      />
      <Controller
        control={control}
        name="propertyType"
        render={({ field }) => (
          <SelectField
            label="Type de bien"
            value={field.value}
            options={PROPERTY_TYPE_OPTIONS}
            onChange={field.onChange}
          />
        )}
      />
      <Controller
        control={control}
        name="status"
        render={({ field }) => (
          <SelectField
            label="Statut"
            value={field.value}
            options={PROPERTY_STATUS_OPTIONS}
            onChange={field.onChange}
          />
        )}
      />
      <Controller
        control={control}
        name="ownerId"
        render={({ field }) => (
          <SelectField
            label="Propriétaire"
            value={field.value}
            options={ownerOptions}
            onChange={field.onChange}
            placeholder="Aucun propriétaire assigné"
          />
        )}
      />
      <Controller
        control={control}
        name="assignedManagerId"
        render={({ field }) => (
          <SelectField
            label="Responsable assigné"
            value={field.value}
            options={managerOptions}
            onChange={field.onChange}
            placeholder="Aucun responsable assigné"
          />
        )}
      />
      <Controller
        control={control}
        name="defaultCleanerId"
        render={({ field }) => (
          <SelectField
            label="Agent de ménage par défaut"
            value={field.value}
            options={cleanerOptions}
            onChange={field.onChange}
            placeholder="Aucun agent de ménage assigné"
          />
        )}
      />
      <Controller
        control={control}
        name="acquiredByAgent"
        render={({ field }) => (
          <SelectField
            label="Acquis par (agent commercial)"
            value={field.value}
            options={agentOptions}
            onChange={field.onChange}
            placeholder="Aucun agent"
          />
        )}
      />
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Controller
            control={control}
            name="bedrooms"
            render={({ field }) => (
              <NumberField
                label="Chambres"
                value={field.value}
                onChangeValue={field.onChange}
                error={errors.bedrooms?.message}
              />
            )}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Controller
            control={control}
            name="bathrooms"
            render={({ field }) => (
              <NumberField
                label="Salles de bain"
                value={field.value}
                onChangeValue={field.onChange}
                error={errors.bathrooms?.message}
              />
            )}
          />
        </View>
      </View>
      <Controller
        control={control}
        name="maxGuests"
        render={({ field }) => (
          <NumberField
            label="Capacité (voyageurs)"
            value={field.value}
            onChangeValue={field.onChange}
            error={errors.maxGuests?.message}
          />
        )}
      />
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Controller
            control={control}
            name="baseNightlyRate"
            render={({ field }) => (
              <NumberField
                label="Tarif/nuit (MAD)"
                value={field.value}
                onChangeValue={field.onChange}
                error={errors.baseNightlyRate?.message}
              />
            )}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Controller
            control={control}
            name="cleaningFee"
            render={({ field }) => (
              <NumberField
                label="Frais de ménage (MAD)"
                value={field.value}
                onChangeValue={(v) => field.onChange(v ?? 0)}
                error={errors.cleaningFee?.message}
              />
            )}
          />
        </View>
      </View>
    </FormModal>
  );
}

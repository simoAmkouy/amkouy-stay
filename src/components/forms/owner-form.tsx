import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { View } from 'react-native';

import { FormField } from '@/components/amkouy/form-field';
import { FormModal } from '@/components/amkouy/form-modal';
import { SelectField } from '@/components/amkouy/select-field';
import { OWNER_STATUS_OPTIONS, OwnerFormValues, ownerFormSchema } from '@/lib/validation/owner';

const DEFAULTS: OwnerFormValues = {
  fullName: '',
  companyName: '',
  email: '',
  phone: '',
  status: 'prospect',
  bankName: '',
  bankIban: '',
  notes: '',
};

export function OwnerForm({
  visible,
  mode,
  initialValues,
  onClose,
  onSubmit,
  submitting,
}: {
  visible: boolean;
  mode: 'create' | 'edit';
  initialValues?: Partial<OwnerFormValues>;
  onClose: () => void;
  onSubmit: (values: OwnerFormValues) => void;
  submitting: boolean;
}) {
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<OwnerFormValues>({
    resolver: zodResolver(ownerFormSchema),
    defaultValues: DEFAULTS,
  });

  useEffect(() => {
    if (visible) reset({ ...DEFAULTS, ...initialValues });
  }, [visible, initialValues, reset]);

  return (
    <FormModal
      visible={visible}
      title={mode === 'create' ? 'Nouveau propriétaire' : 'Modifier le propriétaire'}
      onClose={onClose}
      onSubmit={handleSubmit(onSubmit)}
      submitting={submitting}
      submitLabel={mode === 'create' ? 'Créer le propriétaire' : 'Enregistrer'}>
      <Controller
        control={control}
        name="fullName"
        render={({ field }) => (
          <FormField
            label="Nom complet"
            value={field.value}
            onChangeText={field.onChange}
            error={errors.fullName?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="companyName"
        render={({ field }) => (
          <FormField label="Société (optionnel)" value={field.value ?? ''} onChangeText={field.onChange} />
        )}
      />
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Controller
            control={control}
            name="email"
            render={({ field }) => (
              <FormField
                label="E-mail"
                value={field.value ?? ''}
                onChangeText={field.onChange}
                keyboardType="email-address"
                autoCapitalize="none"
                error={errors.email?.message}
              />
            )}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Controller
            control={control}
            name="phone"
            render={({ field }) => (
              <FormField
                label="Téléphone"
                value={field.value ?? ''}
                onChangeText={field.onChange}
                keyboardType="phone-pad"
                maxLength={20}
                error={errors.phone?.message}
              />
            )}
          />
        </View>
      </View>
      <Controller
        control={control}
        name="status"
        render={({ field }) => (
          <SelectField
            label="Statut"
            value={field.value}
            options={OWNER_STATUS_OPTIONS}
            onChange={field.onChange}
          />
        )}
      />
      <Controller
        control={control}
        name="bankName"
        render={({ field }) => (
          <FormField label="Banque" value={field.value ?? ''} onChangeText={field.onChange} />
        )}
      />
      <Controller
        control={control}
        name="bankIban"
        render={({ field }) => (
          <FormField label="RIB / IBAN" value={field.value ?? ''} onChangeText={field.onChange} />
        )}
      />
      <Controller
        control={control}
        name="notes"
        render={({ field }) => (
          <FormField
            label="Notes"
            value={field.value ?? ''}
            onChangeText={field.onChange}
            multiline
          />
        )}
      />
    </FormModal>
  );
}

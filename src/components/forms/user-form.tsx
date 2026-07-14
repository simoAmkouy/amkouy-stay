import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { FormField } from '@/components/amkouy/form-field';
import { FormModal } from '@/components/amkouy/form-modal';
import { SelectField } from '@/components/amkouy/select-field';
import { ASSIGNABLE_ROLE_OPTIONS, UserFormValues, userFormSchema } from '@/lib/validation/user';

const DEFAULTS: UserFormValues = { fullName: '', email: '', phone: '', role: 'cleaner' };

export function UserForm({
  visible,
  onClose,
  onSubmit,
  submitting,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (values: UserFormValues) => void;
  submitting: boolean;
}) {
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<UserFormValues>({ resolver: zodResolver(userFormSchema), defaultValues: DEFAULTS });

  useEffect(() => {
    if (visible) reset(DEFAULTS);
  }, [visible, reset]);

  return (
    <FormModal
      visible={visible}
      title="Nouveau membre de l'équipe"
      onClose={onClose}
      onSubmit={handleSubmit(onSubmit)}
      submitting={submitting}
      submitLabel="Créer et envoyer l'invitation">
      <Controller
        control={control}
        name="fullName"
        render={({ field }) => <FormField label="Nom complet" value={field.value} onChangeText={field.onChange} error={errors.fullName?.message} />}
      />
      <Controller
        control={control}
        name="email"
        render={({ field }) => (
          <FormField
            label="E-mail"
            value={field.value}
            onChangeText={field.onChange}
            keyboardType="email-address"
            autoCapitalize="none"
            error={errors.email?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="phone"
        render={({ field }) => (
          <FormField label="Téléphone (optionnel)" value={field.value ?? ''} onChangeText={field.onChange} keyboardType="phone-pad" maxLength={20} />
        )}
      />
      <Controller
        control={control}
        name="role"
        render={({ field }) => <SelectField label="Rôle" value={field.value} options={ASSIGNABLE_ROLE_OPTIONS} onChange={field.onChange} error={errors.role?.message} />}
      />
    </FormModal>
  );
}

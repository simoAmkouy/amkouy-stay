import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FormField } from '@/components/amkouy/form-field';
import { FormModal } from '@/components/amkouy/form-modal';
import { SelectField } from '@/components/amkouy/select-field';
import { AmkouyColors } from '@/constants/amkouy-theme';
import { robotoText } from '@/constants/typography';
import {
  PROVIDER_STATUS_OPTIONS,
  SERVICE_CATEGORY_OPTIONS,
  ServiceProviderFormValues,
  serviceProviderFormSchema,
} from '@/lib/validation/service-provider';

const DEFAULTS: ServiceProviderFormValues = {
  name: '',
  companyName: '',
  phone: '',
  email: '',
  serviceCategories: [],
  pricingAgreement: '',
  internalNotes: '',
  status: 'active',
};

export function ServiceProviderForm({
  visible,
  mode,
  initialValues,
  onClose,
  onSubmit,
  submitting,
}: {
  visible: boolean;
  mode: 'create' | 'edit';
  initialValues?: Partial<ServiceProviderFormValues>;
  onClose: () => void;
  onSubmit: (values: ServiceProviderFormValues) => void;
  submitting: boolean;
}) {
  const {
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<ServiceProviderFormValues>({
    resolver: zodResolver(serviceProviderFormSchema),
    defaultValues: DEFAULTS,
  });

  useEffect(() => {
    if (visible) reset({ ...DEFAULTS, ...initialValues });
  }, [visible, initialValues, reset]);

  const selectedCategories = useWatch({ control, name: 'serviceCategories' });

  const toggleCategory = (value: (typeof SERVICE_CATEGORY_OPTIONS)[number]['value']) => {
    const next = selectedCategories.includes(value)
      ? selectedCategories.filter((c) => c !== value)
      : [...selectedCategories, value];
    setValue('serviceCategories', next);
  };

  return (
    <FormModal
      visible={visible}
      title={mode === 'create' ? 'Nouveau prestataire' : 'Modifier le prestataire'}
      onClose={onClose}
      onSubmit={handleSubmit(onSubmit)}
      submitting={submitting}
      submitLabel={mode === 'create' ? 'Créer' : 'Enregistrer'}>
      <Controller
        control={control}
        name="name"
        render={({ field }) => (
          <FormField label="Nom du prestataire" value={field.value} onChangeText={field.onChange} error={errors.name?.message} />
        )}
      />
      <Controller
        control={control}
        name="companyName"
        render={({ field }) => (
          <FormField label="Entreprise" value={field.value ?? ''} onChangeText={field.onChange} />
        )}
      />
      <View style={styles.row}>
        <View style={styles.flex}>
          <Controller
            control={control}
            name="phone"
            render={({ field }) => (
              <FormField label="Téléphone" value={field.value ?? ''} onChangeText={field.onChange} keyboardType="phone-pad" />
            )}
          />
        </View>
        <View style={styles.flex}>
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
      </View>

      <Text style={styles.categoryLabel}>Catégories de services</Text>
      <View style={styles.categoryRow}>
        {SERVICE_CATEGORY_OPTIONS.map((option) => {
          const active = selectedCategories.includes(option.value);
          return (
            <Pressable
              key={option.value}
              onPress={() => toggleCategory(option.value)}
              style={[styles.categoryChip, active && styles.categoryChipActive]}>
              <Text style={[styles.categoryChipText, active && styles.categoryChipTextActive]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Controller
        control={control}
        name="status"
        render={({ field }) => (
          <SelectField label="Statut" value={field.value} options={PROVIDER_STATUS_OPTIONS} onChange={field.onChange} />
        )}
      />
      <Controller
        control={control}
        name="pricingAgreement"
        render={({ field }) => (
          <FormField label="Accord tarifaire" value={field.value ?? ''} onChangeText={field.onChange} multiline />
        )}
      />
      <Controller
        control={control}
        name="internalNotes"
        render={({ field }) => (
          <FormField label="Notes internes" value={field.value ?? ''} onChangeText={field.onChange} multiline />
        )}
      />
    </FormModal>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  flex: {
    flex: 1,
  },
  categoryLabel: {
    ...robotoText(500, 12, { color: AmkouyColors.textFaint, marginTop: 18, marginBottom: 8 }),
  },
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 13,
    height: 32,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: AmkouyColors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryChipActive: {
    backgroundColor: AmkouyColors.primary,
    borderColor: AmkouyColors.primary,
  },
  categoryChipText: {
    ...robotoText(600, 12, { color: AmkouyColors.textMuted }),
  },
  categoryChipTextActive: {
    color: '#fff',
  },
});

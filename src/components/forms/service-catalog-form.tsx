import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet, Switch, Text, View } from 'react-native';

import { FormField } from '@/components/amkouy/form-field';
import { FormModal } from '@/components/amkouy/form-modal';
import { NumberField } from '@/components/amkouy/number-field';
import { SelectField } from '@/components/amkouy/select-field';
import { AmkouyColors } from '@/constants/amkouy-theme';
import { robotoText } from '@/constants/typography';
import {
  SERVICE_CATEGORY_OPTIONS,
  ServiceCatalogFormValues,
  serviceCatalogFormSchema,
} from '@/lib/validation/service-catalog';

const DEFAULTS: ServiceCatalogFormValues = {
  name: '',
  category: 'custom',
  description: '',
  isActive: true,
  requiresProvider: false,
  requiresScheduling: false,
  defaultPrice: 0,
  defaultCost: 0,
};

export function ServiceCatalogForm({
  visible,
  mode,
  initialValues,
  onClose,
  onSubmit,
  submitting,
}: {
  visible: boolean;
  mode: 'create' | 'edit';
  initialValues?: Partial<ServiceCatalogFormValues>;
  onClose: () => void;
  onSubmit: (values: ServiceCatalogFormValues) => void;
  submitting: boolean;
}) {
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ServiceCatalogFormValues>({
    resolver: zodResolver(serviceCatalogFormSchema),
    defaultValues: DEFAULTS,
  });

  useEffect(() => {
    if (visible) reset({ ...DEFAULTS, ...initialValues });
  }, [visible, initialValues, reset]);

  return (
    <FormModal
      visible={visible}
      title={mode === 'create' ? 'Nouveau service' : 'Modifier le service'}
      onClose={onClose}
      onSubmit={handleSubmit(onSubmit)}
      submitting={submitting}
      submitLabel={mode === 'create' ? 'Créer' : 'Enregistrer'}>
      <Controller
        control={control}
        name="name"
        render={({ field }) => (
          <FormField label="Nom du service" value={field.value} onChangeText={field.onChange} error={errors.name?.message} />
        )}
      />
      <Controller
        control={control}
        name="category"
        render={({ field }) => (
          <SelectField label="Catégorie" value={field.value} options={SERVICE_CATEGORY_OPTIONS} onChange={field.onChange} />
        )}
      />
      <Controller
        control={control}
        name="description"
        render={({ field }) => (
          <FormField label="Description" value={field.value ?? ''} onChangeText={field.onChange} multiline />
        )}
      />
      <View style={styles.row}>
        <View style={styles.flex}>
          <Controller
            control={control}
            name="defaultPrice"
            render={({ field }) => (
              <NumberField
                label="Prix par défaut (MAD)"
                value={field.value}
                onChangeValue={(v) => field.onChange(v ?? 0)}
                error={errors.defaultPrice?.message}
              />
            )}
          />
        </View>
        <View style={styles.flex}>
          <Controller
            control={control}
            name="defaultCost"
            render={({ field }) => (
              <NumberField
                label="Coût par défaut (MAD)"
                value={field.value}
                onChangeValue={(v) => field.onChange(v ?? 0)}
                error={errors.defaultCost?.message}
              />
            )}
          />
        </View>
      </View>

      <Controller
        control={control}
        name="isActive"
        render={({ field }) => <ToggleRow label="Service actif" value={field.value} onChange={field.onChange} />}
      />
      <Controller
        control={control}
        name="requiresProvider"
        render={({ field }) => <ToggleRow label="Nécessite un prestataire" value={field.value} onChange={field.onChange} />}
      />
      <Controller
        control={control}
        name="requiresScheduling"
        render={({ field }) => <ToggleRow label="Nécessite une planification" value={field.value} onChange={field.onChange} />}
      />
    </FormModal>
  );
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.toggleRow}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: AmkouyColors.primary }} />
    </View>
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
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 18,
  },
  toggleLabel: {
    ...robotoText(500, 13.5, { color: AmkouyColors.text }),
  },
});

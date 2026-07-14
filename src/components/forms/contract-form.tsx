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
import { useOwners } from '@/hooks/use-owners';
import { useProperties } from '@/hooks/use-properties';
import { ContractFormValues, contractFormSchema, PAYOUT_SCHEDULE_OPTIONS } from '@/lib/validation/contract';

const DEFAULTS: ContractFormValues = {
  ownerId: '',
  propertyId: '',
  commissionPct: 20,
  payoutSchedule: 'monthly',
  startDate: '',
  endDate: null,
  autoRenew: false,
  terms: '',
};

export function ContractForm({
  visible,
  mode,
  initialValues,
  onClose,
  onSubmit,
  submitting,
}: {
  visible: boolean;
  mode: 'create' | 'edit';
  initialValues?: Partial<ContractFormValues>;
  onClose: () => void;
  onSubmit: (values: ContractFormValues) => void;
  submitting: boolean;
}) {
  const { data: owners } = useOwners();
  const { data: properties } = useProperties();
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ContractFormValues>({
    resolver: zodResolver(contractFormSchema),
    defaultValues: DEFAULTS,
  });

  useEffect(() => {
    if (visible) reset({ ...DEFAULTS, ...initialValues });
  }, [visible, initialValues, reset]);

  const ownerOptions = (owners ?? []).map((o) => ({ label: o.full_name, value: o.id }));
  const propertyOptions = (properties ?? []).map((p) => ({ label: `${p.name} · ${p.city}`, value: p.id }));

  return (
    <FormModal
      visible={visible}
      title={mode === 'create' ? 'Nouveau contrat' : 'Modifier le contrat'}
      onClose={onClose}
      onSubmit={handleSubmit(onSubmit)}
      submitting={submitting}
      submitLabel={mode === 'create' ? 'Créer le contrat' : 'Enregistrer'}>
      <Controller
        control={control}
        name="ownerId"
        render={({ field }) => (
          <SelectField
            label="Propriétaire"
            value={field.value}
            options={ownerOptions}
            onChange={field.onChange}
            error={errors.ownerId?.message}
            placeholder="Sélectionner un propriétaire…"
          />
        )}
      />
      <Controller
        control={control}
        name="propertyId"
        render={({ field }) => (
          <SelectField
            label="Bien"
            value={field.value}
            options={propertyOptions}
            onChange={field.onChange}
            error={errors.propertyId?.message}
            placeholder="Sélectionner un bien…"
          />
        )}
      />
      <View style={styles.row}>
        <View style={styles.flex}>
          <Controller
            control={control}
            name="commissionPct"
            render={({ field }) => (
              <NumberField
                label="Commission (%)"
                value={field.value}
                onChangeValue={(v) => field.onChange(v ?? 0)}
                error={errors.commissionPct?.message}
              />
            )}
          />
        </View>
        <View style={styles.flex}>
          <Controller
            control={control}
            name="payoutSchedule"
            render={({ field }) => (
              <SelectField
                label="Versement"
                value={field.value}
                options={PAYOUT_SCHEDULE_OPTIONS}
                onChange={field.onChange}
              />
            )}
          />
        </View>
      </View>
      <View style={styles.row}>
        <View style={styles.flex}>
          <Controller
            control={control}
            name="startDate"
            render={({ field }) => (
              <FormField
                label="Début (AAAA-MM-JJ)"
                value={field.value}
                onChangeText={field.onChange}
                placeholder="2026-01-01"
                error={errors.startDate?.message}
              />
            )}
          />
        </View>
        <View style={styles.flex}>
          <Controller
            control={control}
            name="endDate"
            render={({ field }) => (
              <FormField
                label="Fin (AAAA-MM-JJ, optionnel)"
                value={field.value ?? ''}
                onChangeText={(v) => field.onChange(v || null)}
                placeholder="2027-01-01"
                error={errors.endDate?.message}
              />
            )}
          />
        </View>
      </View>
      <Controller
        control={control}
        name="autoRenew"
        render={({ field }) => <ToggleRow label="Renouvellement automatique" value={field.value} onChange={field.onChange} />}
      />
      <Controller
        control={control}
        name="terms"
        render={({ field }) => (
          <FormField label="Conditions / notes" value={field.value ?? ''} onChangeText={field.onChange} multiline />
        )}
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

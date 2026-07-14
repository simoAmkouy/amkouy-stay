import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { FormField } from '@/components/amkouy/form-field';
import { FormModal } from '@/components/amkouy/form-modal';
import { NumberField } from '@/components/amkouy/number-field';
import { SelectField } from '@/components/amkouy/select-field';
import { useUsersByRole } from '@/hooks/use-users';
import {
  CommercialLeadFormValues,
  commercialLeadFormSchema,
  LEAD_SOURCE_SUGGESTIONS,
} from '@/lib/validation/commercial-lead';
import { PROPERTY_TYPE_OPTIONS } from '@/lib/validation/property';

const DEFAULTS: CommercialLeadFormValues = {
  ownerName: '',
  phone: '',
  email: '',
  source: '',
  propertyType: null,
  city: '',
  estimatedUnits: null,
  notes: '',
  assignedTo: null,
};

export function CommercialLeadForm({
  visible,
  mode,
  initialValues,
  onClose,
  onSubmit,
  submitting,
}: {
  visible: boolean;
  mode: 'create' | 'edit';
  initialValues?: Partial<CommercialLeadFormValues>;
  onClose: () => void;
  onSubmit: (values: CommercialLeadFormValues) => void;
  submitting: boolean;
}) {
  const { data: agents } = useUsersByRole('commercial_agent');
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CommercialLeadFormValues>({ resolver: zodResolver(commercialLeadFormSchema), defaultValues: DEFAULTS });

  useEffect(() => {
    if (visible) reset({ ...DEFAULTS, ...initialValues });
  }, [visible, initialValues, reset]);

  const agentOptions = (agents ?? []).map((a) => ({ label: a.full_name, value: a.id }));
  const sourceOptions = LEAD_SOURCE_SUGGESTIONS.map((s) => ({ label: s, value: s }));

  return (
    <FormModal
      visible={visible}
      title={mode === 'create' ? 'Nouveau lead propriétaire' : 'Modifier le lead'}
      onClose={onClose}
      onSubmit={handleSubmit(onSubmit)}
      submitting={submitting}
      submitLabel={mode === 'create' ? 'Créer le lead' : 'Enregistrer'}>
      <Controller
        control={control}
        name="ownerName"
        render={({ field }) => <FormField label="Nom du propriétaire" value={field.value} onChangeText={field.onChange} error={errors.ownerName?.message} />}
      />
      <Controller
        control={control}
        name="phone"
        render={({ field }) => <FormField label="Téléphone" value={field.value ?? ''} onChangeText={field.onChange} />}
      />
      <Controller
        control={control}
        name="email"
        render={({ field }) => <FormField label="Email" value={field.value ?? ''} onChangeText={field.onChange} error={errors.email?.message} />}
      />
      <Controller
        control={control}
        name="source"
        render={({ field }) => (
          <SelectField label="Source" value={field.value ?? ''} options={sourceOptions} onChange={field.onChange} placeholder="Sélectionner…" />
        )}
      />
      <Controller
        control={control}
        name="propertyType"
        render={({ field }) => (
          <SelectField label="Type de bien" value={field.value ?? ''} options={PROPERTY_TYPE_OPTIONS} onChange={field.onChange} placeholder="Non renseigné" />
        )}
      />
      <Controller
        control={control}
        name="city"
        render={({ field }) => <FormField label="Ville" value={field.value ?? ''} onChangeText={field.onChange} />}
      />
      <Controller
        control={control}
        name="estimatedUnits"
        render={({ field }) => (
          <NumberField label="Unités estimées" value={field.value ?? 0} onChangeValue={(v) => field.onChange(v ?? null)} />
        )}
      />
      <Controller
        control={control}
        name="assignedTo"
        render={({ field }) => (
          <SelectField label="Agent assigné" value={field.value ?? ''} options={agentOptions} onChange={field.onChange} placeholder="Non assigné" />
        )}
      />
      <Controller
        control={control}
        name="notes"
        render={({ field }) => <FormField label="Notes" value={field.value ?? ''} onChangeText={field.onChange} multiline />}
      />
    </FormModal>
  );
}

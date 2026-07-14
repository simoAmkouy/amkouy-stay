import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { View } from 'react-native';

import { FormField } from '@/components/amkouy/form-field';
import { FormModal } from '@/components/amkouy/form-modal';
import { NumberField } from '@/components/amkouy/number-field';
import { SelectField } from '@/components/amkouy/select-field';
import { useProperties } from '@/hooks/use-properties';
import { useUsersByRole } from '@/hooks/use-users';
import { ReservationLeadFormValues, reservationLeadFormSchema } from '@/lib/validation/reservation-lead';
import { LEAD_SOURCE_SUGGESTIONS } from '@/lib/validation/commercial-lead';

const DEFAULTS: ReservationLeadFormValues = {
  guestName: '',
  phone: '',
  email: '',
  checkIn: '',
  checkOut: '',
  guestsCount: null,
  propertyId: null,
  source: '',
  notes: '',
  assignedTo: null,
};

export function ReservationLeadForm({
  visible,
  mode,
  initialValues,
  onClose,
  onSubmit,
  submitting,
}: {
  visible: boolean;
  mode: 'create' | 'edit';
  initialValues?: Partial<ReservationLeadFormValues>;
  onClose: () => void;
  onSubmit: (values: ReservationLeadFormValues) => void;
  submitting: boolean;
}) {
  const { data: properties } = useProperties();
  const { data: agents } = useUsersByRole('commercial_agent');
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ReservationLeadFormValues>({ resolver: zodResolver(reservationLeadFormSchema), defaultValues: DEFAULTS });

  useEffect(() => {
    if (visible) reset({ ...DEFAULTS, ...initialValues });
  }, [visible, initialValues, reset]);

  // CB-02 (Launch Readiness Audit): a lead shouldn't be steered toward a property that isn't
  // actually bookable yet — mirrors the same active-only filter applied to the main reservation
  // form, with the same "keep the already-selected one visible when editing" exception.
  const propertyOptions = (properties ?? [])
    .filter((p) => p.status === 'active' || p.id === initialValues?.propertyId)
    .map((p) => ({ label: `${p.name} · ${p.city}`, value: p.id }));
  const agentOptions = (agents ?? []).map((a) => ({ label: a.full_name, value: a.id }));
  const sourceOptions = LEAD_SOURCE_SUGGESTIONS.map((s) => ({ label: s, value: s }));

  return (
    <FormModal
      visible={visible}
      title={mode === 'create' ? 'Nouveau lead réservation' : 'Modifier le lead'}
      onClose={onClose}
      onSubmit={handleSubmit(onSubmit)}
      submitting={submitting}
      submitLabel={mode === 'create' ? 'Créer le lead' : 'Enregistrer'}>
      <Controller control={control} name="guestName" render={({ field }) => <FormField label="Nom du client" value={field.value} onChangeText={field.onChange} error={errors.guestName?.message} />} />
      <Controller control={control} name="phone" render={({ field }) => <FormField label="Téléphone" value={field.value ?? ''} onChangeText={field.onChange} />} />
      <Controller control={control} name="email" render={({ field }) => <FormField label="Email" value={field.value ?? ''} onChangeText={field.onChange} error={errors.email?.message} />} />
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Controller control={control} name="checkIn" render={({ field }) => <FormField label="Arrivée (AAAA-MM-JJ)" value={field.value ?? ''} onChangeText={field.onChange} placeholder="2026-08-01" />} />
        </View>
        <View style={{ flex: 1 }}>
          <Controller control={control} name="checkOut" render={({ field }) => <FormField label="Départ (AAAA-MM-JJ)" value={field.value ?? ''} onChangeText={field.onChange} placeholder="2026-08-05" error={errors.checkOut?.message} />} />
        </View>
      </View>
      <Controller control={control} name="guestsCount" render={({ field }) => <NumberField label="Nombre de voyageurs" value={field.value ?? 0} onChangeValue={(v) => field.onChange(v ?? null)} />} />
      <Controller
        control={control}
        name="propertyId"
        render={({ field }) => <SelectField label="Bien souhaité" value={field.value ?? ''} options={propertyOptions} onChange={field.onChange} placeholder="Non décidé" />}
      />
      <Controller control={control} name="source" render={({ field }) => <SelectField label="Source" value={field.value ?? ''} options={sourceOptions} onChange={field.onChange} placeholder="Sélectionner…" />} />
      <Controller
        control={control}
        name="assignedTo"
        render={({ field }) => <SelectField label="Agent assigné" value={field.value ?? ''} options={agentOptions} onChange={field.onChange} placeholder="Non assigné" />}
      />
      <Controller control={control} name="notes" render={({ field }) => <FormField label="Notes" value={field.value ?? ''} onChangeText={field.onChange} multiline />} />
    </FormModal>
  );
}

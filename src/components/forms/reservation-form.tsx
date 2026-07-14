import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { View } from 'react-native';

import { FormField } from '@/components/amkouy/form-field';
import { FormModal } from '@/components/amkouy/form-modal';
import { NumberField } from '@/components/amkouy/number-field';
import { SelectField } from '@/components/amkouy/select-field';
import { useChannels } from '@/hooks/use-reservations';
import { useProperties } from '@/hooks/use-properties';
import {
  RESERVATION_CREATE_STATUS_OPTIONS,
  RESERVATION_STATUS_OPTIONS,
  RESERVATION_STATUS_TRANSITIONS,
  ReservationFormValues,
  ReservationStatusValue,
  reservationFormSchema,
} from '@/lib/validation/reservation';

const DEFAULTS: ReservationFormValues = {
  propertyId: '',
  channelId: '',
  guestName: '',
  guestPhone: '',
  checkInDate: '',
  checkOutDate: '',
  nightlyRate: 0,
  cleaningFeeAmount: 0,
  adults: 1,
  children: 0,
  status: 'pending',
  specialRequests: '',
};

export function ReservationForm({
  visible,
  mode,
  initialValues,
  onClose,
  onSubmit,
  submitting,
}: {
  visible: boolean;
  mode: 'create' | 'edit';
  initialValues?: Partial<ReservationFormValues>;
  onClose: () => void;
  onSubmit: (values: ReservationFormValues) => void;
  submitting: boolean;
}) {
  const { data: properties } = useProperties();
  const { data: channels } = useChannels();
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ReservationFormValues>({
    resolver: zodResolver(reservationFormSchema),
    defaultValues: DEFAULTS,
  });

  useEffect(() => {
    if (visible) reset({ ...DEFAULTS, ...initialValues });
  }, [visible, initialValues, reset]);

  // CB-02 (Launch Readiness Audit): only bookable (active) properties are offered — except the
  // reservation's own current property when editing, so an existing booking against a property
  // that has since gone onboarding/maintenance/inactive can still be viewed/edited without the
  // picker showing a blank/invalid value.
  const propertyOptions = (properties ?? [])
    .filter((p) => p.status === 'active' || p.id === initialValues?.propertyId)
    .map((p) => ({ label: `${p.name} · ${p.city}`, value: p.id }));
  const channelOptions = (channels ?? []).map((c) => ({ label: c.name, value: c.id }));

  // CB-01: create mode can only start a reservation as pending/confirmed; edit mode only offers
  // the current status plus its valid next steps, so staff can't force a nonsensical transition.
  const statusOptions =
    mode === 'create'
      ? RESERVATION_CREATE_STATUS_OPTIONS
      : RESERVATION_STATUS_OPTIONS.filter((o) => {
          const current = initialValues?.status as ReservationStatusValue | undefined;
          if (!current) return true;
          return o.value === current || RESERVATION_STATUS_TRANSITIONS[current]?.includes(o.value);
        });

  return (
    <FormModal
      visible={visible}
      title={mode === 'create' ? 'Nouvelle réservation' : 'Modifier la réservation'}
      onClose={onClose}
      onSubmit={handleSubmit(onSubmit)}
      submitting={submitting}
      submitLabel={mode === 'create' ? 'Créer la réservation' : 'Enregistrer'}>
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
      <Controller
        control={control}
        name="channelId"
        render={({ field }) => (
          <SelectField
            label="Canal"
            value={field.value}
            options={channelOptions}
            onChange={field.onChange}
            error={errors.channelId?.message}
            placeholder="Sélectionner un canal…"
          />
        )}
      />
      <Controller
        control={control}
        name="guestName"
        render={({ field }) => (
          <FormField
            label="Nom du client"
            value={field.value}
            onChangeText={field.onChange}
            error={errors.guestName?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="guestPhone"
        render={({ field }) => (
          <FormField
            label="Téléphone du client"
            value={field.value}
            onChangeText={field.onChange}
            keyboardType="phone-pad"
            maxLength={20}
            error={errors.guestPhone?.message}
          />
        )}
      />
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Controller
            control={control}
            name="checkInDate"
            render={({ field }) => (
              <FormField
                label="Arrivée (AAAA-MM-JJ)"
                value={field.value}
                onChangeText={field.onChange}
                placeholder="2026-07-12"
                error={errors.checkInDate?.message}
              />
            )}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Controller
            control={control}
            name="checkOutDate"
            render={({ field }) => (
              <FormField
                label="Départ (AAAA-MM-JJ)"
                value={field.value}
                onChangeText={field.onChange}
                placeholder="2026-07-18"
                error={errors.checkOutDate?.message}
              />
            )}
          />
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Controller
            control={control}
            name="adults"
            render={({ field }) => (
              <NumberField
                label="Adultes"
                value={field.value}
                onChangeValue={(v) => field.onChange(v ?? 1)}
                error={errors.adults?.message}
              />
            )}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Controller
            control={control}
            name="children"
            render={({ field }) => (
              <NumberField
                label="Enfants"
                value={field.value}
                onChangeValue={(v) => field.onChange(v ?? 0)}
                error={errors.children?.message}
              />
            )}
          />
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Controller
            control={control}
            name="nightlyRate"
            render={({ field }) => (
              <NumberField
                label="Tarif/nuit (MAD)"
                value={field.value}
                onChangeValue={(v) => field.onChange(v ?? 0)}
                error={errors.nightlyRate?.message}
              />
            )}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Controller
            control={control}
            name="cleaningFeeAmount"
            render={({ field }) => (
              <NumberField
                label="Frais de ménage (MAD)"
                value={field.value}
                onChangeValue={(v) => field.onChange(v ?? 0)}
                error={errors.cleaningFeeAmount?.message}
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
            options={statusOptions}
            onChange={field.onChange}
          />
        )}
      />
      <Controller
        control={control}
        name="specialRequests"
        render={({ field }) => (
          <FormField
            label="Demandes du client"
            value={field.value ?? ''}
            onChangeText={field.onChange}
            multiline
          />
        )}
      />
    </FormModal>
  );
}

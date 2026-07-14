import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Text, View } from 'react-native';
import { z } from 'zod';

import { FormModal } from '@/components/amkouy/form-modal';
import { NumberField } from '@/components/amkouy/number-field';
import { SelectField } from '@/components/amkouy/select-field';
import { AmkouyColors } from '@/constants/amkouy-theme';
import { robotoText } from '@/constants/typography';
import { useChannels } from '@/hooks/use-reservations';
import { computeTotals } from '@/lib/queries/reservations';
import { formatMAD } from '@/utils/format';

const schema = z.object({
  channelId: z.string().uuid('Sélectionnez un canal.'),
  nightlyRate: z.number().positive('Le tarif doit être positif.'),
  cleaningFeeAmount: z.number().min(0),
  adults: z.number().int().min(1),
  children: z.number().int().min(0),
});

export type ConfirmReservationLeadValues = z.infer<typeof schema>;

export function ConfirmReservationLeadForm({
  visible,
  checkIn,
  checkOut,
  onClose,
  onSubmit,
  submitting,
}: {
  visible: boolean;
  checkIn: string;
  checkOut: string;
  onClose: () => void;
  onSubmit: (values: ConfirmReservationLeadValues) => void;
  submitting: boolean;
}) {
  const { data: channels } = useChannels();
  const {
    control,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<ConfirmReservationLeadValues>({
    resolver: zodResolver(schema),
    defaultValues: { channelId: '', nightlyRate: 0, cleaningFeeAmount: 0, adults: 1, children: 0 },
  });

  useEffect(() => {
    if (visible) reset({ channelId: channels?.[0]?.id ?? '', nightlyRate: 0, cleaningFeeAmount: 0, adults: 1, children: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, channels]);

  const channelOptions = (channels ?? []).map((c) => ({ label: c.name, value: c.id }));
  const values = watch();
  const { totalAmount } = computeTotals({ checkInDate: checkIn, checkOutDate: checkOut, nightlyRate: values.nightlyRate || 0, cleaningFeeAmount: values.cleaningFeeAmount || 0 });

  return (
    <FormModal
      visible={visible}
      title="Confirmer la réservation"
      onClose={onClose}
      onSubmit={handleSubmit(onSubmit)}
      submitting={submitting}
      submitLabel="Créer la réservation">
      <Controller control={control} name="channelId" render={({ field }) => <SelectField label="Canal" value={field.value} options={channelOptions} onChange={field.onChange} error={errors.channelId?.message} />} />
      <Controller control={control} name="nightlyRate" render={({ field }) => <NumberField label="Tarif / nuit (MAD)" value={field.value} onChangeValue={(v) => field.onChange(v ?? 0)} error={errors.nightlyRate?.message} />} />
      <Controller control={control} name="cleaningFeeAmount" render={({ field }) => <NumberField label="Frais de ménage (MAD)" value={field.value} onChangeValue={(v) => field.onChange(v ?? 0)} />} />
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Controller control={control} name="adults" render={({ field }) => <NumberField label="Adultes" value={field.value} onChangeValue={(v) => field.onChange(v ?? 1)} />} />
        </View>
        <View style={{ flex: 1 }}>
          <Controller control={control} name="children" render={({ field }) => <NumberField label="Enfants" value={field.value} onChangeValue={(v) => field.onChange(v ?? 0)} />} />
        </View>
      </View>
      <Text style={{ ...robotoText(700, 14, { color: AmkouyColors.primary, marginTop: 12 }) }}>Total : {formatMAD(totalAmount)}</Text>
    </FormModal>
  );
}

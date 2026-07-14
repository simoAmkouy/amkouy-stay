import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';

import { FormField } from '@/components/amkouy/form-field';
import { FormModal } from '@/components/amkouy/form-modal';

const schema = z.object({
  description: z.string().trim().min(1, 'Requis.'),
  houseRules: z.string().trim().min(1, 'Requis.'),
  checkinInstructions: z.string().trim().min(1, 'Requis.'),
  emergencyContact: z.string().trim().min(1, 'Requis.'),
  wifiInfo: z.string().trim().min(1, 'Requis.'),
  amenities: z.string().trim().optional(),
});

export type PropertySetupFormValues = z.infer<typeof schema>;

export function PropertySetupForm({
  visible,
  initialValues,
  onClose,
  onSubmit,
  submitting,
}: {
  visible: boolean;
  initialValues?: Partial<PropertySetupFormValues>;
  onClose: () => void;
  onSubmit: (values: PropertySetupFormValues) => void;
  submitting: boolean;
}) {
  const defaults: PropertySetupFormValues = {
    description: '',
    houseRules: '',
    checkinInstructions: '',
    emergencyContact: '',
    wifiInfo: '',
    amenities: '',
  };
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PropertySetupFormValues>({ resolver: zodResolver(schema), defaultValues: defaults });

  useEffect(() => {
    if (visible) reset({ ...defaults, ...initialValues });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, initialValues, reset]);

  return (
    <FormModal visible={visible} title="Compléter la fiche du bien" onClose={onClose} onSubmit={handleSubmit(onSubmit)} submitting={submitting} submitLabel="Enregistrer">
      <Controller control={control} name="description" render={({ field }) => <FormField label="Description" value={field.value} onChangeText={field.onChange} multiline error={errors.description?.message} />} />
      <Controller control={control} name="amenities" render={({ field }) => <FormField label="Équipements (séparés par des virgules)" value={field.value ?? ''} onChangeText={field.onChange} placeholder="wifi, piscine, climatisation" />} />
      <Controller control={control} name="houseRules" render={({ field }) => <FormField label="Règlement intérieur" value={field.value} onChangeText={field.onChange} multiline error={errors.houseRules?.message} />} />
      <Controller control={control} name="checkinInstructions" render={({ field }) => <FormField label="Instructions d'arrivée" value={field.value} onChangeText={field.onChange} multiline error={errors.checkinInstructions?.message} />} />
      <Controller control={control} name="emergencyContact" render={({ field }) => <FormField label="Contact d'urgence" value={field.value} onChangeText={field.onChange} error={errors.emergencyContact?.message} />} />
      <Controller control={control} name="wifiInfo" render={({ field }) => <FormField label="Informations WiFi" value={field.value} onChangeText={field.onChange} error={errors.wifiInfo?.message} />} />
    </FormModal>
  );
}

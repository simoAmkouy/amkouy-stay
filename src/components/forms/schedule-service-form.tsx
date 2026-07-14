import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { View } from 'react-native';

import { FormField } from '@/components/amkouy/form-field';
import { FormModal } from '@/components/amkouy/form-modal';
import { ScheduleServiceValues, scheduleServiceSchema } from '@/lib/validation/reservation-service';

const DEFAULTS: ScheduleServiceValues = { scheduledDate: '', scheduledTime: '' };

export function ScheduleServiceForm({
  visible,
  onClose,
  onSubmit,
  submitting,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (values: ScheduleServiceValues) => void;
  submitting: boolean;
}) {
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ScheduleServiceValues>({
    resolver: zodResolver(scheduleServiceSchema),
    defaultValues: DEFAULTS,
  });

  useEffect(() => {
    if (visible) reset(DEFAULTS);
  }, [visible, reset]);

  return (
    <FormModal
      visible={visible}
      title="Planifier le service"
      onClose={onClose}
      onSubmit={handleSubmit(onSubmit)}
      submitting={submitting}
      submitLabel="Planifier">
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Controller
            control={control}
            name="scheduledDate"
            render={({ field }) => (
              <FormField
                label="Date (AAAA-MM-JJ)"
                value={field.value}
                onChangeText={field.onChange}
                placeholder="2026-07-04"
                error={errors.scheduledDate?.message}
              />
            )}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Controller
            control={control}
            name="scheduledTime"
            render={({ field }) => (
              <FormField label="Heure (HH:MM)" value={field.value ?? ''} onChangeText={field.onChange} placeholder="14:00" />
            )}
          />
        </View>
      </View>
    </FormModal>
  );
}

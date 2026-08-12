import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { StyleSheet, Text, View } from 'react-native';

import { FormField } from '@/components/amkouy/form-field';
import { FormModal } from '@/components/amkouy/form-modal';
import { NumberField } from '@/components/amkouy/number-field';
import { SelectField } from '@/components/amkouy/select-field';
import { AmkouyColors } from '@/constants/amkouy-theme';
import { robotoText } from '@/constants/typography';
import { useActiveServices } from '@/hooks/use-services';
import { useServiceProviders } from '@/hooks/use-service-providers';
import {
  SERVICE_STATUS_OPTIONS,
  ReservationServiceFormValues,
  reservationServiceFormSchema,
} from '@/lib/validation/reservation-service';
import { formatMAD } from '@/utils/format';

const DEFAULTS: ReservationServiceFormValues = {
  serviceId: '',
  providerId: null,
  quantity: 1,
  unitPrice: 0,
  costAmount: null,
  amountPaid: 0,
  status: 'offered',
  scheduledDate: '',
  scheduledTime: '',
  notes: '',
};

export function ReservationServiceForm({
  visible,
  mode,
  initialValues,
  onClose,
  onSubmit,
  submitting,
}: {
  visible: boolean;
  mode: 'create' | 'edit';
  initialValues?: Partial<ReservationServiceFormValues>;
  onClose: () => void;
  onSubmit: (values: ReservationServiceFormValues) => void;
  submitting: boolean;
}) {
  const { data: services } = useActiveServices();
  const { data: providers } = useServiceProviders();
  const {
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<ReservationServiceFormValues>({
    resolver: zodResolver(reservationServiceFormSchema),
    defaultValues: DEFAULTS,
  });

  useEffect(() => {
    if (visible) reset({ ...DEFAULTS, ...initialValues });
  }, [visible, initialValues, reset]);

  const serviceId = useWatch({ control, name: 'serviceId' });
  const quantity = useWatch({ control, name: 'quantity' });
  const unitPrice = useWatch({ control, name: 'unitPrice' });
  const costAmount = useWatch({ control, name: 'costAmount' });
  const amountPaidWatched = useWatch({ control, name: 'amountPaid' });
  const total = (quantity || 0) * (unitPrice || 0);
  const profit = total - (costAmount || 0);
  const reste = Math.max(0, total - (amountPaidWatched || 0));
  const paidStatus: 'NON PAYÉ' | 'ACOMPTE' | 'PAYÉ' =
    (amountPaidWatched || 0) <= 0
      ? 'NON PAYÉ'
      : (amountPaidWatched || 0) >= total && total > 0
        ? 'PAYÉ'
        : 'ACOMPTE';

  const selectedService = (services ?? []).find((s) => s.id === serviceId);
  const activeProviders = (providers ?? []).filter((p) => p.status === 'active');

  const serviceOptions = (services ?? []).map((s) => ({ label: s.name, value: s.id }));
  const providerOptions = activeProviders.map((p) => ({ label: p.name, value: p.id }));

  const handleServiceChange = (value: string) => {
    setValue('serviceId', value);
    if (mode === 'create') {
      const picked = (services ?? []).find((s) => s.id === value);
      if (picked) {
        setValue('unitPrice', picked.default_price);
        setValue('costAmount', picked.default_cost);
      }
    }
  };

  return (
    <FormModal
      visible={visible}
      title={mode === 'create' ? 'Ajouter un service' : 'Modifier le service'}
      onClose={onClose}
      onSubmit={handleSubmit(onSubmit)}
      submitting={submitting}
      submitLabel={mode === 'create' ? 'Ajouter' : 'Enregistrer'}>
      <Controller
        control={control}
        name="serviceId"
        render={({ field }) => (
          <SelectField
            label="Service"
            value={field.value || null}
            options={serviceOptions}
            onChange={handleServiceChange}
            error={errors.serviceId?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="providerId"
        render={({ field }) => (
          <SelectField
            label="Prestataire"
            value={field.value}
            options={providerOptions}
            onChange={field.onChange}
            placeholder={selectedService?.requires_provider ? 'À assigner' : 'Aucun'}
          />
        )}
      />

      <View style={styles.row}>
        <View style={styles.flex}>
          <Controller
            control={control}
            name="quantity"
            render={({ field }) => (
              <NumberField
                label="Quantité"
                value={field.value}
                onChangeValue={(v) => field.onChange(v ?? 1)}
                error={errors.quantity?.message}
              />
            )}
          />
        </View>
        <View style={styles.flex}>
          <Controller
            control={control}
            name="unitPrice"
            render={({ field }) => (
              <NumberField
                label="Prix unitaire (MAD)"
                value={field.value}
                onChangeValue={(v) => field.onChange(v ?? 0)}
                error={errors.unitPrice?.message}
              />
            )}
          />
        </View>
      </View>

      <Controller
        control={control}
        name="costAmount"
        render={({ field }) => (
          <NumberField
            label="Coût prestataire (MAD)"
            value={field.value ?? undefined}
            onChangeValue={(v) => field.onChange(v ?? null)}
            error={errors.costAmount?.message}
          />
        )}
      />

      <View style={styles.totalRow}>
        <View>
          <Text style={styles.totalLabel}>Revenu</Text>
          <Text style={styles.totalValue}>{formatMAD(total)}</Text>
        </View>
        <View>
          <Text style={styles.totalLabel}>Profit</Text>
          <Text style={[styles.totalValue, { color: profit >= 0 ? AmkouyColors.success : AmkouyColors.error }]}>
            {formatMAD(profit)}
          </Text>
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Paiement client</Text>
      </View>

      <Controller
        control={control}
        name="amountPaid"
        render={({ field }) => (
          <NumberField
            label="Montant payé (MAD)"
            value={field.value}
            onChangeValue={(v) => field.onChange(v ?? 0)}
            error={errors.amountPaid?.message}
          />
        )}
      />

      <View style={styles.paymentInfoRow}>
        <View style={styles.paymentInfoBlock}>
          <Text style={styles.paymentInfoLabel}>Reste à payer</Text>
          <Text style={[styles.paymentInfoValue, { color: reste > 0 ? AmkouyColors.error : AmkouyColors.success }]}>
            {formatMAD(reste)}
          </Text>
        </View>
        <View style={styles.paymentInfoBlock}>
          <Text style={styles.paymentInfoLabel}>Statut paiement</Text>
          <Text
            style={[
              styles.paidStatusBadge,
              paidStatus === 'PAYÉ'
                ? styles.paidStatusPaid
                : paidStatus === 'ACOMPTE'
                  ? styles.paidStatusPartial
                  : styles.paidStatusUnpaid,
            ]}>
            {paidStatus}
          </Text>
        </View>
      </View>

      {selectedService?.requires_scheduling && (
        <View style={styles.row}>
          <View style={styles.flex}>
            <Controller
              control={control}
              name="scheduledDate"
              render={({ field }) => (
                <FormField
                  label="Date prévue (AAAA-MM-JJ)"
                  value={field.value ?? ''}
                  onChangeText={field.onChange}
                  placeholder="2026-07-04"
                />
              )}
            />
          </View>
          <View style={styles.flex}>
            <Controller
              control={control}
              name="scheduledTime"
              render={({ field }) => (
                <FormField label="Heure (HH:MM)" value={field.value ?? ''} onChangeText={field.onChange} placeholder="14:00" />
              )}
            />
          </View>
        </View>
      )}

      <Controller
        control={control}
        name="status"
        render={({ field }) => (
          <SelectField label="Statut" value={field.value} options={SERVICE_STATUS_OPTIONS} onChange={field.onChange} />
        )}
      />
      <Controller
        control={control}
        name="notes"
        render={({ field }) => (
          <FormField label="Notes" value={field.value ?? ''} onChangeText={field.onChange} multiline />
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
  totalRow: {
    flexDirection: 'row',
    gap: 24,
    backgroundColor: AmkouyColors.hairline,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginTop: 18,
  },
  totalLabel: {
    ...robotoText(600, 11, { color: AmkouyColors.textMuted }),
  },
  totalValue: {
    ...robotoText(900, 16, { color: AmkouyColors.primary, marginTop: 2 }),
  },
  sectionHeader: {
    borderTopWidth: 1,
    borderTopColor: AmkouyColors.hairline,
    marginTop: 8,
    paddingTop: 16,
  },
  sectionTitle: {
    ...robotoText(700, 12, { color: AmkouyColors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6 }),
  },
  paymentInfoRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  paymentInfoBlock: {
    flex: 1,
    backgroundColor: AmkouyColors.hairline,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  paymentInfoLabel: {
    ...robotoText(600, 10, { color: AmkouyColors.textMuted }),
  },
  paymentInfoValue: {
    ...robotoText(700, 15, { marginTop: 2 }),
  },
  paidStatusBadge: {
    ...robotoText(700, 11, { marginTop: 4, alignSelf: 'flex-start' as const }),
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
    overflow: 'hidden',
  },
  paidStatusPaid: {
    backgroundColor: '#DCFCE7',
    color: '#15803D',
  },
  paidStatusPartial: {
    backgroundColor: '#FEF3C7',
    color: '#92400E',
  },
  paidStatusUnpaid: {
    backgroundColor: '#FEE2E2',
    color: '#B91C1C',
  },
});

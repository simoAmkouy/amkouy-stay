import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet, Text, View } from 'react-native';

import { FormField } from '@/components/amkouy/form-field';
import { FormModal } from '@/components/amkouy/form-modal';
import { SelectField } from '@/components/amkouy/select-field';
import { AmkouyColors } from '@/constants/amkouy-theme';
import { robotoText } from '@/constants/typography';
import { useProperties } from '@/hooks/use-properties';
import { usePreviewOwnerSettlement } from '@/hooks/use-owner-payments';
import { SettlementPreview } from '@/lib/queries/owner-payments';
import {
  OwnerPaymentCreateValues,
  ownerPaymentCreateSchema,
  OwnerPaymentMetadataValues,
  ownerPaymentMetadataSchema,
  PAYOUT_METHOD_OPTIONS,
} from '@/lib/validation/owner-payment';
import { formatMAD } from '@/utils/format';

const CREATE_DEFAULTS: OwnerPaymentCreateValues = {
  propertyId: '',
  periodStart: '',
  periodEnd: '',
  dueDate: '',
  paymentMethod: null,
  paymentReference: '',
  notes: '',
};

const isoDateRe = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Financial Truth Remediation, Phase 2: creating a settlement no longer takes typed financial
 * values — the user picks a property + period, the figures below are always computed live by
 * compute_owner_settlement() (the same engine "Générer" already uses) and shown read-only. The
 * only editable fields are due date / payment method / reference / notes.
 */
export function OwnerPaymentCreateForm({
  visible,
  onClose,
  onSubmit,
  submitting,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (values: OwnerPaymentCreateValues) => void;
  submitting: boolean;
}) {
  const { data: properties } = useProperties();
  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<OwnerPaymentCreateValues>({
    resolver: zodResolver(ownerPaymentCreateSchema),
    defaultValues: CREATE_DEFAULTS,
  });
  const previewMutation = usePreviewOwnerSettlement();

  useEffect(() => {
    if (visible) reset(CREATE_DEFAULTS);
  }, [visible, reset]);

  const propertyId = watch('propertyId');
  const periodStart = watch('periodStart');
  const periodEnd = watch('periodEnd');

  useEffect(() => {
    if (propertyId && isoDateRe.test(periodStart) && isoDateRe.test(periodEnd) && periodEnd > periodStart) {
      previewMutation.mutate({ propertyId, periodStart, periodEnd });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId, periodStart, periodEnd]);

  const propertyOptions = (properties ?? []).map((p) => ({ label: `${p.name} · ${p.city}`, value: p.id }));
  const preview = previewMutation.data;
  const canSubmit = !!preview && !!preview.ownerId && !previewMutation.isPending;

  return (
    <FormModal
      visible={visible}
      title="Nouveau versement"
      onClose={onClose}
      onSubmit={handleSubmit(onSubmit)}
      submitting={submitting}
      submitLabel="Créer le versement">
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
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Controller
            control={control}
            name="periodStart"
            render={({ field }) => (
              <FormField
                label="Début période (AAAA-MM-JJ)"
                value={field.value}
                onChangeText={field.onChange}
                placeholder="2026-06-01"
                error={errors.periodStart?.message}
              />
            )}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Controller
            control={control}
            name="periodEnd"
            render={({ field }) => (
              <FormField
                label="Fin période (AAAA-MM-JJ)"
                value={field.value}
                onChangeText={field.onChange}
                placeholder="2026-06-30"
                error={errors.periodEnd?.message}
              />
            )}
          />
        </View>
      </View>

      {previewMutation.isPending && <Text style={styles.previewHint}>Calcul du règlement en cours…</Text>}
      {previewMutation.isError && (
        <Text style={styles.previewError}>Impossible de calculer le règlement pour ce bien et cette période.</Text>
      )}
      {preview && <SettlementPreviewCard preview={preview} />}

      <Controller
        control={control}
        name="dueDate"
        render={({ field }) => (
          <FormField
            label="Échéance (AAAA-MM-JJ)"
            value={field.value}
            onChangeText={field.onChange}
            placeholder="2026-07-10"
            error={errors.dueDate?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="paymentMethod"
        render={({ field }) => (
          <SelectField
            label="Moyen de paiement"
            value={field.value}
            options={PAYOUT_METHOD_OPTIONS}
            onChange={field.onChange}
            placeholder="Non renseigné"
          />
        )}
      />
      <Controller
        control={control}
        name="paymentReference"
        render={({ field }) => (
          <FormField label="N° de référence" value={field.value ?? ''} onChangeText={field.onChange} />
        )}
      />
      <Controller
        control={control}
        name="notes"
        render={({ field }) => (
          <FormField label="Notes" value={field.value ?? ''} onChangeText={field.onChange} multiline />
        )}
      />
      {preview && !preview.ownerId && (
        <Text style={styles.previewError}>Ce bien n&apos;a aucun propriétaire assigné — impossible de créer un versement.</Text>
      )}
      {!canSubmit && !previewMutation.isPending && !preview && (
        <Text style={styles.previewHint}>Sélectionnez un bien et une période pour calculer le règlement.</Text>
      )}
    </FormModal>
  );
}

function SettlementPreviewCard({ preview }: { preview: SettlementPreview }) {
  return (
    <View style={styles.previewCard}>
      <Text style={styles.previewTitle}>Aperçu du règlement (calculé automatiquement)</Text>
      <PreviewRow label="Propriétaire" value={preview.ownerName ?? '—'} />
      <PreviewRow label="Réservations" value={String(preview.reservationsCount)} />
      <PreviewRow label="Revenu brut" value={formatMAD(preview.grossRevenue)} />
      <PreviewRow label="Dépenses" value={`- ${formatMAD(preview.totalExpenses)}`} />
      <PreviewRow label="Revenu net" value={formatMAD(preview.netRevenue)} />
      <PreviewRow label={`Commission Amkouy (${preview.companyCommissionPct}%)`} value={formatMAD(preview.commissionAmount)} />
      <PreviewRow label={`Montant propriétaire (${preview.ownerCommissionPct}%)`} value={formatMAD(preview.netAmount)} emphasize />
    </View>
  );
}

function PreviewRow({ label, value, emphasize }: { label: string; value: string; emphasize?: boolean }) {
  return (
    <View style={styles.previewRow}>
      <Text style={styles.previewLabel}>{label}</Text>
      <Text style={[styles.previewValue, emphasize && { color: AmkouyColors.primary }]}>{value}</Text>
    </View>
  );
}

/**
 * Financial Truth Remediation, Phase 2: editing an existing (still-pending) settlement — property,
 * period, and every financial figure are fixed at creation time; only non-financial metadata can
 * change here.
 */
export function OwnerPaymentEditForm({
  visible,
  initialValues,
  onClose,
  onSubmit,
  submitting,
}: {
  visible: boolean;
  initialValues?: Partial<OwnerPaymentMetadataValues>;
  onClose: () => void;
  onSubmit: (values: OwnerPaymentMetadataValues) => void;
  submitting: boolean;
}) {
  const DEFAULTS: OwnerPaymentMetadataValues = { dueDate: '', paymentMethod: null, paymentReference: '', notes: '' };
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<OwnerPaymentMetadataValues>({
    resolver: zodResolver(ownerPaymentMetadataSchema),
    defaultValues: DEFAULTS,
  });

  useEffect(() => {
    if (visible) reset({ ...DEFAULTS, ...initialValues });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, initialValues, reset]);

  return (
    <FormModal
      visible={visible}
      title="Modifier le versement"
      onClose={onClose}
      onSubmit={handleSubmit(onSubmit)}
      submitting={submitting}
      submitLabel="Enregistrer">
      <Controller
        control={control}
        name="dueDate"
        render={({ field }) => (
          <FormField
            label="Échéance (AAAA-MM-JJ)"
            value={field.value}
            onChangeText={field.onChange}
            placeholder="2026-07-10"
            error={errors.dueDate?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="paymentMethod"
        render={({ field }) => (
          <SelectField
            label="Moyen de paiement"
            value={field.value}
            options={PAYOUT_METHOD_OPTIONS}
            onChange={field.onChange}
            placeholder="Non renseigné"
          />
        )}
      />
      <Controller
        control={control}
        name="paymentReference"
        render={({ field }) => (
          <FormField label="N° de référence" value={field.value ?? ''} onChangeText={field.onChange} />
        )}
      />
      <Controller
        control={control}
        name="notes"
        render={({ field }) => (
          <FormField label="Notes" value={field.value ?? ''} onChangeText={field.onChange} multiline />
        )}
      />
      <Text style={styles.previewHint}>
        Les montants (revenu, dépenses, commission) ne sont plus modifiables ici — ils proviennent du moteur de règlement.
      </Text>
    </FormModal>
  );
}

const styles = StyleSheet.create({
  previewCard: {
    marginTop: 18,
    marginBottom: 4,
    backgroundColor: AmkouyColors.hairline,
    borderRadius: 14,
    padding: 14,
  },
  previewTitle: {
    ...robotoText(700, 12, { color: AmkouyColors.primary, marginBottom: 8 }),
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 5,
  },
  previewLabel: {
    ...robotoText(400, 12, { color: AmkouyColors.textMuted, flex: 1 }),
  },
  previewValue: {
    ...robotoText(700, 12.5, { color: AmkouyColors.text }),
  },
  previewHint: {
    ...robotoText(400, 11.5, { color: AmkouyColors.textFaint, marginTop: 10 }),
  },
  previewError: {
    ...robotoText(500, 12, { color: AmkouyColors.error, marginTop: 8 }),
  },
});

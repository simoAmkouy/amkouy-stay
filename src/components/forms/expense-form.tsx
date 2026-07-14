import { zodResolver } from '@hookform/resolvers/zod';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { ActivityIndicator, Pressable, Text, View, StyleSheet } from 'react-native';

import { FormField } from '@/components/amkouy/form-field';
import { FormModal } from '@/components/amkouy/form-modal';
import { NumberField } from '@/components/amkouy/number-field';
import { SelectField } from '@/components/amkouy/select-field';
import { Icon } from '@/components/icon';
import { AmkouyColors } from '@/constants/amkouy-theme';
import { robotoText } from '@/constants/typography';
import { useProperties } from '@/hooks/use-properties';
import { useOwners } from '@/hooks/use-owners';
import { uploadAttachment } from '@/lib/storage';
import {
  EXPENSE_CATEGORY_OPTIONS,
  EXPENSE_STATUS_OPTIONS,
  ExpenseFormValues,
  expenseFormSchema,
  PAYMENT_METHOD_OPTIONS,
} from '@/lib/validation/expense';
import { notify } from '@/utils/alert';
import { getErrorMessage } from '@/utils/errors';

const DEFAULTS: ExpenseFormValues = {
  category: 'other',
  description: '',
  propertyId: null,
  reservationId: null,
  ownerId: null,
  amount: 0,
  expenseDate: '',
  vendorName: '',
  paymentMethod: null,
  notes: '',
  status: 'draft',
  receiptPath: null,
};

export function ExpenseForm({
  visible,
  mode,
  initialValues,
  onClose,
  onSubmit,
  submitting,
}: {
  visible: boolean;
  mode: 'create' | 'edit';
  initialValues?: Partial<ExpenseFormValues>;
  onClose: () => void;
  onSubmit: (values: ExpenseFormValues) => void;
  submitting: boolean;
}) {
  const { data: properties } = useProperties();
  const { data: owners } = useOwners();
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const {
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: DEFAULTS,
  });

  useEffect(() => {
    if (visible) reset({ ...DEFAULTS, ...initialValues });
  }, [visible, initialValues, reset]);

  const receiptPath = useWatch({ control, name: 'receiptPath' });
  const propertyOptions = (properties ?? []).map((p) => ({ label: `${p.name} · ${p.city}`, value: p.id }));
  const ownerOptions = (owners ?? []).map((o) => ({ label: o.full_name, value: o.id }));

  const handlePickReceipt = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      notify('Permission requise', "Autorisez l'accès aux photos pour joindre un reçu.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });
    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    const contentType = asset.mimeType ?? 'image/jpeg';
    const ext = contentType.split('/')[1] ?? 'jpg';
    const path = `expenses/${Date.now()}-${Math.round(Math.random() * 1e6)}.${ext}`;

    setUploadingReceipt(true);
    try {
      await uploadAttachment(path, asset.uri, contentType);
      setValue('receiptPath', path);
    } catch (error) {
      notify('Erreur', getErrorMessage(error, "Impossible de téléverser le reçu."));
    } finally {
      setUploadingReceipt(false);
    }
  };

  return (
    <FormModal
      visible={visible}
      title={mode === 'create' ? 'Nouvelle dépense' : 'Modifier la dépense'}
      onClose={onClose}
      onSubmit={handleSubmit(onSubmit)}
      submitting={submitting}
      submitLabel={mode === 'create' ? 'Créer la dépense' : 'Enregistrer'}>
      <Controller
        control={control}
        name="category"
        render={({ field }) => (
          <SelectField
            label="Catégorie"
            value={field.value}
            options={EXPENSE_CATEGORY_OPTIONS}
            onChange={field.onChange}
            error={errors.category?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="description"
        render={({ field }) => (
          <FormField
            label="Description"
            value={field.value}
            onChangeText={field.onChange}
            error={errors.description?.message}
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
            placeholder="Aucun bien lié"
          />
        )}
      />
      <Controller
        control={control}
        name="ownerId"
        render={({ field }) => (
          <SelectField
            label="Propriétaire"
            value={field.value}
            options={ownerOptions}
            onChange={field.onChange}
            placeholder="Aucun propriétaire lié"
          />
        )}
      />
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Controller
            control={control}
            name="amount"
            render={({ field }) => (
              <NumberField
                label="Montant (MAD)"
                value={field.value}
                onChangeValue={(v) => field.onChange(v ?? 0)}
                error={errors.amount?.message}
              />
            )}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Controller
            control={control}
            name="expenseDate"
            render={({ field }) => (
              <FormField
                label="Date (AAAA-MM-JJ)"
                value={field.value}
                onChangeText={field.onChange}
                placeholder="2026-07-04"
                error={errors.expenseDate?.message}
              />
            )}
          />
        </View>
      </View>
      <Controller
        control={control}
        name="paymentMethod"
        render={({ field }) => (
          <SelectField
            label="Moyen de paiement"
            value={field.value}
            options={PAYMENT_METHOD_OPTIONS}
            onChange={field.onChange}
            placeholder="Non renseigné"
          />
        )}
      />
      <Controller
        control={control}
        name="vendorName"
        render={({ field }) => (
          <FormField label="Fournisseur" value={field.value ?? ''} onChangeText={field.onChange} />
        )}
      />
      <Controller
        control={control}
        name="status"
        render={({ field }) => (
          <SelectField label="Statut" value={field.value} options={EXPENSE_STATUS_OPTIONS} onChange={field.onChange} />
        )}
      />
      <Controller
        control={control}
        name="notes"
        render={({ field }) => (
          <FormField label="Notes" value={field.value ?? ''} onChangeText={field.onChange} multiline />
        )}
      />

      <Pressable onPress={handlePickReceipt} disabled={uploadingReceipt} style={styles.receiptButton}>
        {uploadingReceipt ? (
          <ActivityIndicator color={AmkouyColors.primary} />
        ) : (
          <>
            <Icon name="receipt_long" size={20} color={AmkouyColors.primary} />
            <Text style={styles.receiptButtonText}>
              {receiptPath ? 'Reçu joint · remplacer' : 'Joindre un reçu'}
            </Text>
          </>
        )}
      </Pressable>
    </FormModal>
  );
}

const styles = StyleSheet.create({
  receiptButton: {
    marginTop: 18,
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: AmkouyColors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  receiptButtonText: {
    ...robotoText(600, 14, { color: AmkouyColors.primary }),
  },
});

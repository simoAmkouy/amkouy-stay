import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import * as ImagePicker from 'expo-image-picker';

import { AccessGuard } from '@/components/amkouy/access-guard';
import { Card } from '@/components/amkouy/card';
import { ErrorState } from '@/components/amkouy/error-state';
import { LoadingState } from '@/components/amkouy/loading-state';
import { Screen } from '@/components/amkouy/screen';
import { PropertyForm } from '@/components/forms/property-form';
import { PropertyPricingForm, PropertyPricingFormValues } from '@/components/forms/property-pricing-form';
import { PropertySetupForm, PropertySetupFormValues } from '@/components/forms/property-setup-form';
import { Icon } from '@/components/icon';
import { AmkouyColors } from '@/constants/amkouy-theme';
import { robotoText } from '@/constants/typography';
import { useDeleteProperty, useProperty, useUpdateProperty } from '@/hooks/use-properties';
import {
  useActivateProperty,
  usePropertyActivationStatus,
  usePropertyPhotos,
  useUpdatePropertyPricing,
  useUpdatePropertySetup,
  useUploadPropertyPhoto,
} from '@/hooks/use-property-activation';
import { PROPERTY_STATUS_OPTIONS, PROPERTY_TYPE_OPTIONS, PropertyFormValues } from '@/lib/validation/property';
import { confirmDestructive, notify } from '@/utils/alert';
import { getErrorMessage } from '@/utils/errors';
import { formatMAD } from '@/utils/format';
import { goBackOrReplace } from '@/utils/navigation';
import { getAttachmentSignedUrl } from '@/lib/storage';

const STATUS_LABEL = Object.fromEntries(PROPERTY_STATUS_OPTIONS.map((o) => [o.value, o.label]));

export default function PropertyDetailScreen() {
  return (
    <AccessGuard resource="properties">
      <PropertyDetailContent />
    </AccessGuard>
  );
}

function PropertyDetailContent() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: property, isLoading, isError, refetch } = useProperty(id);
  const updateProperty = useUpdateProperty();
  const deleteProperty = useDeleteProperty();
  const { data: activation } = usePropertyActivationStatus(property?.status === 'onboarding' ? id : undefined);
  const { data: photos } = usePropertyPhotos(id);
  const uploadPhoto = useUploadPropertyPhoto();
  const updateSetup = useUpdatePropertySetup();
  const updatePricing = useUpdatePropertyPricing();
  const activateProperty = useActivateProperty();
  const [showEdit, setShowEdit] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [showPricing, setShowPricing] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const handlePickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      notify('Permission requise', "Autorisez l'accès aux photos pour ajouter une image.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setUploadingPhoto(true);
    try {
      await uploadPhoto.mutateAsync({ propertyId: id as string, fileUri: asset.uri, contentType: asset.mimeType ?? 'image/jpeg' });
    } catch (error) {
      notify('Erreur', getErrorMessage(error, 'Impossible de téléverser la photo.'));
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSetupSubmit = (values: PropertySetupFormValues) => {
    updateSetup.mutate(
      {
        id: id as string,
        input: {
          description: values.description,
          houseRules: values.houseRules,
          checkinInstructions: values.checkinInstructions,
          emergencyContact: values.emergencyContact,
          wifiInfo: values.wifiInfo,
          amenities: values.amenities ? values.amenities.split(',').map((a) => a.trim()).filter(Boolean) : [],
        },
      },
      { onSuccess: () => setShowSetup(false), onError: (error) => notify('Erreur', getErrorMessage(error, 'Impossible de mettre à jour la fiche.')) }
    );
  };

  const handlePricingSubmit = (values: PropertyPricingFormValues) => {
    updatePricing.mutate(
      {
        id: id as string,
        input: {
          baseNightlyRate: values.baseNightlyRate,
          cleaningFee: values.cleaningFee,
          defaultSecurityDepositAmount: values.defaultSecurityDepositAmount,
          minStayNights: values.minStayNights,
        },
      },
      { onSuccess: () => setShowPricing(false), onError: (error) => notify('Erreur', getErrorMessage(error, 'Impossible de mettre à jour la tarification.')) }
    );
  };

  const handleActivate = () => {
    if (!property) return;
    activateProperty.mutate(
      { id: property.id, name: property.name },
      {
        onSuccess: () => notify('Propriété activée', `${property.name} est maintenant active.`),
        onError: (error) => notify('Activation impossible', getErrorMessage(error, 'Le bien ne remplit pas encore toutes les conditions.')),
      }
    );
  };

  const handleUpdate = (values: PropertyFormValues) => {
    updateProperty.mutate(
      {
        id: id as string,
        input: {
          name: values.name,
          property_type: values.propertyType,
          status: values.status,
          city: values.city,
          address_line: values.addressLine || null,
          bedrooms: values.bedrooms ?? null,
          bathrooms: values.bathrooms ?? null,
          max_guests: values.maxGuests ?? null,
          base_nightly_rate: values.baseNightlyRate ?? null,
          cleaning_fee: values.cleaningFee,
          assigned_manager_id: values.assignedManagerId,
          default_cleaner_id: values.defaultCleanerId,
          acquired_by_agent: values.acquiredByAgent,
        },
        ownerId: values.ownerId,
      },
      {
        onSuccess: () => {
          setShowEdit(false);
          notify('Bien modifié', 'Les changements ont été enregistrés.');
        },
        onError: (error) => {
          notify('Erreur', getErrorMessage(error, 'Impossible de modifier le bien.'));
        },
      }
    );
  };

  const handleDelete = () => {
    if (!property) return;
    confirmDestructive(
      'Supprimer ce bien ?',
      `"${property.name}" sera retiré de vos listes. Cette suppression est réversible depuis la base de données.`,
      () => {
        deleteProperty.mutate(property.id, {
          onSuccess: () => goBackOrReplace('/properties'),
          onError: (error) => notify('Erreur', getErrorMessage(error, 'Suppression impossible.')),
        });
      }
    );
  };

  if (isLoading) return <LoadingState label="Chargement du bien…" />;
  if (isError || !property)
    return <ErrorState message="Bien introuvable ou erreur de chargement." onRetry={refetch} />;

  const typeLabel =
    PROPERTY_TYPE_OPTIONS.find((t) => t.value === property.property_type)?.label ?? property.property_type;

  return (
    <Screen
      contentPadding={false}
      footer={
        <View style={styles.stickyFooter}>
          <View>
            <Text style={styles.footerLabel}>Tarif/nuit</Text>
            <Text style={styles.footerValue}>
              {property.base_nightly_rate != null ? formatMAD(property.base_nightly_rate) : 'Non défini'}
            </Text>
          </View>
          <Pressable onPress={() => setShowEdit(true)} style={styles.editButton}>
            <Icon name="edit" size={20} color={AmkouyColors.primary} />
            <Text style={styles.editButtonText}>Modifier</Text>
          </Pressable>
        </View>
      }>
      <View style={styles.imageHeader}>
        <Pressable
          onPress={() => goBackOrReplace('/properties')}
          style={[styles.circleButton, styles.backButtonPos]}>
          <Icon name="arrow_back" size={23} color="#fff" />
        </Pressable>
        <View style={styles.statusBadgeWrap}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>{STATUS_LABEL[property.status] ?? property.status}</Text>
        </View>
      </View>

      <View style={styles.content}>
        <Text style={styles.name}>{property.name}</Text>
        <View style={styles.locationRow}>
          <Icon name="location_on" size={17} color={AmkouyColors.secondary} />
          <Text style={styles.locationText}>
            {property.city} · {typeLabel}
          </Text>
        </View>
        {!!property.address_line && <Text style={styles.address}>{property.address_line}</Text>}

        <View style={styles.specsRow}>
          <View style={styles.specBox}>
            <Icon name="bed" size={22} color={AmkouyColors.primaryContainer} />
            <Text style={styles.specText}>{property.bedrooms ?? '—'} ch.</Text>
          </View>
          <View style={styles.specBox}>
            <Icon name="shower" size={22} color={AmkouyColors.primaryContainer} />
            <Text style={styles.specText}>{property.bathrooms ?? '—'} sdb</Text>
          </View>
          <View style={styles.specBox}>
            <Icon name="groups" size={22} color={AmkouyColors.primaryContainer} />
            <Text style={styles.specText}>{property.max_guests ?? '—'} pers.</Text>
          </View>
        </View>

        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, styles.summaryRevenue]}>
            <Text style={styles.summaryLabelDark}>Tarif/nuit</Text>
            <Text style={styles.summaryValueDark}>
              {property.base_nightly_rate != null ? formatMAD(property.base_nightly_rate) : '—'}
            </Text>
          </View>
          <View style={[styles.summaryCard, styles.summaryExpenses]}>
            <Text style={styles.summaryLabelLight}>Frais de ménage</Text>
            <Text style={styles.summaryValueLight}>{formatMAD(property.cleaning_fee)}</Text>
          </View>
        </View>

        {property.status === 'onboarding' && activation && (
          <>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionTitle, { marginTop: 0, marginBottom: 0 }]}>Activation</Text>
              <Text style={styles.scoreText}>{activation.activationScore}%</Text>
            </View>
            <Card style={styles.activationCard}>
              <View style={styles.scoreTrack}>
                <View style={[styles.scoreFill, { width: `${activation.activationScore}%` as never }]} />
              </View>
              <ChecklistRow label="Contrat actif" done={activation.hasActiveContract} />
              <ChecklistRow label={`Photos (${activation.photosCount}/${activation.photosRequired})`} done={activation.photosSatisfied} />
              <ChecklistRow label="Fiche du bien complète" done={activation.setupComplete} onPress={() => setShowSetup(true)} />
              <ChecklistRow label="Tarification configurée" done={activation.pricingComplete} onPress={() => setShowPricing(true)} />
            </Card>

            <Text style={styles.sectionTitle}>Photos ({photos?.length ?? 0}/10)</Text>
            <View style={styles.photoRow}>
              {(photos ?? []).map((doc) => (
                <PhotoThumbnail key={doc.id} fileUrl={doc.file_url} />
              ))}
              <Pressable onPress={handlePickPhoto} disabled={uploadingPhoto} style={styles.addPhoto}>
                {uploadingPhoto ? <ActivityIndicator color={AmkouyColors.textFainter} /> : <Icon name="add_a_photo" size={22} color={AmkouyColors.textFainter} />}
              </Pressable>
            </View>

            <Pressable
              onPress={handleActivate}
              disabled={!activation.isReady || activateProperty.isPending}
              style={[styles.activateButton, !activation.isReady && styles.activateButtonDisabled]}>
              <Icon name="verified" size={20} color={activation.isReady ? '#fff' : AmkouyColors.textFainter} />
              <Text style={[styles.activateButtonText, !activation.isReady && { color: AmkouyColors.textFainter }]}>
                {activation.isReady ? 'Activer cette propriété' : 'Pas encore prête'}
              </Text>
            </Pressable>
          </>
        )}

        <Text style={styles.sectionTitle}>Propriétaire</Text>
        <Card style={styles.ownerCard}>
          {property.primaryOwner ? (
            <>
              <Icon name="person" size={22} color={AmkouyColors.primaryContainer} />
              <Text style={styles.ownerName}>{property.primaryOwner.full_name}</Text>
            </>
          ) : (
            <Text style={styles.ownerEmpty}>Aucun propriétaire assigné</Text>
          )}
        </Card>

        <Pressable onPress={handleDelete} style={styles.deleteButton}>
          <Icon name="delete_outline" size={20} color={AmkouyColors.error} />
          <Text style={styles.deleteButtonText}>Supprimer ce bien</Text>
        </Pressable>
      </View>

      <PropertyForm
        visible={showEdit}
        mode="edit"
        initialValues={{
          name: property.name,
          propertyType: property.property_type,
          status: property.status,
          city: property.city,
          addressLine: property.address_line ?? '',
          bedrooms: property.bedrooms ?? undefined,
          bathrooms: property.bathrooms ?? undefined,
          maxGuests: property.max_guests ?? undefined,
          baseNightlyRate: property.base_nightly_rate ?? undefined,
          cleaningFee: property.cleaning_fee,
          ownerId: property.primaryOwner?.id ?? null,
          assignedManagerId: property.assigned_manager_id ?? null,
          defaultCleanerId: property.default_cleaner_id ?? null,
          acquiredByAgent: property.acquired_by_agent ?? null,
        }}
        onClose={() => setShowEdit(false)}
        onSubmit={handleUpdate}
        submitting={updateProperty.isPending}
      />

      <PropertySetupForm
        visible={showSetup}
        initialValues={{
          description: property.description ?? '',
          houseRules: property.house_rules ?? '',
          checkinInstructions: property.checkin_instructions ?? '',
          emergencyContact: property.emergency_contact ?? '',
          wifiInfo: property.wifi_info ?? '',
          amenities: Array.isArray(property.amenities) ? (property.amenities as string[]).join(', ') : '',
        }}
        onClose={() => setShowSetup(false)}
        onSubmit={handleSetupSubmit}
        submitting={updateSetup.isPending}
      />

      <PropertyPricingForm
        visible={showPricing}
        initialValues={{
          baseNightlyRate: property.base_nightly_rate ?? 0,
          cleaningFee: property.cleaning_fee,
          defaultSecurityDepositAmount: property.default_security_deposit_amount ?? 0,
          minStayNights: property.min_stay_nights,
        }}
        onClose={() => setShowPricing(false)}
        onSubmit={handlePricingSubmit}
        submitting={updatePricing.isPending}
      />
    </Screen>
  );
}

function ChecklistRow({ label, done, onPress }: { label: string; done: boolean; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={styles.checklistRow}>
      <Icon name={done ? 'check_circle' : 'radio_button_unchecked'} size={19} color={done ? AmkouyColors.success : AmkouyColors.textFainter} />
      <Text style={styles.checklistLabel}>{label}</Text>
      {onPress && !done && <Icon name="chevron_right" size={18} color="#c2c7cf" />}
    </Pressable>
  );
}

function PhotoThumbnail({ fileUrl }: { fileUrl: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    getAttachmentSignedUrl(fileUrl).then((signedUrl) => {
      if (!cancelled) setUrl(signedUrl);
    });
    return () => {
      cancelled = true;
    };
  }, [fileUrl]);
  return <View style={styles.photoPlaceholder}>{url && <Image source={{ uri: url }} style={styles.photoImage} />}</View>;
}

const styles = StyleSheet.create({
  imageHeader: {
    height: 160,
    backgroundColor: AmkouyColors.primaryContainer,
    position: 'relative',
  },
  circleButton: {
    position: 'absolute',
    top: 8,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(10,16,30,.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonPos: {
    left: 18,
  },
  statusBadgeWrap: {
    position: 'absolute',
    bottom: 14,
    left: 20,
    backgroundColor: AmkouyColors.success,
    borderRadius: 8,
    paddingHorizontal: 11,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fff',
  },
  statusText: {
    ...robotoText(700, 11, { color: '#fff' }),
  },
  content: {
    padding: 22,
    paddingTop: 16,
  },
  name: {
    ...robotoText(700, 22, { color: AmkouyColors.primary }),
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 5,
  },
  locationText: {
    ...robotoText(400, 13, { color: AmkouyColors.textMuted }),
  },
  address: {
    ...robotoText(400, 12.5, { color: AmkouyColors.textFaint, marginTop: 4 }),
  },
  specsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  specBox: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: AmkouyColors.hairline,
  },
  specText: {
    ...robotoText(600, 12, { color: AmkouyColors.text }),
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  summaryCard: {
    flex: 1,
    borderRadius: 14,
    padding: 14,
  },
  summaryRevenue: {
    backgroundColor: AmkouyColors.primary,
  },
  summaryExpenses: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: AmkouyColors.hairline,
  },
  summaryLabelDark: {
    ...robotoText(400, 11, { color: AmkouyColors.onPrimaryMuted }),
  },
  summaryValueDark: {
    ...robotoText(900, 19, { color: '#fff', marginTop: 4 }),
  },
  summaryLabelLight: {
    ...robotoText(400, 11, { color: AmkouyColors.textFaint }),
  },
  summaryValueLight: {
    ...robotoText(900, 19, { color: AmkouyColors.text, marginTop: 4 }),
  },
  sectionTitle: {
    ...robotoText(700, 15, { color: AmkouyColors.primary, marginTop: 22, marginBottom: 10 }),
  },
  ownerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
  },
  ownerName: {
    ...robotoText(600, 14, { color: AmkouyColors.text }),
  },
  ownerEmpty: {
    ...robotoText(400, 13, { color: AmkouyColors.textFaint }),
  },
  deleteButton: {
    marginTop: 28,
    height: 50,
    borderRadius: 25,
    borderWidth: 1.5,
    borderColor: AmkouyColors.error,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  deleteButtonText: {
    ...robotoText(600, 13, { color: AmkouyColors.error }),
  },
  stickyFooter: {
    backgroundColor: '#fff',
    paddingVertical: 14,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: AmkouyColors.primary,
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -3 },
  },
  footerLabel: {
    ...robotoText(400, 11, { color: AmkouyColors.textFaint }),
  },
  footerValue: {
    ...robotoText(700, 18, { color: AmkouyColors.primary }),
  },
  editButton: {
    height: 48,
    borderRadius: 16,
    backgroundColor: AmkouyColors.secondaryContainer,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 22,
  },
  editButtonText: {
    ...robotoText(700, 14, { color: AmkouyColors.primary }),
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 22,
    marginBottom: 10,
  },
  scoreText: {
    ...robotoText(700, 16, { color: AmkouyColors.primary }),
  },
  activationCard: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  scoreTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: AmkouyColors.hairline,
    overflow: 'hidden',
    marginVertical: 10,
  },
  scoreFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: AmkouyColors.success,
  },
  checklistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 11,
    borderTopWidth: 1,
    borderTopColor: AmkouyColors.hairline,
  },
  checklistLabel: {
    flex: 1,
    ...robotoText(500, 12.5, { color: AmkouyColors.text }),
  },
  photoRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  photoPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 12,
    backgroundColor: AmkouyColors.hairline,
    overflow: 'hidden',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  addPhoto: {
    width: 72,
    height: 72,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#C9CDD6',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activateButton: {
    marginTop: 18,
    height: 50,
    borderRadius: 25,
    backgroundColor: AmkouyColors.success,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  activateButtonDisabled: {
    backgroundColor: AmkouyColors.hairline,
  },
  activateButtonText: {
    ...robotoText(700, 14, { color: '#fff' }),
  },
});

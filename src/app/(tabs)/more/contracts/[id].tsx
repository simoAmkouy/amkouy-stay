import * as DocumentPicker from 'expo-document-picker';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { AccessGuard } from '@/components/amkouy/access-guard';
import { Badge } from '@/components/amkouy/badge';
import { Card } from '@/components/amkouy/card';
import { ErrorState } from '@/components/amkouy/error-state';
import { LoadingState } from '@/components/amkouy/loading-state';
import { Screen } from '@/components/amkouy/screen';
import { ScreenHeader } from '@/components/amkouy/screen-header';
import { ContractForm } from '@/components/forms/contract-form';
import { Icon } from '@/components/icon';
import { AmkouyColors } from '@/constants/amkouy-theme';
import { robotoText } from '@/constants/typography';
import { useAuth } from '@/hooks/use-auth';
import {
  useActivateContract,
  useContract,
  useContractDocuments,
  useTerminateContract,
  useUpdateContract,
  useUploadContractDocument,
} from '@/hooks/use-contracts';
import { getAttachmentSignedUrl } from '@/lib/storage';
import { computeContractHealth, computeDaysRemaining, ContractHealth } from '@/lib/queries/contracts';
import { CONTRACT_STATUS_OPTIONS, ContractFormValues, PAYOUT_SCHEDULE_OPTIONS } from '@/lib/validation/contract';
import { confirmDestructive, notify } from '@/utils/alert';
import { getErrorMessage } from '@/utils/errors';

const STATUS_LABEL = Object.fromEntries(CONTRACT_STATUS_OPTIONS.map((o) => [o.value, o.label]));
const PAYOUT_LABEL = Object.fromEntries(PAYOUT_SCHEDULE_OPTIONS.map((o) => [o.value, o.label]));

const HEALTH_LABEL: Record<ContractHealth, string> = {
  healthy: 'Sain',
  expiring_soon: 'Expire bientôt',
  urgent: 'Urgent',
  expired: 'Expiré',
  terminated: 'Résilié',
};
const HEALTH_COLOR: Record<ContractHealth, { bg: string; text: string }> = {
  healthy: { bg: '#DEF7E6', text: '#15803D' },
  expiring_soon: { bg: '#FDEBC8', text: '#B45309' },
  urgent: { bg: '#FAD9D9', text: '#B91C1C' },
  expired: { bg: '#FAD9D9', text: '#B91C1C' },
  terminated: { bg: '#EEF0F4', text: '#5A5E66' },
};

export default function ContractDetailScreen() {
  return (
    <AccessGuard resource="contracts">
      <ContractDetailContent />
    </AccessGuard>
  );
}

function ContractDetailContent() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const isStaff = profile?.role === 'admin' || profile?.role === 'super_admin' || profile?.role === 'manager';

  const { data: contract, isLoading, isError, refetch } = useContract(id);
  const { data: documents } = useContractDocuments(id);
  const updateContract = useUpdateContract();
  const activateContract = useActivateContract();
  const terminateContract = useTerminateContract();
  const uploadDocument = useUploadContractDocument();

  const [showEdit, setShowEdit] = useState(false);
  const [uploading, setUploading] = useState(false);

  if (isLoading) return <LoadingState label="Chargement du contrat…" />;
  if (isError || !contract) return <ErrorState message="Contrat introuvable ou erreur de chargement." onRetry={refetch} />;

  const health = computeContractHealth(contract);
  const days = computeDaysRemaining(contract.end_date);
  const healthColors = HEALTH_COLOR[health];

  const handleEdit = (values: ContractFormValues) => {
    updateContract.mutate(
      {
        id: contract.id,
        input: {
          ownerId: values.ownerId,
          propertyId: values.propertyId,
          commissionPct: values.commissionPct,
          payoutSchedule: values.payoutSchedule,
          startDate: values.startDate,
          endDate: values.endDate,
          autoRenew: values.autoRenew,
          terms: values.terms,
        },
      },
      {
        onSuccess: () => {
          setShowEdit(false);
          notify('Contrat mis à jour', 'Les modifications ont été enregistrées.');
        },
        onError: (error) => notify('Erreur', getErrorMessage(error, 'Impossible de modifier le contrat.')),
      }
    );
  };

  const handleActivate = () => {
    activateContract.mutate(contract.id, {
      onSuccess: () => notify('Contrat activé', `${contract.contract_number} est maintenant actif.`),
      onError: (error) => notify('Erreur', getErrorMessage(error, "Impossible d'activer le contrat.")),
    });
  };

  const handleTerminate = () => {
    confirmDestructive('Résilier ce contrat ?', `${contract.contract_number} sera marqué comme résilié.`, () => {
      terminateContract.mutate(contract.id, {
        onError: (error) => notify('Erreur', getErrorMessage(error, 'Impossible de résilier le contrat.')),
      });
    });
  };

  const handlePickDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setUploading(true);
    try {
      await uploadDocument.mutateAsync({
        contractId: contract.id,
        fileUri: asset.uri,
        contentType: asset.mimeType ?? 'application/pdf',
        fileName: asset.name,
      });
    } catch (error) {
      notify('Erreur', getErrorMessage(error, 'Impossible de téléverser le document.'));
    } finally {
      setUploading(false);
    }
  };

  const handleOpenDocument = async (fileUrl: string) => {
    const signedUrl = await getAttachmentSignedUrl(fileUrl);
    if (!signedUrl) {
      notify('Erreur', "Impossible d'ouvrir le document.");
      return;
    }
    Linking.openURL(signedUrl);
  };

  const currentDocument = documents?.[0] ?? null;
  const olderDocuments = (documents ?? []).slice(1);

  return (
    <Screen
      footer={
        isStaff ? (
          <View style={styles.stickyFooter}>
            {contract.status === 'draft' && (
              <FooterButton label="Activer" icon="check_circle" onPress={handleActivate} tone="success" />
            )}
            <FooterButton label="Modifier" icon="edit" onPress={() => setShowEdit(true)} tone="secondary" />
            {contract.status !== 'terminated' && (
              <FooterButton label="Résilier" icon="cancel" onPress={handleTerminate} tone="danger" />
            )}
          </View>
        ) : undefined
      }>
      <ScreenHeader
        title={contract.contract_number}
        subtitle={`${contract.owner?.full_name ?? '—'} · ${contract.property?.name ?? '—'}`}
        showBack
        fallbackHref="/more/contracts"
      />

      <View style={styles.content}>
        <View style={styles.badgeRow}>
          <Badge label={STATUS_LABEL[contract.status] ?? contract.status} bg="#E3E9F4" color={AmkouyColors.primaryContainer} />
        </View>

        {/* ===== PHASE 9: CONTRACT HEALTH ===== */}
        <Text style={styles.sectionTitle}>Santé du contrat</Text>
        <Card style={[styles.healthCard, { borderColor: healthColors.text }]}>
          <View style={styles.healthTop}>
            <Badge label={HEALTH_LABEL[health]} bg={healthColors.bg} color={healthColors.text} />
            {days !== null && health !== 'terminated' && (
              <Text style={[styles.healthDays, { color: healthColors.text }]}>
                {days >= 0 ? `${days} jours restants` : `Expiré depuis ${Math.abs(days)} jours`}
              </Text>
            )}
          </View>
          {contract.end_date == null && health !== 'terminated' && (
            <Text style={styles.healthNote}>Sans date de fin — aucune expiration à surveiller.</Text>
          )}
        </Card>

        <Card style={styles.infoCard}>
          <InfoRow label="Propriétaire" value={contract.owner?.full_name ?? '—'} border />
          <InfoRow label="Bien" value={contract.property?.name ?? '—'} border />
          <InfoRow label="Ville" value={contract.property?.city ?? '—'} border />
          <InfoRow label="Commission" value={`${contract.commission_pct}%`} border />
          <InfoRow label="Versement" value={PAYOUT_LABEL[contract.payout_schedule] ?? contract.payout_schedule} border />
          <InfoRow label="Début" value={contract.start_date} border />
          <InfoRow label="Fin" value={contract.end_date ?? 'Sans échéance'} border />
          <InfoRow label="Renouvellement auto." value={contract.auto_renew ? 'Oui' : 'Non'} />
        </Card>

        {!!contract.terms && (
          <>
            <Text style={styles.sectionTitle}>Conditions</Text>
            <View style={styles.notesCard}>
              <Text style={styles.notesText}>{contract.terms}</Text>
            </View>
          </>
        )}

        <Text style={styles.sectionTitle}>Document du contrat</Text>
        {currentDocument ? (
          <Pressable onPress={() => handleOpenDocument(currentDocument.file_url)}>
            <Card style={styles.documentRow}>
              <Icon name="picture_as_pdf" size={26} color="#B91C1C" />
              <View style={{ flex: 1 }}>
                <Text style={styles.documentName}>{currentDocument.file_name}</Text>
                <Text style={styles.documentMeta}>
                  Ajouté le {new Date(currentDocument.created_at).toLocaleDateString('fr-FR')}
                </Text>
              </View>
              <Icon name="open_in_new" size={20} color={AmkouyColors.primaryContainer} />
            </Card>
          </Pressable>
        ) : (
          <Text style={styles.emptyText}>Aucun document téléversé.</Text>
        )}

        {isStaff && (
          <Pressable onPress={handlePickDocument} disabled={uploading} style={styles.uploadButton}>
            {uploading ? (
              <ActivityIndicator color={AmkouyColors.primary} />
            ) : (
              <>
                <Icon name="upload_file" size={20} color={AmkouyColors.primary} />
                <Text style={styles.uploadButtonText}>
                  {currentDocument ? 'Remplacer le PDF' : 'Téléverser le PDF signé'}
                </Text>
              </>
            )}
          </Pressable>
        )}

        {olderDocuments.length > 0 && (
          <>
            <Text style={styles.historyLabel}>Versions précédentes</Text>
            {olderDocuments.map((doc) => (
              <Pressable key={doc.id} onPress={() => handleOpenDocument(doc.file_url)}>
                <View style={styles.historyRow}>
                  <Icon name="history" size={16} color={AmkouyColors.textFainter} />
                  <Text style={styles.historyText}>{doc.file_name}</Text>
                </View>
              </Pressable>
            ))}
          </>
        )}
      </View>

      <ContractForm
        visible={showEdit}
        mode="edit"
        initialValues={{
          ownerId: contract.owner_id,
          propertyId: contract.property_id,
          commissionPct: contract.commission_pct,
          payoutSchedule: contract.payout_schedule,
          startDate: contract.start_date,
          endDate: contract.end_date,
          autoRenew: contract.auto_renew,
          terms: contract.terms ?? '',
        }}
        onClose={() => setShowEdit(false)}
        onSubmit={handleEdit}
        submitting={updateContract.isPending}
      />
    </Screen>
  );
}

function FooterButton({
  label,
  icon,
  onPress,
  tone,
}: {
  label: string;
  icon: string;
  onPress: () => void;
  tone: 'success' | 'secondary' | 'danger';
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.footerButton,
        tone === 'success' ? styles.footerButtonSuccess : tone === 'danger' ? styles.footerButtonDanger : styles.footerButtonSecondary,
      ]}>
      <Icon name={icon} size={18} color={tone === 'secondary' ? AmkouyColors.primary : '#fff'} />
      <Text style={[styles.footerButtonText, tone === 'secondary' && { color: AmkouyColors.primary }]}>{label}</Text>
    </Pressable>
  );
}

function InfoRow({ label, value, border }: { label: string; value: string; border?: boolean }) {
  return (
    <View style={[styles.infoRow, border && styles.infoRowBorder]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 22,
    paddingTop: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  sectionTitle: {
    ...robotoText(700, 15, { color: AmkouyColors.primary, marginTop: 22, marginBottom: 10 }),
  },
  healthCard: {
    borderWidth: 1.5,
    padding: 14,
  },
  healthTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  healthDays: {
    ...robotoText(700, 13),
  },
  healthNote: {
    ...robotoText(400, 11.5, { color: AmkouyColors.textFaint, marginTop: 8 }),
  },
  infoCard: {
    paddingHorizontal: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  infoRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: AmkouyColors.hairline,
  },
  infoLabel: {
    ...robotoText(400, 13, { color: AmkouyColors.textMuted }),
  },
  infoValue: {
    ...robotoText(600, 13, { color: AmkouyColors.text }),
  },
  notesCard: {
    backgroundColor: '#FFFBEC',
    borderWidth: 1,
    borderColor: '#F3E6BE',
    borderRadius: 14,
    padding: 13,
    paddingHorizontal: 15,
  },
  notesText: {
    ...robotoText(400, 12.5, { color: '#6a5a22', lineHeight: 19 }),
  },
  documentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 13,
    paddingHorizontal: 15,
  },
  documentName: {
    ...robotoText(600, 13, { color: AmkouyColors.text }),
  },
  documentMeta: {
    ...robotoText(400, 10.5, { color: AmkouyColors.textFaint, marginTop: 2 }),
  },
  emptyText: {
    ...robotoText(400, 13, { color: AmkouyColors.textFaint }),
  },
  uploadButton: {
    marginTop: 12,
    height: 46,
    borderRadius: 23,
    borderWidth: 1.5,
    borderColor: AmkouyColors.primary,
    borderStyle: 'dashed',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  uploadButtonText: {
    ...robotoText(600, 13, { color: AmkouyColors.primary }),
  },
  historyLabel: {
    ...robotoText(600, 11, { color: AmkouyColors.textFainter, marginTop: 16, marginBottom: 6 }),
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  historyText: {
    ...robotoText(400, 12, { color: AmkouyColors.textFaint }),
  },
  stickyFooter: {
    backgroundColor: '#fff',
    paddingVertical: 14,
    paddingHorizontal: 20,
    flexDirection: 'row',
    gap: 8,
    shadowColor: AmkouyColors.primary,
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -3 },
  },
  footerButton: {
    flex: 1,
    height: 48,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  footerButtonSuccess: {
    backgroundColor: AmkouyColors.success,
  },
  footerButtonSecondary: {
    backgroundColor: AmkouyColors.secondaryContainer,
  },
  footerButtonDanger: {
    backgroundColor: AmkouyColors.error,
  },
  footerButtonText: {
    ...robotoText(700, 13, { color: '#fff' }),
  },
});

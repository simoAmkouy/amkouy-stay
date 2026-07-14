import { useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { AccessGuard } from '@/components/amkouy/access-guard';
import { Badge } from '@/components/amkouy/badge';
import { Card } from '@/components/amkouy/card';
import { ErrorState } from '@/components/amkouy/error-state';
import { LoadingState } from '@/components/amkouy/loading-state';
import { Screen } from '@/components/amkouy/screen';
import { ScreenHeader } from '@/components/amkouy/screen-header';
import { Timeline } from '@/components/amkouy/timeline';
import { AssignTechnicianForm } from '@/components/forms/assign-technician-form';
import { CompleteTicketForm } from '@/components/forms/complete-ticket-form';
import { GenerateExpenseForm } from '@/components/forms/generate-expense-form';
import { HoldForPartsForm } from '@/components/forms/hold-for-parts-form';
import { Icon } from '@/components/icon';
import { AmkouyColors } from '@/constants/amkouy-theme';
import { robotoText } from '@/constants/typography';
import { useAuth } from '@/hooks/use-auth';
import { useCreateExpense } from '@/hooks/use-expenses';
import {
  useAssignTechnician,
  useCancelTicket,
  useCompleteTicket,
  useHoldForParts,
  useMaintenanceTicket,
  useMaintenanceTicketPhotos,
  useStartWork,
  useUploadMaintenancePhoto,
  useVerifyTicket,
} from '@/hooks/use-maintenance-tickets';
import { DocumentRow } from '@/lib/queries/documents';
import {
  AssignTechnicianValues,
  CompleteTicketValues,
  GenerateExpenseValues,
  HoldForPartsValues,
  MAINTENANCE_CATEGORY_OPTIONS,
  MAINTENANCE_PRIORITY_OPTIONS,
  MAINTENANCE_STATUS_OPTIONS,
} from '@/lib/validation/maintenance-ticket';
import { confirmDestructive, notify } from '@/utils/alert';
import { getErrorMessage } from '@/utils/errors';
import { formatMAD } from '@/utils/format';
import { getAttachmentSignedUrl } from '@/lib/storage';

const STATUS_LABEL = Object.fromEntries(MAINTENANCE_STATUS_OPTIONS.map((o) => [o.value, o.label]));
const CATEGORY_LABEL = Object.fromEntries(MAINTENANCE_CATEGORY_OPTIONS.map((o) => [o.value, o.label]));
const PRIORITY_LABEL = Object.fromEntries(MAINTENANCE_PRIORITY_OPTIONS.map((o) => [o.value, o.label]));
const STATUS_COLOR: Record<string, { bg: string; text: string }> = {
  open: { bg: '#E3E9F4', text: '#1E3A6E' },
  assigned: { bg: '#EEEAFB', text: '#6D4FC9' },
  in_progress: { bg: '#FDEBC8', text: '#B45309' },
  on_hold: { bg: '#F8EFD4', text: '#8a6d1c' },
  resolved: { bg: '#DEF7E6', text: '#15803D' },
  closed: { bg: '#DDEEFB', text: '#0C5C8A' },
  cancelled: { bg: '#FAD9D9', text: '#B91C1C' },
};
const PRIORITY_COLOR: Record<string, { bg: string; text: string }> = {
  low: { bg: '#EEF0F4', text: '#5A5E66' },
  normal: { bg: '#E3E9F4', text: '#1E3A6E' },
  high: { bg: '#FDEBC8', text: '#B45309' },
  urgent: { bg: '#FAD9D9', text: '#B91C1C' },
};

function formatDateTime(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function MaintenanceDetailScreen() {
  return (
    <AccessGuard resource="maintenance">
      <MaintenanceDetailContent />
    </AccessGuard>
  );
}

function MaintenanceDetailContent() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const isStaff = profile?.role === 'admin' || profile?.role === 'super_admin' || profile?.role === 'manager';
  // "Générer dépense" writes to `expenses`, which is RLS-gated to is_finance() (admin/super_admin/
  // accountant) — deliberately narrower than is_staff(), since managers don't have the `expenses`
  // resource either (see permissions.ts). Vérifier/Assigner/etc. stay staff-gated; this one doesn't.
  const canManageFinance = profile?.role === 'admin' || profile?.role === 'super_admin' || profile?.role === 'accountant';

  const { data: ticket, isLoading, isError, refetch } = useMaintenanceTicket(id);
  const { data: photos } = useMaintenanceTicketPhotos(id);
  const assignTechnician = useAssignTechnician();
  const startWork = useStartWork();
  const holdForParts = useHoldForParts();
  const completeTicket = useCompleteTicket();
  const verifyTicket = useVerifyTicket();
  const cancelTicket = useCancelTicket();
  const uploadPhoto = useUploadMaintenancePhoto();
  const createExpense = useCreateExpense();

  const [showAssign, setShowAssign] = useState(false);
  const [showComplete, setShowComplete] = useState(false);
  const [showHold, setShowHold] = useState(false);
  const [showGenerateExpense, setShowGenerateExpense] = useState(false);
  const [uploadingCategory, setUploadingCategory] = useState<'photo_before' | 'photo_during' | 'photo_after' | null>(null);

  if (isLoading) return <LoadingState label="Chargement du ticket…" />;
  if (isError || !ticket) return <ErrorState message="Ticket introuvable ou erreur de chargement." onRetry={refetch} />;

  const isAssignedTechnician = profile?.id === ticket.assigned_to_user_id;
  const canAct = isStaff || isAssignedTechnician;
  const statusColors = STATUS_COLOR[ticket.status];
  const priorityColors = PRIORITY_COLOR[ticket.priority];

  type TimelineItem = { dot: string; ring: string; label: string; time: string };
  const timelineItems: TimelineItem[] = (
    [
      { dot: AmkouyColors.primaryContainer, ring: AmkouyColors.hairline, label: `Signalé · ${ticket.ticket_number}`, time: formatDateTime(ticket.created_at) },
      ticket.started_at && { dot: '#B45309', ring: AmkouyColors.hairline, label: 'Travaux démarrés', time: formatDateTime(ticket.started_at) },
      ticket.completed_at && { dot: '#15803D', ring: AmkouyColors.hairline, label: 'Réparation terminée', time: formatDateTime(ticket.completed_at) },
      ticket.status === 'closed' && { dot: '#0C5C8A', ring: AmkouyColors.hairline, label: 'Vérifié', time: formatDateTime(ticket.updated_at) },
    ] as (TimelineItem | false)[]
  ).filter((item): item is TimelineItem => !!item);

  const handleAssign = (values: AssignTechnicianValues) => {
    assignTechnician.mutate(
      { id: ticket.id, userId: values.assignedToUserId },
      {
        onSuccess: () => {
          setShowAssign(false);
          notify('Technicien assigné', 'Le ticket a été assigné avec succès.');
        },
        onError: (error) => notify('Erreur', getErrorMessage(error, "Impossible d'assigner le technicien.")),
      }
    );
  };

  const handleStart = () => {
    startWork.mutate(ticket.id, {
      onError: (error) => notify('Erreur', getErrorMessage(error, 'Impossible de démarrer les travaux.')),
    });
  };

  const handleHold = (values: HoldForPartsValues) => {
    holdForParts.mutate(
      { id: ticket.id, notes: values.notes },
      {
        onSuccess: () => setShowHold(false),
        onError: (error) => notify('Erreur', getErrorMessage(error, 'Impossible de mettre en attente.')),
      }
    );
  };

  const handleComplete = (values: CompleteTicketValues) => {
    completeTicket.mutate(
      { id: ticket.id, input: { actualCost: values.actualCost, notes: values.notes } },
      {
        onSuccess: () => {
          setShowComplete(false);
          notify('Réparation terminée', 'Le ticket a été marqué comme terminé.');
        },
        onError: (error) => notify('Erreur', getErrorMessage(error, 'Impossible de terminer le ticket.')),
      }
    );
  };

  const handleVerify = () => {
    verifyTicket.mutate(ticket.id, {
      onSuccess: () => notify('Ticket vérifié', 'La réparation a été confirmée.'),
      onError: (error) => notify('Erreur', getErrorMessage(error, 'Impossible de vérifier le ticket.')),
    });
  };

  const handleCancel = () => {
    confirmDestructive('Annuler ce ticket ?', `Le ticket ${ticket.ticket_number} sera marqué comme annulé.`, () => {
      cancelTicket.mutate(ticket.id, {
        onError: (error) => notify('Erreur', getErrorMessage(error, "Impossible d'annuler le ticket.")),
      });
    });
  };

  const handleGenerateExpense = (values: GenerateExpenseValues) => {
    createExpense.mutate(
      {
        category: 'maintenance',
        description: values.description,
        propertyId: ticket.property_id,
        reservationId: ticket.reservation_id,
        ownerId: null,
        amount: values.amount,
        expenseDate: new Date().toISOString().slice(0, 10),
        paymentMethod: null,
        status: 'approved',
        relatedMaintenanceTicketId: ticket.id,
      },
      {
        onSuccess: () => {
          setShowGenerateExpense(false);
          notify('Dépense créée', 'La dépense de maintenance a été enregistrée.');
        },
        onError: (error) => notify('Erreur', getErrorMessage(error, 'Impossible de créer la dépense.')),
      }
    );
  };

  const handlePickPhoto = async (category: 'photo_before' | 'photo_during' | 'photo_after') => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      notify('Permission requise', "Autorisez l'accès aux photos pour ajouter une image.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 });
    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    const contentType = asset.mimeType ?? 'image/jpeg';
    setUploadingCategory(category);
    try {
      await uploadPhoto.mutateAsync({ maintenanceTicketId: ticket.id, category, fileUri: asset.uri, contentType });
    } catch (error) {
      notify('Erreur', getErrorMessage(error, 'Impossible de téléverser la photo.'));
    } finally {
      setUploadingCategory(null);
    }
  };

  const beforePhotos = (photos ?? []).filter((d) => d.category === 'photo_before');
  const duringPhotos = (photos ?? []).filter((d) => d.category === 'photo_during');
  const afterPhotos = (photos ?? []).filter((d) => d.category === 'photo_after');

  return (
    <Screen
      footer={
        canAct ? (
          <View style={styles.stickyFooter}>
            {ticket.status === 'open' && isStaff && (
              <FooterButton label="Assigner" icon="person_add" onPress={() => setShowAssign(true)} tone="primary" />
            )}
            {(ticket.status === 'assigned' || ticket.status === 'on_hold') && (
              <FooterButton label={ticket.status === 'on_hold' ? 'Reprendre' : 'Démarrer'} icon="play_circle" onPress={handleStart} tone="primary" />
            )}
            {ticket.status === 'in_progress' && (
              <>
                <FooterButton label="Pièces manquantes" icon="hourglass_empty" onPress={() => setShowHold(true)} tone="secondary" />
                <FooterButton label="Terminer" icon="check_circle" onPress={() => setShowComplete(true)} tone="success" />
              </>
            )}
            {ticket.status === 'resolved' && isStaff && (
              <>
                {canManageFinance && (
                  <FooterButton label="Générer dépense" icon="receipt_long" onPress={() => setShowGenerateExpense(true)} tone="secondary" />
                )}
                <FooterButton label="Vérifier" icon="verified" onPress={handleVerify} tone="success" />
              </>
            )}
          </View>
        ) : undefined
      }>
      <ScreenHeader title={ticket.issue_summary} subtitle={`${ticket.property?.name ?? '—'} · ${ticket.ticket_number}`} showBack fallbackHref="/more/maintenance" />

      <View style={styles.content}>
        <View style={styles.badgeRow}>
          <Badge label={STATUS_LABEL[ticket.status] ?? ticket.status} bg={statusColors.bg} color={statusColors.text} />
          <Badge label={PRIORITY_LABEL[ticket.priority] ?? ticket.priority} bg={priorityColors.bg} color={priorityColors.text} />
        </View>

        <Card style={styles.infoCard}>
          <InfoRow label="Bien" value={ticket.property?.name ?? '—'} border />
          <InfoRow label="Catégorie" value={CATEGORY_LABEL[ticket.category] ?? ticket.category} border />
          <InfoRow label="Technicien" value={ticket.technician?.full_name ?? 'Non assigné'} border />
          <InfoRow label="Coût estimé" value={ticket.estimated_cost != null ? formatMAD(ticket.estimated_cost) : '—'} border />
          <InfoRow label="Coût réel" value={ticket.actual_cost != null ? formatMAD(ticket.actual_cost) : '—'} />
        </Card>

        {!!ticket.description && (
          <>
            <Text style={styles.sectionTitle}>Description</Text>
            <View style={styles.notesCard}>
              <Text style={styles.notesText}>{ticket.description}</Text>
            </View>
          </>
        )}

        <PhotoSection title="Avant réparation" documents={beforePhotos} uploading={uploadingCategory === 'photo_before'} canAdd={canAct} onAdd={() => handlePickPhoto('photo_before')} />
        <PhotoSection title="Pendant réparation" documents={duringPhotos} uploading={uploadingCategory === 'photo_during'} canAdd={canAct} onAdd={() => handlePickPhoto('photo_during')} />
        <PhotoSection title="Après réparation" documents={afterPhotos} uploading={uploadingCategory === 'photo_after'} canAdd={canAct} onAdd={() => handlePickPhoto('photo_after')} />

        {!!ticket.notes && (
          <>
            <Text style={styles.sectionTitle}>Notes</Text>
            <View style={styles.notesCard}>
              <Text style={styles.notesText}>{ticket.notes}</Text>
            </View>
          </>
        )}

        <Text style={styles.sectionTitle}>Chronologie</Text>
        <View style={styles.timelineWrap}>
          <Timeline items={timelineItems} />
        </View>

        {isStaff && ticket.status !== 'cancelled' && ticket.status !== 'closed' && (
          <Pressable onPress={handleCancel} style={styles.cancelButton}>
            <Icon name="cancel" size={20} color={AmkouyColors.error} />
            <Text style={styles.cancelButtonText}>Annuler ce ticket</Text>
          </Pressable>
        )}
      </View>

      <AssignTechnicianForm visible={showAssign} onClose={() => setShowAssign(false)} onSubmit={handleAssign} submitting={assignTechnician.isPending} />
      <HoldForPartsForm visible={showHold} onClose={() => setShowHold(false)} onSubmit={handleHold} submitting={holdForParts.isPending} />
      <CompleteTicketForm visible={showComplete} onClose={() => setShowComplete(false)} onSubmit={handleComplete} submitting={completeTicket.isPending} />
      <GenerateExpenseForm
        visible={showGenerateExpense}
        initialValues={{ amount: ticket.actual_cost ?? ticket.estimated_cost ?? 0, description: `Maintenance · ${ticket.issue_summary}` }}
        onClose={() => setShowGenerateExpense(false)}
        onSubmit={handleGenerateExpense}
        submitting={createExpense.isPending}
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
  tone: 'primary' | 'success' | 'secondary';
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.footerButton,
        tone === 'success' ? styles.footerButtonSuccess : tone === 'secondary' ? styles.footerButtonSecondary : styles.footerButtonPrimary,
      ]}>
      <Icon name={icon} size={18} color={tone === 'secondary' ? AmkouyColors.primary : '#fff'} />
      <Text style={[styles.footerButtonText, tone === 'secondary' && { color: AmkouyColors.primary }]}>{label}</Text>
    </Pressable>
  );
}

function PhotoSection({
  title,
  documents,
  uploading,
  canAdd,
  onAdd,
}: {
  title: string;
  documents: DocumentRow[];
  uploading: boolean;
  canAdd: boolean;
  onAdd: () => void;
}) {
  return (
    <>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.photoRow}>
        {documents.map((doc) => (
          <PhotoThumbnail key={doc.id} document={doc} />
        ))}
        {canAdd && (
          <Pressable onPress={onAdd} disabled={uploading} style={styles.addPhoto}>
            {uploading ? (
              <ActivityIndicator color={AmkouyColors.textFainter} />
            ) : (
              <>
                <Icon name="add_a_photo" size={22} color={AmkouyColors.textFainter} />
                <Text style={styles.addPhotoLabel}>Ajouter</Text>
              </>
            )}
          </Pressable>
        )}
        {documents.length === 0 && !canAdd && <Text style={styles.emptyText}>Aucune photo.</Text>}
      </View>
    </>
  );
}

function PhotoThumbnail({ document }: { document: DocumentRow }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getAttachmentSignedUrl(document.file_url).then((signedUrl) => {
      if (!cancelled) setUrl(signedUrl);
    });
    return () => {
      cancelled = true;
    };
  }, [document.file_url]);

  return <View style={styles.photoPlaceholder}>{url && <Image source={{ uri: url }} style={styles.photoImage} />}</View>;
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
  sectionTitle: {
    ...robotoText(700, 15, { color: AmkouyColors.primary, marginTop: 22, marginBottom: 10 }),
  },
  photoRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  photoPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: AmkouyColors.hairline,
    overflow: 'hidden',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  addPhoto: {
    width: 80,
    height: 80,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#C9CDD6',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  addPhotoLabel: {
    ...robotoText(500, 9.5, { color: AmkouyColors.textFainter }),
  },
  emptyText: {
    ...robotoText(400, 13, { color: AmkouyColors.textFaint }),
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
  timelineWrap: {
    paddingTop: 4,
  },
  cancelButton: {
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
  cancelButtonText: {
    ...robotoText(600, 13, { color: AmkouyColors.error }),
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
  footerButtonPrimary: {
    backgroundColor: AmkouyColors.primary,
  },
  footerButtonSuccess: {
    backgroundColor: AmkouyColors.success,
  },
  footerButtonSecondary: {
    backgroundColor: AmkouyColors.secondaryContainer,
  },
  footerButtonText: {
    ...robotoText(700, 13, { color: '#fff' }),
  },
});

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
import { AssignCleanerForm } from '@/components/forms/assign-cleaner-form';
import { CompleteTaskForm } from '@/components/forms/complete-task-form';
import { EscalateTicketForm } from '@/components/forms/escalate-ticket-form';
import { Icon } from '@/components/icon';
import { AmkouyColors } from '@/constants/amkouy-theme';
import { robotoText } from '@/constants/typography';
import { useAuth } from '@/hooks/use-auth';
import {
  useAssignCleaner,
  useCancelTask,
  useCleaningTask,
  useCleaningTaskPhotos,
  useCompleteTask,
  useStartTask,
  useUpdateChecklist,
  useUploadCleaningPhoto,
  useVerifyTask,
} from '@/hooks/use-cleaning-tasks';
import { useCreateMaintenanceTicket } from '@/hooks/use-maintenance-tickets';
import { CHECKLIST_TEMPLATE, ChecklistItem } from '@/lib/queries/cleaning-tasks';
import { DocumentRow } from '@/lib/queries/documents';
import { getAttachmentSignedUrl } from '@/lib/storage';
import { AssignCleanerValues, CLEANING_STATUS_OPTIONS, CompleteTaskValues } from '@/lib/validation/cleaning-task';
import { ESCALATION_REASON_TO_CATEGORY, EscalateTicketValues } from '@/lib/validation/maintenance-ticket';
import { confirmDestructive, notify } from '@/utils/alert';
import { getErrorMessage } from '@/utils/errors';

const STATUS_LABEL = Object.fromEntries(CLEANING_STATUS_OPTIONS.map((o) => [o.value, o.label]));
const STATUS_COLOR: Record<string, { bg: string; text: string }> = {
  unassigned: { bg: '#EEF0F4', text: '#5A5E66' },
  scheduled: { bg: '#EEEAFB', text: '#6D4FC9' },
  in_progress: { bg: '#FDEBC8', text: '#B45309' },
  completed: { bg: '#DEF7E6', text: '#15803D' },
  verified: { bg: '#DDEEFB', text: '#0C5C8A' },
  cancelled: { bg: '#FAD9D9', text: '#B91C1C' },
};

export default function CleaningDetailScreen() {
  return (
    <AccessGuard resource="cleaning">
      <CleaningDetailContent />
    </AccessGuard>
  );
}

function CleaningDetailContent() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const isStaff = profile?.role === 'admin' || profile?.role === 'super_admin' || profile?.role === 'manager';

  const { data: task, isLoading, isError, refetch } = useCleaningTask(id);
  const { data: photos } = useCleaningTaskPhotos(id);
  const assignCleaner = useAssignCleaner();
  const startTask = useStartTask();
  const completeTask = useCompleteTask();
  const verifyTask = useVerifyTask();
  const cancelTask = useCancelTask();
  const updateChecklist = useUpdateChecklist();
  const uploadPhoto = useUploadCleaningPhoto();
  const createMaintenanceTicket = useCreateMaintenanceTicket();

  const [showAssign, setShowAssign] = useState(false);
  const [showComplete, setShowComplete] = useState(false);
  const [showEscalate, setShowEscalate] = useState(false);
  const [uploadingCategory, setUploadingCategory] = useState<'photo_before' | 'photo_after' | null>(null);

  if (isLoading) return <LoadingState label="Chargement de la tâche…" />;
  if (isError || !task) return <ErrorState message="Tâche introuvable ou erreur de chargement." onRetry={refetch} />;

  const isAssignedCleaner = profile?.id === task.assigned_to_user_id;
  const canAct = isStaff || isAssignedCleaner;
  const checklist: ChecklistItem[] =
    Array.isArray(task.checklist) && task.checklist.length > 0
      ? (task.checklist as unknown as ChecklistItem[])
      : CHECKLIST_TEMPLATE;
  const checklistEditable = canAct && (task.status === 'in_progress' || task.status === 'scheduled');
  const statusColors = STATUS_COLOR[task.status];

  const toggleChecklistItem = (index: number) => {
    if (!checklistEditable) return;
    const next = checklist.map((item, i) => (i === index ? { ...item, done: !item.done } : item));
    updateChecklist.mutate(
      { id: task.id, checklist: next },
      { onError: (error) => notify('Erreur', getErrorMessage(error, 'Impossible de mettre à jour la liste.')) }
    );
  };

  const handleAssign = (values: AssignCleanerValues) => {
    assignCleaner.mutate(
      { id: task.id, userId: values.assignedToUserId },
      {
        onSuccess: () => {
          setShowAssign(false);
          notify('Agent assigné', 'La tâche a été assignée avec succès.');
        },
        onError: (error) => notify('Erreur', getErrorMessage(error, "Impossible d'assigner l'agent.")),
      }
    );
  };

  const handleStart = () => {
    startTask.mutate(task.id, {
      onError: (error) => notify('Erreur', getErrorMessage(error, 'Impossible de démarrer la tâche.')),
    });
  };

  const handleComplete = (values: CompleteTaskValues) => {
    completeTask.mutate(
      { id: task.id, notes: values.notes },
      {
        onSuccess: () => {
          setShowComplete(false);
          notify('Tâche terminée', 'La tâche a été marquée comme terminée.');
        },
        onError: (error) => notify('Erreur', getErrorMessage(error, 'Impossible de terminer la tâche.')),
      }
    );
  };

  const handleVerify = () => {
    verifyTask.mutate(task.id, {
      onSuccess: () => notify('Tâche vérifiée', 'La qualité du ménage a été confirmée.'),
      onError: (error) => notify('Erreur', getErrorMessage(error, 'Impossible de vérifier la tâche.')),
    });
  };

  const handleCancel = () => {
    confirmDestructive('Annuler cette tâche ?', `La tâche ${task.task_number} sera marquée comme annulée.`, () => {
      cancelTask.mutate(task.id, {
        onError: (error) => notify('Erreur', getErrorMessage(error, "Impossible d'annuler la tâche.")),
      });
    });
  };

  const handlePickPhoto = async (category: 'photo_before' | 'photo_after') => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      notify('Permission requise', "Autorisez l'accès aux photos pour ajouter une image.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });
    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    const contentType = asset.mimeType ?? 'image/jpeg';
    setUploadingCategory(category);
    try {
      await uploadPhoto.mutateAsync({
        cleaningTaskId: task.id,
        category,
        fileUri: asset.uri,
        contentType,
      });
    } catch (error) {
      notify('Erreur', getErrorMessage(error, "Impossible de téléverser la photo."));
    } finally {
      setUploadingCategory(null);
    }
  };

  const handleEscalate = (values: EscalateTicketValues) => {
    if (!profile) return;
    createMaintenanceTicket.mutate(
      {
        propertyId: task.property_id,
        cleaningTaskId: task.id,
        category: ESCALATION_REASON_TO_CATEGORY[values.reason],
        priority: values.priority,
        issueSummary: values.reasonLabel,
        description: values.description,
        reportedBy: profile.id,
      },
      {
        onSuccess: () => {
          setShowEscalate(false);
          notify('Problème signalé', 'Un ticket de maintenance a été créé pour ce problème.');
        },
        onError: (error) => notify('Erreur', getErrorMessage(error, 'Impossible de créer le ticket de maintenance.')),
      }
    );
  };

  const beforePhotos = (photos ?? []).filter((d) => d.category === 'photo_before');
  const afterPhotos = (photos ?? []).filter((d) => d.category === 'photo_after');

  return (
    <Screen
      footer={
        canAct ? (
          <View style={styles.stickyFooter}>
            {task.status === 'unassigned' && isStaff && (
              <FooterButton label="Assigner" icon="person_add" onPress={() => setShowAssign(true)} tone="primary" />
            )}
            {task.status === 'scheduled' && (
              <FooterButton label="Démarrer" icon="play_circle" onPress={handleStart} tone="primary" />
            )}
            {task.status === 'in_progress' && (
              <FooterButton
                label="Marquer comme terminé"
                icon="check_circle"
                onPress={() => setShowComplete(true)}
                tone="success"
              />
            )}
            {task.status === 'completed' && isStaff && (
              <FooterButton label="Vérifier" icon="verified" onPress={handleVerify} tone="success" />
            )}
          </View>
        ) : undefined
      }>
      <ScreenHeader
        title={task.property?.name ?? '—'}
        subtitle={`${task.cleaner?.full_name ?? 'Non assigné'} · échéance ${task.scheduled_date}`}
        showBack
        fallbackHref="/more/cleaning"
      />

      <View style={styles.content}>
        <View style={styles.titleRow}>
          <Text style={styles.taskNumber}>{task.task_number}</Text>
          <Badge label={STATUS_LABEL[task.status] ?? task.status} bg={statusColors.bg} color={statusColors.text} />
        </View>

        <Card style={styles.infoCard}>
          <InfoRow label="Bien" value={task.property?.name ?? '—'} border />
          <InfoRow label="Date prévue" value={task.scheduled_date} border />
          <InfoRow label="Durée estimée" value={task.estimated_duration_minutes ? `${task.estimated_duration_minutes} min` : '—'} border />
          <InfoRow label="Agent" value={task.cleaner?.full_name ?? 'Non assigné'} />
        </Card>

        <Text style={styles.sectionTitle}>Liste de vérification</Text>
        <Card style={styles.checklistCard}>
          {checklist.map((item, index) => (
            <Pressable
              key={item.label}
              onPress={() => toggleChecklistItem(index)}
              disabled={!checklistEditable}
              style={[styles.checklistRow, index < checklist.length - 1 && styles.rowBorder]}>
              <Icon
                name={item.done ? 'check_circle' : 'radio_button_unchecked'}
                size={23}
                color={item.done ? AmkouyColors.success : AmkouyColors.textFainter}
              />
              <Text style={[styles.checklistLabel, item.done && { color: AmkouyColors.textFaint }]}>{item.label}</Text>
            </Pressable>
          ))}
        </Card>

        <PhotoSection
          title="Photos avant"
          documents={beforePhotos}
          uploading={uploadingCategory === 'photo_before'}
          canAdd={canAct && task.status !== 'cancelled'}
          onAdd={() => handlePickPhoto('photo_before')}
        />
        <PhotoSection
          title="Photos après"
          documents={afterPhotos}
          uploading={uploadingCategory === 'photo_after'}
          canAdd={canAct && task.status !== 'cancelled'}
          onAdd={() => handlePickPhoto('photo_after')}
        />

        {!!task.notes && (
          <>
            <Text style={styles.sectionTitle}>Notes</Text>
            <View style={styles.notesCard}>
              <Text style={styles.notesText}>{task.notes}</Text>
            </View>
          </>
        )}

        {canAct && task.status !== 'cancelled' && (
          <Pressable onPress={() => setShowEscalate(true)} style={styles.escalateButton}>
            <Icon name="report_problem" size={20} color={AmkouyColors.secondary} />
            <Text style={styles.escalateButtonText}>Signaler un problème</Text>
          </Pressable>
        )}

        {isStaff && task.status !== 'cancelled' && task.status !== 'verified' && (
          <Pressable onPress={handleCancel} style={styles.cancelButton}>
            <Icon name="cancel" size={20} color={AmkouyColors.error} />
            <Text style={styles.cancelButtonText}>Annuler cette tâche</Text>
          </Pressable>
        )}
      </View>

      <AssignCleanerForm
        visible={showAssign}
        onClose={() => setShowAssign(false)}
        onSubmit={handleAssign}
        submitting={assignCleaner.isPending}
      />
      <CompleteTaskForm
        visible={showComplete}
        onClose={() => setShowComplete(false)}
        onSubmit={handleComplete}
        submitting={completeTask.isPending}
      />
      <EscalateTicketForm
        visible={showEscalate}
        onClose={() => setShowEscalate(false)}
        onSubmit={handleEscalate}
        submitting={createMaintenanceTicket.isPending}
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
  tone: 'primary' | 'success';
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.footerButton, tone === 'success' ? styles.footerButtonSuccess : styles.footerButtonPrimary]}>
      <Icon name={icon} size={19} color="#fff" />
      <Text style={styles.footerButtonText}>{label}</Text>
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
                <Icon name="add_a_photo" size={24} color={AmkouyColors.textFainter} />
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

  return (
    <View style={styles.photoPlaceholder}>
      {url && <Image source={{ uri: url }} style={styles.photoImage} />}
    </View>
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
  },
  taskNumber: {
    ...robotoText(700, 19, { color: AmkouyColors.primary }),
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
  checklistCard: {
    paddingHorizontal: 16,
  },
  checklistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: AmkouyColors.hairline,
  },
  checklistLabel: {
    flex: 1,
    ...robotoText(500, 13.5, { color: AmkouyColors.text }),
  },
  photoRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  photoPlaceholder: {
    width: 88,
    height: 88,
    borderRadius: 12,
    backgroundColor: AmkouyColors.hairline,
    overflow: 'hidden',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  addPhoto: {
    width: 88,
    height: 88,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#C9CDD6',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  addPhotoLabel: {
    ...robotoText(500, 10, { color: AmkouyColors.textFainter }),
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
  escalateButton: {
    marginTop: 28,
    height: 50,
    borderRadius: 25,
    borderWidth: 1.5,
    borderColor: AmkouyColors.secondary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  escalateButtonText: {
    ...robotoText(600, 13, { color: AmkouyColors.secondary }),
  },
  cancelButton: {
    marginTop: 12,
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
    gap: 10,
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
    gap: 8,
  },
  footerButtonPrimary: {
    backgroundColor: AmkouyColors.primary,
  },
  footerButtonSuccess: {
    backgroundColor: AmkouyColors.success,
  },
  footerButtonText: {
    ...robotoText(700, 14, { color: '#fff' }),
  },
});

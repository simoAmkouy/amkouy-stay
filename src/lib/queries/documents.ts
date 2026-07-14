import { logActivity } from '@/lib/queries/activity-log';
import { notifyUsers } from '@/lib/queries/notifications';
import { notifyIfNowReady } from '@/lib/queries/property-activation';
import { listStaffUserIds } from '@/lib/queries/users';
import { supabase } from '@/lib/supabase';
import { uploadAttachment } from '@/lib/storage';
import { Database } from '@/types/supabase';
import { logAppError } from '@/utils/errors';

export type DocumentRow = Database['public']['Tables']['documents']['Row'];
export type DocumentCategory = Database['public']['Enums']['document_category'];

export async function listDocumentsForCleaningTask(cleaningTaskId: string): Promise<DocumentRow[]> {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('cleaning_task_id', cleaningTaskId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });
  if (error) {
    logAppError('documents.listDocumentsForCleaningTask', error);
    throw error;
  }
  return data ?? [];
}

/** Uploads to `attachments/cleaning/<taskId>/<category>-<timestamp>.<ext>` (the path prefix the
 * `cleaning_photos_*` storage policies match on) and records it in `documents`. */
export async function uploadCleaningPhoto(params: {
  cleaningTaskId: string;
  category: Extract<DocumentCategory, 'photo_before' | 'photo_after'>;
  fileUri: string;
  contentType: string;
}): Promise<DocumentRow> {
  const ext = params.contentType.split('/')[1] ?? 'jpg';
  const path = `cleaning/${params.cleaningTaskId}/${params.category}-${Date.now()}.${ext}`;
  await uploadAttachment(path, params.fileUri, params.contentType);

  const { data, error } = await supabase
    .from('documents')
    .insert({
      cleaning_task_id: params.cleaningTaskId,
      category: params.category,
      file_name: path.split('/').pop() as string,
      file_url: path,
      mime_type: params.contentType,
    })
    .select()
    .single();
  if (error) {
    logAppError('documents.uploadCleaningPhoto', error);
    throw error;
  }
  return data;
}

/** Newest first — the detail screen treats the most recent row as "the" current signed PDF;
 * uploading again ("replace") just adds a new row rather than overwriting, matching the
 * never-hard-delete convention used everywhere else in this schema. */
export async function listDocumentsForContract(contractId: string): Promise<DocumentRow[]> {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('contract_id', contractId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error) {
    logAppError('documents.listDocumentsForContract', error);
    throw error;
  }
  return data ?? [];
}

/** Uploads to `attachments/contracts/<contractId>/contract-<timestamp>.<ext>` (the path prefix
 * the `contract_documents_*` storage policies match on) and records it in `documents`. */
export async function uploadContractDocument(params: {
  contractId: string;
  fileUri: string;
  contentType: string;
  fileName?: string;
}): Promise<DocumentRow> {
  const ext = params.contentType.split('/')[1] ?? 'pdf';
  const path = `contracts/${params.contractId}/contract-${Date.now()}.${ext}`;
  await uploadAttachment(path, params.fileUri, params.contentType);

  const { data, error } = await supabase
    .from('documents')
    .insert({
      contract_id: params.contractId,
      category: 'contract',
      file_name: params.fileName || (path.split('/').pop() as string),
      file_url: path,
      mime_type: params.contentType,
    })
    .select()
    .single();
  if (error) {
    logAppError('documents.uploadContractDocument', error);
    throw error;
  }
  return data;
}

/** Module 11 — property listing photos. Reuses the exact same `documents` table + `attachments`
 * bucket + signed-URL pattern as cleaning/maintenance/contract documents; the only new thing is
 * the `property_photo` category value, which is how the activation trigger/RPCs count them. */
export async function listPropertyPhotos(propertyId: string): Promise<DocumentRow[]> {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('property_id', propertyId)
    .eq('category', 'property_photo')
    .is('deleted_at', null)
    .order('created_at', { ascending: true });
  if (error) {
    logAppError('documents.listPropertyPhotos', error);
    throw error;
  }
  return data ?? [];
}

export async function uploadPropertyPhoto(params: { propertyId: string; fileUri: string; contentType: string }): Promise<DocumentRow> {
  const ext = params.contentType.split('/')[1] ?? 'jpg';
  const path = `properties/${params.propertyId}/photo-${Date.now()}.${ext}`;
  await uploadAttachment(path, params.fileUri, params.contentType);

  const { data, error } = await supabase
    .from('documents')
    .insert({
      property_id: params.propertyId,
      category: 'property_photo',
      file_name: path.split('/').pop() as string,
      file_url: path,
      mime_type: params.contentType,
    })
    .select()
    .single();
  if (error) {
    logAppError('documents.uploadPropertyPhoto', error);
    throw error;
  }
  await logActivity({ entityType: 'property', entityId: params.propertyId, action: 'property.photo_uploaded' });

  // Fires exactly once, on the upload that crosses the 10-photo threshold — event-triggered,
  // not a polling check, so it's naturally idempotent without needing a stored "already notified"
  // flag (Phase: "Photos requirement completed").
  const { count } = await supabase
    .from('documents')
    .select('id', { count: 'exact', head: true })
    .eq('property_id', params.propertyId)
    .eq('category', 'property_photo')
    .is('deleted_at', null);
  if (count === 10) {
    const staffIds = await listStaffUserIds();
    await notifyUsers({
      userIds: staffIds,
      type: 'onboarding',
      title: 'Photos complétées',
      body: '10 photos ont été ajoutées à ce bien.',
      relatedEntityType: 'property',
      relatedEntityId: params.propertyId,
    });
  } else {
    await notifyIfNowReady(params.propertyId);
  }
  return data;
}

export async function deletePropertyPhoto(documentId: string): Promise<void> {
  const { error } = await supabase.from('documents').update({ deleted_at: new Date().toISOString() }).eq('id', documentId);
  if (error) {
    logAppError('documents.deletePropertyPhoto', error);
    throw error;
  }
}

export async function listDocumentsForMaintenanceTicket(maintenanceTicketId: string): Promise<DocumentRow[]> {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('maintenance_ticket_id', maintenanceTicketId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });
  if (error) {
    logAppError('documents.listDocumentsForMaintenanceTicket', error);
    throw error;
  }
  return data ?? [];
}

/** Uploads to `attachments/maintenance/<ticketId>/<category>-<timestamp>.<ext>` (the path prefix the
 * `maintenance_photos_*` storage policies match on) and records it in `documents`. */
export async function uploadMaintenancePhoto(params: {
  maintenanceTicketId: string;
  category: Extract<DocumentCategory, 'photo_before' | 'photo_during' | 'photo_after'>;
  fileUri: string;
  contentType: string;
}): Promise<DocumentRow> {
  const ext = params.contentType.split('/')[1] ?? 'jpg';
  const path = `maintenance/${params.maintenanceTicketId}/${params.category}-${Date.now()}.${ext}`;
  await uploadAttachment(path, params.fileUri, params.contentType);

  const { data, error } = await supabase
    .from('documents')
    .insert({
      maintenance_ticket_id: params.maintenanceTicketId,
      category: params.category,
      file_name: path.split('/').pop() as string,
      file_url: path,
      mime_type: params.contentType,
    })
    .select()
    .single();
  if (error) {
    logAppError('documents.uploadMaintenancePhoto', error);
    throw error;
  }
  return data;
}

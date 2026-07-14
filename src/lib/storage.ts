import { supabase } from '@/lib/supabase';
import { logAppError } from '@/utils/errors';

const BUCKET = 'attachments';

/**
 * Uploads a local file (camera/gallery URI from expo-image-picker) to the private `attachments`
 * bucket and returns the storage PATH (not a public URL — the bucket is private, so callers must
 * request a fresh signed URL via `getAttachmentSignedUrl` whenever they need to display it).
 */
export async function uploadAttachment(
  path: string,
  fileUri: string,
  contentType: string
): Promise<string> {
  const response = await fetch(fileUri);
  const arrayBuffer = await response.arrayBuffer();
  const { error } = await supabase.storage.from(BUCKET).upload(path, arrayBuffer, {
    contentType,
    upsert: true,
  });
  if (error) {
    logAppError('storage.uploadAttachment', error);
    throw error;
  }
  return path;
}

/** Private bucket — every display of an attachment needs a freshly signed, time-limited URL. */
export async function getAttachmentSignedUrl(path: string, expiresInSeconds = 3600): Promise<string | null> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresInSeconds);
  if (error) {
    logAppError('storage.getAttachmentSignedUrl', error);
    return null;
  }
  return data.signedUrl;
}

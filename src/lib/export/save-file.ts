import { Platform } from 'react-native';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';

function base64ToBytes(base64: string): Uint8Array {
  const byteString = atob(base64);
  const bytes = new Uint8Array(byteString.length);
  for (let i = 0; i < byteString.length; i++) bytes[i] = byteString.charCodeAt(i);
  return bytes;
}

/** Cross-platform "download/share a generated file" — web triggers a browser download via a
 * Blob object URL (verifiable in this session's Playwright-only test environment); native writes
 * to the SDK 56 `File`/`Paths` API and hands off to `expo-sharing`. Used by every Export Center
 * dataset (Phase 8) and the Owner Statement CSV/Excel paths — one shared implementation, not one
 * per format. */
export async function saveAndShareFile(
  filename: string,
  content: string,
  encoding: 'utf8' | 'base64',
  mimeType: string
): Promise<void> {
  if (Platform.OS === 'web') {
    const bytes = encoding === 'base64' ? base64ToBytes(content) : new TextEncoder().encode(content);
    const blob = new Blob([bytes.buffer as ArrayBuffer], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    return;
  }

  const file = new File(Paths.cache, filename);
  if (encoding === 'base64') {
    file.write(base64ToBytes(content));
  } else {
    file.write(content);
  }
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: filename });
  }
}

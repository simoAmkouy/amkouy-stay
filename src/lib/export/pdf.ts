import { Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

/** Web: `Print.printAsync` opens the browser print dialog ("Save as PDF" is the browser's own
 * job — this is the Expo-documented web behavior, since `printToFileAsync` is native-only).
 * Native: renders to a real PDF file, then hands off to `expo-sharing`. */
export async function generatePdf(filename: string, html: string): Promise<void> {
  if (Platform.OS === 'web') {
    await Print.printAsync({ html });
    return;
  }
  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: filename });
  }
}

import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

/** Native only — pdf.web.ts overrides this file on web via Metro platform resolution.
 * Renders the HTML to a real PDF file, then opens the native share sheet. */
export async function generatePdf(filename: string, html: string): Promise<void> {
  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: filename });
  }
}

/** Generate the PDF and open the native share sheet (user can pick WhatsApp, Mail, etc.).
 * The `_whatsappText` param is accepted but unused on native — the share sheet handles text
 * composition. On web the override in pdf.web.ts uses it as a fallback WhatsApp message. */
export async function sharePdf(
  filename: string,
  html: string,
  _whatsappText: string
): Promise<void> {
  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: 'Partager la facture',
      UTI: 'com.adobe.pdf',
    });
  }
}

/**
 * Web overrides for PDF utilities — Metro resolves pdf.web.ts over pdf.ts on web.
 *
 * Root cause of the old print bug:
 *   expo-print's Print.printAsync on web calls window.print() on the CURRENT
 *   page and ignores the `html` parameter entirely (html is native-only in
 *   expo-print v56). That caused the browser to snapshot the live application
 *   DOM (the modal card) instead of the invoice.
 *
 * Fix: write the invoice HTML into a dedicated popup window so the browser
 * print dialog receives only the standalone invoice — no app chrome at all.
 */

function openInvoicePopup(html: string): Window | null {
  const win = window.open('', '_blank');
  if (!win) return null;
  win.document.open();
  win.document.write(html);
  win.document.close();
  return win;
}

function triggerPrint(win: Window): void {
  let printed = false;
  const doPrint = () => {
    if (printed) return;
    printed = true;
    win.focus();
    win.print();
    // Do NOT auto-close — the print dialog is async in many browsers and
    // closing the window before it resolves cancels the print job.
  };
  win.onload = doPrint;
  setTimeout(doPrint, 700);
}

/** Open the invoice in a popup window and trigger the browser print dialog. */
export async function generatePdf(_filename: string, html: string): Promise<void> {
  const win = openInvoicePopup(html);
  if (!win) {
    // eslint-disable-next-line no-alert
    alert(
      "La fenêtre d'impression a été bloquée.\n" +
      'Veuillez autoriser les popups pour ce site et réessayer.'
    );
    return;
  }
  triggerPrint(win);
}

/**
 * Web share flow:
 *  1. Try the Web Share API (supported on mobile browsers and some desktop
 *     browsers). No file attachment — we share text only, since generating a
 *     real PDF binary in the browser without a library is not feasible.
 *  2. Fallback A: if the device supports file sharing, share the invoice as an
 *     HTML file (opens in the browser — not a real PDF, but printable).
 *  3. Fallback B: open the print dialog so the user can save the invoice as a
 *     PDF, then open WhatsApp Web with a pre-filled message so they can paste
 *     the reference/details.
 */
export async function sharePdf(
  filename: string,
  html: string,
  whatsappText: string
): Promise<void> {
  // ── Attempt 1: Web Share API (text) ──────────────────────────────────────
  if (typeof navigator.share === 'function') {
    try {
      // Try with an HTML file attachment first (supported on Chrome Android, Safari iOS)
      const htmlBlob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const htmlFile = new File(
        [htmlBlob],
        filename.replace(/\.pdf$/i, '.html'),
        { type: 'text/html' }
      );
      const canShareFile =
        typeof navigator.canShare === 'function' &&
        navigator.canShare({ files: [htmlFile] });

      if (canShareFile) {
        await navigator.share({
          files: [htmlFile],
          title: 'Facture AMKOUY Stay',
          text: whatsappText,
        });
        return;
      }

      // Fallback: share text only (title + message)
      await navigator.share({
        title: 'Facture AMKOUY Stay',
        text: whatsappText,
      });
      return;
    } catch (e) {
      // User cancelled the share sheet — do nothing
      if ((e as Error).name === 'AbortError') return;
      // Other error — fall through to next option
    }
  }

  // ── Fallback: print dialog + WhatsApp Web ────────────────────────────────
  // 1. Open invoice in a new window and trigger print (so user can Save as PDF)
  const win = openInvoicePopup(html);
  if (win) triggerPrint(win);

  // 2. After a short delay, also open WhatsApp Web with the pre-filled message
  //    so the user can send the reference/summary to the guest directly.
  setTimeout(() => {
    const waUrl =
      'https://wa.me/?text=' + encodeURIComponent(whatsappText);
    window.open(waUrl, '_blank');
  }, 800);
}

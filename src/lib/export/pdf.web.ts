/**
 * Web overrides for PDF utilities — Metro resolves pdf.web.ts over pdf.ts on web.
 *
 * Root cause of the old print bug:
 *   expo-print's Print.printAsync on web calls window.print() on the CURRENT
 *   page and ignores the `html` parameter entirely (html is native-only in
 *   expo-print v56). That caused the browser to snapshot the live application
 *   DOM (the modal card) instead of the invoice.
 *
 * Fix for generatePdf: write the invoice HTML into a dedicated popup window
 * so the browser print dialog receives only the standalone invoice.
 *
 * Fix for sharePdf: render the invoice HTML to a real PDF blob via
 * html2canvas + jsPDF (loaded lazily so they don't bloat the initial bundle),
 * then share the PDF file via the Web Share API. WhatsApp and other apps on
 * mobile receive a proper .pdf attachment instead of an .html file.
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
 * Render the invoice HTML string into a real PDF Blob using html2canvas + jsPDF.
 *
 * Strategy:
 *  1. Load the self-contained invoice HTML into a hidden off-screen iframe via
 *     a blob: URL so the browser renders it with its full CSS applied.
 *  2. Wait briefly for fonts and layout to settle.
 *  3. Capture the rendered body with html2canvas (scale=2 for print quality).
 *  4. Slice the canvas into A4-sized strips and add each as a page in jsPDF.
 *  5. Return the resulting Blob.
 */
async function htmlToPdfBlob(html: string): Promise<Blob> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ]);

  // A4 dimensions in px at 96 dpi (matches CSS px in the browser)
  const A4_W_PX = 794;
  const A4_H_PX = 1123;
  const SCALE = 2; // retina-quality capture

  // Load invoice HTML into a hidden iframe via a blob: URL
  const iframe = document.createElement('iframe');
  iframe.style.cssText =
    `position:absolute;left:-9999px;top:-9999px;` +
    `width:${A4_W_PX}px;visibility:hidden;border:none;`;
  document.body.appendChild(iframe);

  try {
    await new Promise<void>((resolve, reject) => {
      const blobUrl = URL.createObjectURL(
        new Blob([html], { type: 'text/html;charset=utf-8' })
      );
      iframe.addEventListener(
        'load',
        () => { URL.revokeObjectURL(blobUrl); resolve(); },
        { once: true }
      );
      iframe.onerror = () => reject(new Error('Invoice iframe failed to load'));
      iframe.src = blobUrl;
    });

    const body = iframe.contentDocument?.body;
    if (!body) throw new Error('Could not access iframe document body');

    // Brief pause for fonts and layout paint to settle
    await new Promise<void>((r) => setTimeout(r, 350));

    const canvas = await html2canvas(body, {
      scale: SCALE,
      useCORS: true,
      allowTaint: true,
      width: A4_W_PX,
      height: body.scrollHeight,
      windowWidth: A4_W_PX,
    });

    // Use mm units (unambiguous) so both X and Y use the identical scale factor.
    // A4 portrait = 210 × 297 mm exactly.
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const PAGE_W_MM = 210;
    const PAGE_H_MM = 297;

    // Single proportional scale: how many mm per captured CSS pixel.
    // The iframe was rendered at A4_W_PX wide, so this ratio applies to both axes.
    const mmPerPx = PAGE_W_MM / A4_W_PX; // 210 / 794 ≈ 0.2645 mm/px

    // Canvas pixels that correspond to one A4 page height
    const pageCanvasH = Math.round((PAGE_H_MM / mmPerPx) * SCALE);
    let canvasY = 0;
    let firstPage = true;

    while (canvasY < canvas.height) {
      const sliceH = Math.min(pageCanvasH, canvas.height - canvasY);

      // Draw the slice into a temporary canvas
      const sliceCanvas = document.createElement('canvas');
      sliceCanvas.width = canvas.width;
      sliceCanvas.height = sliceH;
      sliceCanvas
        .getContext('2d')!
        .drawImage(canvas, 0, canvasY, canvas.width, sliceH, 0, 0, canvas.width, sliceH);

      const imgData = sliceCanvas.toDataURL('image/jpeg', 0.92);
      // Both dimensions derived from the same mmPerPx ratio — no independent X/Y scaling.
      const imgW_mm = PAGE_W_MM;
      const imgH_mm = (sliceH / SCALE) * mmPerPx;

      if (!firstPage) pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, 0, imgW_mm, imgH_mm);
      canvasY += sliceH;
      firstPage = false;
    }

    return pdf.output('blob');
  } finally {
    document.body.removeChild(iframe);
  }
}

/**
 * Web share flow:
 *  1. Generate a real PDF blob via html2canvas + jsPDF.
 *  2. Try Web Share API with the PDF file attached (works on Chrome Android,
 *     Safari iOS, and any browser/OS that passes navigator.canShare).
 *  3. Fallback A: share text only if file sharing is not supported.
 *  4. Fallback B: open the print dialog (Save as PDF) + WhatsApp Web with a
 *     pre-filled message for browsers/desktops where the Share API is absent.
 */
export async function sharePdf(
  filename: string,
  html: string,
  whatsappText: string
): Promise<void> {
  if (typeof navigator.share === 'function') {
    try {
      const pdfBlob = await htmlToPdfBlob(html);
      const pdfFile = new File([pdfBlob], filename, { type: 'application/pdf' });

      const canSharePdf =
        typeof navigator.canShare === 'function' &&
        navigator.canShare({ files: [pdfFile] });

      if (canSharePdf) {
        await navigator.share({
          files: [pdfFile],
          title: 'Facture AMKOUY Stay',
          text: whatsappText,
        });
        return;
      }

      // Device/browser supports sharing but not file attachments — share text
      await navigator.share({
        title: 'Facture AMKOUY Stay',
        text: whatsappText,
      });
      return;
    } catch (e) {
      // User cancelled the share sheet
      if ((e as Error).name === 'AbortError') return;
      // PDF generation or share failed — fall through to print fallback
    }
  }

  // ── Fallback: print dialog + WhatsApp Web ────────────────────────────────
  // 1. Open invoice in a new window and trigger print (user can Save as PDF)
  const win = openInvoicePopup(html);
  if (win) triggerPrint(win);

  // 2. After a short delay, open WhatsApp Web with a pre-filled message
  setTimeout(() => {
    window.open('https://wa.me/?text=' + encodeURIComponent(whatsappText), '_blank');
  }, 800);
}

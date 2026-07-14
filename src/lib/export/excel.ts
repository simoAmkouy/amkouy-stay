import * as XLSX from 'xlsx';

import { saveAndShareFile } from '@/lib/export/save-file';

const XLSX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export async function exportExcel(
  filename: string,
  sheetName: string,
  headers: string[],
  rows: (string | number | null | undefined)[][]
): Promise<void> {
  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31));
  const base64 = XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' }) as string;
  await saveAndShareFile(filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`, base64, 'base64', XLSX_MIME_TYPE);
}

import { saveAndShareFile } from '@/lib/export/save-file';

function escapeCsvValue(value: string | number | null | undefined): string {
  const s = value == null ? '' : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function buildCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  return [headers, ...rows].map((row) => row.map(escapeCsvValue).join(',')).join('\n');
}

export async function exportCsv(
  filename: string,
  headers: string[],
  rows: (string | number | null | undefined)[][]
): Promise<void> {
  const csv = buildCsv(headers, rows);
  await saveAndShareFile(filename.endsWith('.csv') ? filename : `${filename}.csv`, csv, 'utf8', 'text/csv');
}

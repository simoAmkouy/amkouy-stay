import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { AccessGuard } from '@/components/amkouy/access-guard';
import { DateFilterBar } from '@/components/amkouy/date-filter-bar';
import { FilterChipRow } from '@/components/amkouy/filter-chip-row';
import { Screen } from '@/components/amkouy/screen';
import { ScreenHeader } from '@/components/amkouy/screen-header';
import { Icon } from '@/components/icon';
import { AmkouyColors } from '@/constants/amkouy-theme';
import { robotoText } from '@/constants/typography';
import { Resource, canAccess } from '@/constants/permissions';
import { useAuth } from '@/hooks/use-auth';
import { DateFilterProvider, useDateFilter } from '@/hooks/use-date-filter';
import { exportCsv } from '@/lib/export/csv';
import { exportExcel } from '@/lib/export/excel';
import { getLogoDataUri } from '@/lib/export/logo-data-uri';
import { generatePdf } from '@/lib/export/pdf';
import { listCleaningTasks } from '@/lib/queries/cleaning-tasks';
import { listContracts } from '@/lib/queries/contracts';
import { listExpenses } from '@/lib/queries/expenses';
import { listMaintenanceTickets } from '@/lib/queries/maintenance-tickets';
import { listOwnerPayments } from '@/lib/queries/owner-payments';
import { getLedgerEntries, listAllPayments } from '@/lib/queries/payments';
import { listAllReservationServicesForOps } from '@/lib/queries/reservation-services';
import { listReservations } from '@/lib/queries/reservations';
import { REPORT_QUICK_FILTERS, formatRangeLabel, toDateOnlyString } from '@/utils/date-range';
import { notify } from '@/utils/alert';
import { getErrorMessage } from '@/utils/errors';

type DatasetKey =
  | 'reservations'
  | 'expenses'
  | 'owner_payments'
  | 'contracts'
  | 'concierge'
  | 'maintenance'
  | 'cleaning'
  | 'payments'
  | 'refunds'
  | 'ledger';

const DATASETS: { key: DatasetKey; label: string; resource: Resource; dateField: string }[] = [
  { key: 'reservations', label: 'Réservations', resource: 'reservations', dateField: 'check_in_date' },
  { key: 'expenses', label: 'Dépenses', resource: 'expenses', dateField: 'expense_date' },
  { key: 'owner_payments', label: 'Versements propriétaires', resource: 'owner_payments', dateField: 'due_date' },
  { key: 'contracts', label: 'Contrats', resource: 'contracts', dateField: 'start_date' },
  { key: 'concierge', label: 'Services concierge', resource: 'concierge_reports', dateField: 'requested_date' },
  { key: 'maintenance', label: 'Maintenance', resource: 'maintenance', dateField: 'created_at' },
  { key: 'cleaning', label: 'Ménage', resource: 'cleaning', dateField: 'scheduled_date' },
  // Module 9 (Phase 14) — gated to `reports` (both manager and accountant already hold it),
  // not `reservations`, since accountant needs full finance export access (Phase 16) without
  // needing full reservation-management access.
  { key: 'payments', label: 'Paiements clients', resource: 'reports', dateField: 'processed_at' },
  { key: 'refunds', label: 'Remboursements', resource: 'reports', dateField: 'processed_at' },
  { key: 'ledger', label: 'Grand livre', resource: 'reports', dateField: 'entry_date' },
];

type FormatKey = 'csv' | 'excel' | 'pdf';

async function fetchDataset(key: DatasetKey): Promise<Record<string, unknown>[]> {
  switch (key) {
    case 'reservations':
      return listReservations() as unknown as Record<string, unknown>[];
    case 'expenses':
      return listExpenses() as unknown as Record<string, unknown>[];
    case 'owner_payments':
      return listOwnerPayments() as unknown as Record<string, unknown>[];
    case 'contracts':
      return listContracts() as unknown as Record<string, unknown>[];
    case 'concierge':
      return listAllReservationServicesForOps() as unknown as Record<string, unknown>[];
    case 'maintenance':
      return listMaintenanceTickets() as unknown as Record<string, unknown>[];
    case 'cleaning':
      return listCleaningTasks() as unknown as Record<string, unknown>[];
    case 'payments':
      return listAllPayments() as unknown as Record<string, unknown>[];
    case 'refunds':
      return (await listAllPayments()).filter((p) => p.type === 'refund' || p.type === 'deposit_release') as unknown as Record<string, unknown>[];
    case 'ledger':
      return getLedgerEntries({ limit: 5000 }) as unknown as Record<string, unknown>[];
  }
}

/** Flattens each dataset's own row shape into a stable, spreadsheet-friendly column set —
 * reuses the exact same RLS-scoped `list*()` query every existing screen already calls; nothing
 * new is fetched here beyond what the app already reads. */
function toTable(key: DatasetKey, rows: Record<string, unknown>[]): { headers: string[]; rows: (string | number)[][] } {
  const pick = (row: Record<string, unknown>, path: string): string | number => {
    const value = path.split('.').reduce<unknown>((acc, part) => (acc as Record<string, unknown> | null)?.[part] ?? null, row);
    return value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : (value as string | number);
  };
  const columnsByDataset: Record<DatasetKey, [string, string][]> = {
    reservations: [['Code', 'reservation_code'], ['Bien', 'property.name'], ['Client', 'guest.full_name'], ['Arrivée', 'check_in_date'], ['Départ', 'check_out_date'], ['Statut', 'status'], ['Total', 'total_amount']],
    expenses: [['N°', 'expense_number'], ['Catégorie', 'category'], ['Description', 'description'], ['Date', 'expense_date'], ['Montant', 'amount'], ['Statut', 'status']],
    owner_payments: [['N°', 'payment_number'], ['Propriétaire', 'owner.full_name'], ['Bien', 'property.name'], ['Période début', 'period_start'], ['Période fin', 'period_end'], ['Net', 'net_amount'], ['Statut', 'status'], ['Échéance', 'due_date']],
    contracts: [['N°', 'contract_number'], ['Propriétaire', 'owner.full_name'], ['Bien', 'property.name'], ['Statut', 'status'], ['Commission %', 'commission_pct'], ['Début', 'start_date'], ['Fin', 'end_date']],
    concierge: [['N°', 'request_number'], ['Service', 'service.name'], ['Prestataire', 'provider.name'], ['Statut', 'status'], ['Total', 'total_price'], ['Profit', 'profit']],
    maintenance: [['N°', 'ticket_number'], ['Bien', 'property.name'], ['Catégorie', 'category'], ['Priorité', 'priority'], ['Statut', 'status'], ['Coût réel', 'actual_cost']],
    cleaning: [['N°', 'task_number'], ['Bien', 'property.name'], ['Date prévue', 'scheduled_date'], ['Statut', 'status'], ['Coût', 'cost_amount']],
    payments: [['Type', 'type'], ['Montant', 'amount'], ['Devise', 'currency'], ['Moyen', 'method'], ['Statut', 'status'], ['Traité le', 'processed_at'], ['Référence', 'gateway_reference']],
    refunds: [['Type', 'type'], ['Montant', 'amount'], ['Moyen', 'method'], ['Statut', 'status'], ['Traité le', 'processed_at']],
    ledger: [['Référence', 'reference_number'], ['Type', 'entity_type'], ['Montant', 'amount'], ['Sens', 'direction'], ['Date', 'entry_date'], ['Notes', 'notes']],
  };
  const columns = columnsByDataset[key];
  return { headers: columns.map((c) => c[0]), rows: rows.map((row) => columns.map((c) => pick(row, c[1]))) };
}

function buildTableHtml(title: string, subtitle: string, headers: string[], rows: (string | number)[][], logoDataUri?: string): string {
  const theadCells = headers.map((h) => `<th>${h}</th>`).join('');
  const bodyRows = rows.map((r) => `<tr>${r.map((v) => `<td>${String(v)}</td>`).join('')}</tr>`).join('');
  return `<!DOCTYPE html><html><head><meta charset="utf-8" /><style>
    body { font-family: -apple-system, Helvetica, Arial, sans-serif; padding: 24px; color: #1a1a1a; }
    .header { display: flex; align-items: center; gap: 12px; margin-bottom: 18px; }
    .header img { height: 40px; width: auto; object-fit: contain; }
    h1 { color: #0F1F3D; font-size: 18px; margin-bottom: 2px; }
    .sub { color: #666; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th { background: #0F1F3D; color: #fff; text-align: left; padding: 6px 8px; }
    td { padding: 5px 8px; border-bottom: 1px solid #eee; }
  </style></head><body>
  <div class="header">
    ${logoDataUri ? `<img src="${logoDataUri}" alt="Amkouy Immobilier" />` : ''}
    <div><h1>AMKOUY STAY — ${title}</h1><div class="sub">${subtitle}</div></div>
  </div>
  <table><thead><tr>${theadCells}</tr></thead><tbody>${bodyRows}</tbody></table></body></html>`;
}

export default function ExportCenterScreen() {
  return (
    <AccessGuard resource="reports">
      <DateFilterProvider initialFilter="this_month">
        <ExportCenterContent />
      </DateFilterProvider>
    </AccessGuard>
  );
}

function ExportCenterContent() {
  const { profile } = useAuth();
  const { range } = useDateFilter();
  const [dataset, setDataset] = useState<DatasetKey>('reservations');
  const [format, setFormat] = useState<FormatKey>('csv');
  const [busy, setBusy] = useState(false);

  const visibleDatasets = DATASETS.filter((d) => canAccess(profile?.role, d.resource));
  const activeDataset = DATASETS.find((d) => d.key === dataset) ?? visibleDatasets[0];

  const handleExport = async () => {
    if (!activeDataset) return;
    setBusy(true);
    try {
      const raw = await fetchDataset(activeDataset.key);
      const startStr = toDateOnlyString(range.start);
      const endStr = toDateOnlyString(range.end);
      const filtered = raw.filter((row) => {
        const value = (row as Record<string, unknown>)[activeDataset.dateField];
        if (typeof value !== 'string') return true;
        const dateOnly = value.slice(0, 10);
        return dateOnly >= startStr && dateOnly <= endStr;
      });
      const { headers, rows } = toTable(activeDataset.key, filtered);
      const filenameBase = `${activeDataset.key.toUpperCase()}-${startStr}-to-${endStr}`;

      if (format === 'csv') await exportCsv(filenameBase, headers, rows);
      else if (format === 'excel') await exportExcel(filenameBase, activeDataset.label, headers, rows);
      else {
        const logoDataUri = await getLogoDataUri().catch(() => undefined);
        await generatePdf(`${filenameBase}.pdf`, buildTableHtml(activeDataset.label, formatRangeLabel(range), headers, rows, logoDataUri));
      }

      notify('Export terminé', `${rows.length} lignes exportées (${activeDataset.label}).`);
    } catch (error) {
      notify('Erreur', getErrorMessage(error, "Impossible de générer l'export."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <ScreenHeader title="Centre d'export" subtitle={formatRangeLabel(range)} showBack fallbackHref="/more/reports" />
      <DateFilterBar filters={REPORT_QUICK_FILTERS} />

      <View style={styles.content}>
        <Text style={styles.label}>Jeu de données</Text>
        <FilterChipRow
          options={visibleDatasets.map((d) => d.key)}
          active={activeDataset?.key ?? 'reservations'}
          onChange={setDataset}
          getLabel={(k) => visibleDatasets.find((d) => d.key === k)?.label ?? k}
        />

        <Text style={styles.label}>Format</Text>
        <View style={styles.formatRow}>
          {(['csv', 'excel', 'pdf'] as FormatKey[]).map((f) => (
            <Pressable key={f} onPress={() => setFormat(f)} style={[styles.formatChip, format === f && styles.formatChipActive]}>
              <Icon name={f === 'pdf' ? 'picture_as_pdf' : f === 'excel' ? 'grid_on' : 'description'} size={18} color={format === f ? '#fff' : AmkouyColors.textMuted} />
              <Text style={[styles.formatText, format === f && { color: '#fff' }]}>{f.toUpperCase()}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.hint}>
          L&apos;export respecte votre rôle (RBAC), la visibilité RLS en vigueur, et la période sélectionnée ci-dessus
          ({activeDataset?.label ?? '—'} · {activeDataset?.dateField}).
        </Text>

        <Pressable onPress={handleExport} disabled={busy || !activeDataset} style={styles.exportButton}>
          {busy ? <ActivityIndicator color="#fff" /> : <Icon name="file_download" size={20} color="#fff" />}
          <Text style={styles.exportButtonText}>{busy ? 'Génération…' : 'Exporter'}</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 22,
    paddingTop: 8,
  },
  label: {
    ...robotoText(600, 12, { color: AmkouyColors.textMuted, marginTop: 18, marginBottom: 8 }),
  },
  formatRow: {
    flexDirection: 'row',
    gap: 10,
  },
  formatChip: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: AmkouyColors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  formatChipActive: {
    backgroundColor: AmkouyColors.primary,
    borderColor: AmkouyColors.primary,
  },
  formatText: {
    ...robotoText(600, 12, { color: AmkouyColors.textMuted }),
  },
  hint: {
    ...robotoText(400, 11, { color: AmkouyColors.textFaint, marginTop: 18, lineHeight: 16 }),
  },
  exportButton: {
    marginTop: 24,
    height: 52,
    borderRadius: 16,
    backgroundColor: AmkouyColors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  exportButtonText: {
    ...robotoText(700, 14, { color: '#fff' }),
  },
});

import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AccessGuard } from '@/components/amkouy/access-guard';
import { BarChart } from '@/components/amkouy/bar-chart';
import { Card } from '@/components/amkouy/card';
import { DateFilterBar } from '@/components/amkouy/date-filter-bar';
import { EmptyState } from '@/components/amkouy/empty-state';
import { ErrorState } from '@/components/amkouy/error-state';
import { LoadingState } from '@/components/amkouy/loading-state';
import { Screen } from '@/components/amkouy/screen';
import { ScreenHeader } from '@/components/amkouy/screen-header';
import { SelectField } from '@/components/amkouy/select-field';
import { Icon } from '@/components/icon';
import { AmkouyColors } from '@/constants/amkouy-theme';
import { robotoText } from '@/constants/typography';
import { useOwners } from '@/hooks/use-owners';
import { DateFilterProvider, useDateFilter } from '@/hooks/use-date-filter';
import { useOwnerStatement, useOwnerStatementTimeline } from '@/hooks/use-reports';
import { exportCsv } from '@/lib/export/csv';
import { exportExcel } from '@/lib/export/excel';
import { exportOwnerStatementPdf } from '@/lib/export/owner-statement-pdf';
import { REPORT_QUICK_FILTERS, formatRangeLabel } from '@/utils/date-range';
import { notify } from '@/utils/alert';
import { getErrorMessage } from '@/utils/errors';
import { formatMAD } from '@/utils/format';

export default function OwnerStatementScreen() {
  return (
    <AccessGuard resource="reports">
      <DateFilterProvider initialFilter="this_month">
        <OwnerStatementContent />
      </DateFilterProvider>
    </AccessGuard>
  );
}

function OwnerStatementContent() {
  const { range } = useDateFilter();
  const { data: owners, isLoading: ownersLoading } = useOwners();
  const [ownerId, setOwnerId] = useState<string | undefined>(undefined);
  const [exporting, setExporting] = useState<'pdf' | 'csv' | 'excel' | null>(null);

  const owner = owners?.find((o) => o.id === ownerId);
  const { data: statement, isLoading, isError, refetch } = useOwnerStatement(ownerId, range);
  const { data: timeline } = useOwnerStatementTimeline(ownerId, range);

  const ownerOptions = (owners ?? []).map((o) => ({ label: o.full_name, value: o.id }));

  const maxRevenue = Math.max(1, ...(timeline ?? []).map((t) => t.revenue));
  const chartData = (timeline ?? []).map((t) => ({
    m: new Date(t.month).toLocaleDateString('fr-FR', { month: 'short' }),
    h: `${Math.max(4, Math.round((t.revenue / maxRevenue) * 100))}%`,
    color: AmkouyColors.primaryContainer,
  }));

  const handleExportPdf = async () => {
    if (!statement || !owner) return;
    setExporting('pdf');
    try {
      await exportOwnerStatementPdf({
        ownerName: owner.full_name,
        propertyName: 'Portefeuille', // an owner may hold several properties; see detail table for per-property breakdown
        propertyCity: '',
        range,
        statement,
      });
    } catch (error) {
      notify('Erreur', getErrorMessage(error, 'Impossible de générer le PDF.'));
    } finally {
      setExporting(null);
    }
  };

  const handleExportCsv = async () => {
    if (!statement || !owner) return;
    setExporting('csv');
    try {
      await exportCsv(`OWNER-STATEMENT-${owner.full_name}`, ['Champ', 'Valeur'], [
        ['Propriétaire', owner.full_name],
        ['Période', formatRangeLabel(range)],
        ['Réservations', statement.reservationsCount],
        ['Nuits occupées', statement.occupiedNights],
        ["Taux d'occupation", `${statement.occupancyRate}%`],
        ['Revenu', statement.revenue],
        ['Remboursements', statement.refunds],
        ['Revenu concierge', statement.conciergeRevenue],
        ['Dépenses', statement.expenses],
        ['Coûts ménage', statement.cleaningCosts],
        ['Coûts maintenance', statement.maintenanceCosts],
        ['Revenu net', statement.netRevenue],
        ['Commission (%)', statement.commissionPct],
        ['Part propriétaire', statement.ownerShare],
        ['Part Amkouy', statement.amkouyShare],
        ['Versements payés', statement.ownerPaymentsTotal],
        ['Versements en attente', statement.pendingPaymentsTotal],
        ['Statut contrat', statement.contractStatus],
      ]);
    } catch (error) {
      notify('Erreur', getErrorMessage(error, "Impossible d'exporter le CSV."));
    } finally {
      setExporting(null);
    }
  };

  const handleExportExcel = async () => {
    if (!statement || !owner) return;
    setExporting('excel');
    try {
      await exportExcel(`OWNER-STATEMENT-${owner.full_name}`, 'Relevé', ['Champ', 'Valeur'], [
        ['Propriétaire', owner.full_name],
        ['Période', formatRangeLabel(range)],
        ['Revenu', statement.revenue],
        ['Remboursements', statement.refunds],
        ['Revenu concierge', statement.conciergeRevenue],
        ['Dépenses', statement.expenses],
        ['Coûts ménage', statement.cleaningCosts],
        ['Coûts maintenance', statement.maintenanceCosts],
        ['Revenu net', statement.netRevenue],
        ['Part propriétaire', statement.ownerShare],
        ['Part Amkouy', statement.amkouyShare],
      ]);
    } catch (error) {
      notify('Erreur', getErrorMessage(error, "Impossible d'exporter le fichier Excel."));
    } finally {
      setExporting(null);
    }
  };

  return (
    <Screen>
      <ScreenHeader title="Relevé propriétaire" subtitle={formatRangeLabel(range)} showBack fallbackHref="/more/reports" />
      <DateFilterBar filters={REPORT_QUICK_FILTERS} />

      <View style={styles.content}>
        <SelectField
          label="Propriétaire"
          value={ownerId ?? ''}
          options={ownerOptions}
          onChange={setOwnerId}
          placeholder={ownersLoading ? 'Chargement…' : 'Sélectionner un propriétaire…'}
        />

        {!ownerId && <EmptyState icon="receipt_long" message="Sélectionnez un propriétaire pour générer son relevé." />}
        {ownerId && isLoading && <LoadingState label="Calcul du relevé…" />}
        {ownerId && isError && <ErrorState message="Impossible de calculer le relevé." onRetry={refetch} />}

        {ownerId && statement && !isLoading && (
          <>
            <Card style={styles.netCard}>
              <Text style={styles.netLabel}>Revenu net</Text>
              <Text style={styles.netValue}>{formatMAD(statement.netRevenue)}</Text>
              <View style={styles.netSplitRow}>
                <Text style={styles.netSplit}>Propriétaire {formatMAD(statement.ownerShare)}</Text>
                <Text style={styles.netSplit}>Amkouy {formatMAD(statement.amkouyShare)} ({statement.commissionPct}%)</Text>
              </View>
            </Card>

            <SectionCard title="Réservations">
              <Row label="Réservations" value={String(statement.reservationsCount)} />
              <Row label="Nuits occupées" value={String(statement.occupiedNights)} />
              <Row label="Taux d'occupation" value={`${statement.occupancyRate}%`} />
            </SectionCard>

            <SectionCard title="Revenus & coûts">
              <Row label="Revenu hébergement" value={formatMAD(statement.revenue)} />
              <Row label="Remboursements" value={`- ${formatMAD(statement.refunds)}`} />
              <Row label="Revenu concierge" value={formatMAD(statement.conciergeRevenue)} />
              <Row label="Dépenses" value={`- ${formatMAD(statement.expenses)}`} />
              <Row label="Coûts de ménage" value={`- ${formatMAD(statement.cleaningCosts)}`} />
              <Row label="Coûts de maintenance" value={`- ${formatMAD(statement.maintenanceCosts)}`} />
            </SectionCard>

            <SectionCard title="Versements & contrat">
              <Row label="Versements payés" value={formatMAD(statement.ownerPaymentsTotal)} />
              <Row label="Versements en attente" value={formatMAD(statement.pendingPaymentsTotal)} />
              <Row label="Statut du contrat" value={statement.contractStatus} />
            </SectionCard>

            {chartData.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Évolution du revenu</Text>
                <Card style={styles.chartCard}>
                  <BarChart data={chartData} />
                </Card>
              </>
            )}

            <Text style={styles.sectionTitle}>Export</Text>
            <View style={styles.exportRow}>
              <ExportButton icon="picture_as_pdf" label="PDF" loading={exporting === 'pdf'} onPress={handleExportPdf} />
              <ExportButton icon="grid_on" label="Excel" loading={exporting === 'excel'} onPress={handleExportExcel} />
              <ExportButton icon="description" label="CSV" loading={exporting === 'csv'} onPress={handleExportCsv} />
            </View>
          </>
        )}
      </View>
    </Screen>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Card style={styles.sectionCard}>{children}</Card>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function ExportButton({ icon, label, loading, onPress }: { icon: string; label: string; loading: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} disabled={loading} style={styles.exportButton}>
      <Icon name={icon} size={20} color={AmkouyColors.primary} />
      <Text style={styles.exportButtonText}>{loading ? '…' : label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 22,
    paddingTop: 8,
    gap: 4,
  },
  netCard: {
    marginTop: 12,
    padding: 18,
    alignItems: 'center',
  },
  netLabel: {
    ...robotoText(500, 12, { color: AmkouyColors.textMuted }),
  },
  netValue: {
    ...robotoText(900, 26, { color: AmkouyColors.primary, marginTop: 4 }),
  },
  netSplitRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 10,
  },
  netSplit: {
    ...robotoText(500, 11, { color: AmkouyColors.textFaint }),
  },
  sectionTitle: {
    ...robotoText(700, 15, { color: AmkouyColors.primary, marginTop: 22, marginBottom: 8 }),
  },
  sectionCard: {
    paddingHorizontal: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: AmkouyColors.hairline,
  },
  rowLabel: {
    ...robotoText(400, 13, { color: AmkouyColors.textMuted }),
  },
  rowValue: {
    ...robotoText(600, 13, { color: AmkouyColors.text }),
  },
  chartCard: {
    padding: 16,
  },
  exportRow: {
    flexDirection: 'row',
    gap: 10,
  },
  exportButton: {
    flex: 1,
    height: 56,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: AmkouyColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  exportButtonText: {
    ...robotoText(600, 11, { color: AmkouyColors.primary }),
  },
});

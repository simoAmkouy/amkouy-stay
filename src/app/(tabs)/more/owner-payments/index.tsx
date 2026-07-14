import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AccessGuard } from '@/components/amkouy/access-guard';
import { Badge } from '@/components/amkouy/badge';
import { Card } from '@/components/amkouy/card';
import { DateFilterBar } from '@/components/amkouy/date-filter-bar';
import { EmptyState } from '@/components/amkouy/empty-state';
import { ErrorState } from '@/components/amkouy/error-state';
import { FilterChipRow } from '@/components/amkouy/filter-chip-row';
import { ListFilterBar } from '@/components/amkouy/list-filter-bar';
import { LoadingState } from '@/components/amkouy/loading-state';
import { Screen } from '@/components/amkouy/screen';
import { SelectField } from '@/components/amkouy/select-field';
import { SortOption } from '@/components/amkouy/sort-selector';
import { StatCard } from '@/components/amkouy/stat-card';
import { GenerateSettlementsForm } from '@/components/forms/generate-settlements-form';
import { OwnerPaymentCreateForm } from '@/components/forms/owner-payment-form';
import { Icon } from '@/components/icon';
import { AmkouyColors } from '@/constants/amkouy-theme';
import { robotoText } from '@/constants/typography';
import { DateFilterProvider, useDateFilter } from '@/hooks/use-date-filter';
import { useCreateOwnerPayment, useGenerateOwnerSettlements, useOwnerPayments } from '@/hooks/use-owner-payments';
import { useOwners } from '@/hooks/use-owners';
import { useProperties } from '@/hooks/use-properties';
import { exportCsv } from '@/lib/export/csv';
import { computeDisplayStatus, DisplayStatus } from '@/lib/queries/owner-payments';
import { DISPLAY_STATUS_OPTIONS, GenerateSettlementsValues, OwnerPaymentCreateValues } from '@/lib/validation/owner-payment';
import { notify } from '@/utils/alert';
import { getErrorMessage } from '@/utils/errors';
import { formatMAD } from '@/utils/format';

const STATUS_FILTERS = [{ label: 'Tous', value: 'all' }, ...DISPLAY_STATUS_OPTIONS] as const;

type SortValue = 'created_desc' | 'created_asc' | 'updated_desc' | 'amount_desc' | 'amount_asc' | 'owner_asc' | 'due_asc' | 'due_desc';

const SORT_OPTIONS: SortOption<SortValue>[] = [
  { label: 'Plus récents', value: 'created_desc' },
  { label: 'Plus anciens', value: 'created_asc' },
  { label: 'Récemment mis à jour', value: 'updated_desc' },
  { label: 'Montant décroissant', value: 'amount_desc' },
  { label: 'Montant croissant', value: 'amount_asc' },
  { label: 'Propriétaire A-Z', value: 'owner_asc' },
  { label: 'Échéance (croissant)', value: 'due_asc' },
  { label: 'Échéance (décroissant)', value: 'due_desc' },
];

function compareStrings(a: string, b: string) {
  return a.localeCompare(b);
}
const STATUS_LABEL = Object.fromEntries(DISPLAY_STATUS_OPTIONS.map((o) => [o.value, o.label]));
const STATUS_COLOR: Record<DisplayStatus, { bg: string; text: string }> = {
  upcoming: { bg: '#E3E9F4', text: '#1E3A6E' },
  due: { bg: '#F8EFD4', text: '#8a6d1c' },
  overdue: { bg: '#FAD9D9', text: '#B91C1C' },
  approved: { bg: '#E4E9FA', text: '#3730A3' },
  paid: { bg: '#DEF7E6', text: '#15803D' },
  cancelled: { bg: '#EEF0F4', text: '#5A5E66' },
};

export default function OwnerPaymentsScreen() {
  return (
    <AccessGuard resource="owner_payments">
      <DateFilterProvider>
        <OwnerPaymentsContent />
      </DateFilterProvider>
    </AccessGuard>
  );
}

function OwnerPaymentsContent() {
  const { range } = useDateFilter();
  // Executive Command Center deep-link: `?filter=manual` seeds a filter to only the payments
  // whose financial figures were NOT produced by the settlement engine (Financial Truth
  // Remediation, Phase 2) — same `is_manual_adjustment` column, no new query.
  const params = useLocalSearchParams<{ filter?: string }>();
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [ownerFilter, setOwnerFilter] = useState<string | null>(null);
  const [propertyFilter, setPropertyFilter] = useState<string | null>(null);
  const [manualOnly, setManualOnly] = useState(params.filter === 'manual');
  const [sortBy, setSortBy] = useState<SortValue>('due_asc');
  const [showCreate, setShowCreate] = useState(false);
  const [showGenerate, setShowGenerate] = useState(false);

  const { data: payments, isLoading, isError, refetch } = useOwnerPayments();
  const { data: owners } = useOwners();
  const { data: properties } = useProperties();
  const createPayment = useCreateOwnerPayment();
  const generateSettlements = useGenerateOwnerSettlements();

  const ownerOptions = (owners ?? []).map((o) => ({ label: o.full_name, value: o.id }));
  const propertyOptions = (properties ?? []).map((p) => ({ label: `${p.name} · ${p.city}`, value: p.id }));

  const filtered = useMemo(() => {
    const list = (payments ?? []).filter((p) => {
      const displayStatus = computeDisplayStatus(p);
      const matchesQuery =
        query.trim().length === 0 ||
        p.payment_number.toLowerCase().includes(query.toLowerCase()) ||
        (p.owner?.full_name ?? '').toLowerCase().includes(query.toLowerCase());
      const matchesStatus = statusFilter === 'all' || displayStatus === statusFilter;
      const matchesOwner = !ownerFilter || p.owner_id === ownerFilter;
      const matchesProperty = !propertyFilter || p.property_id === propertyFilter;
      const matchesManual = !manualOnly || p.is_manual_adjustment;
      const dueTime = p.due_date ? new Date(p.due_date).getTime() : null;
      const inRange = !dueTime || (dueTime >= range.start.getTime() && dueTime <= range.end.getTime());
      return matchesQuery && matchesStatus && matchesOwner && matchesProperty && matchesManual && inRange;
    });
    const sorted = [...list];
    sorted.sort((a, b) => {
      switch (sortBy) {
        case 'created_desc':
          return compareStrings(b.created_at, a.created_at);
        case 'created_asc':
          return compareStrings(a.created_at, b.created_at);
        case 'updated_desc':
          return compareStrings(b.updated_at, a.updated_at);
        case 'amount_desc':
          return b.net_amount - a.net_amount;
        case 'amount_asc':
          return a.net_amount - b.net_amount;
        case 'owner_asc':
          return compareStrings(a.owner?.full_name ?? '', b.owner?.full_name ?? '');
        case 'due_asc':
          return compareStrings(a.due_date ?? '', b.due_date ?? '');
        case 'due_desc':
          return compareStrings(b.due_date ?? '', a.due_date ?? '');
        default:
          return 0;
      }
    });
    return sorted;
  }, [payments, query, statusFilter, ownerFilter, propertyFilter, manualOnly, range, sortBy]);

  const summary = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekEnd = new Date(today);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    let dueToday = 0;
    let dueThisWeek = 0;
    let overdue = 0;
    let paidThisMonth = 0;

    for (const p of payments ?? []) {
      const status = computeDisplayStatus(p);
      if (status === 'due') dueToday += 1;
      if (status === 'upcoming' && p.due_date && new Date(p.due_date) <= weekEnd) dueThisWeek += 1;
      if (status === 'overdue') overdue += 1;
      if (status === 'paid' && p.paid_at && new Date(p.paid_at) >= monthStart) paidThisMonth += p.net_amount;
    }
    return { dueToday, dueThisWeek, overdue, paidThisMonth };
  }, [payments]);

  const handleCreate = (values: OwnerPaymentCreateValues) => {
    createPayment.mutate(
      {
        propertyId: values.propertyId,
        periodStart: values.periodStart,
        periodEnd: values.periodEnd,
        dueDate: values.dueDate,
        paymentMethod: values.paymentMethod,
        paymentReference: values.paymentReference,
        notes: values.notes,
      },
      {
        onSuccess: () => {
          setShowCreate(false);
          notify('Versement créé', 'Le versement a été ajouté avec succès, calculé à partir des données réelles.');
        },
        onError: (error) => notify('Erreur', getErrorMessage(error, 'Impossible de créer le versement.')),
      }
    );
  };

  const handleGenerate = (values: GenerateSettlementsValues) => {
    generateSettlements.mutate(
      { periodStart: values.periodStart, periodEnd: values.periodEnd },
      {
        onSuccess: (results) => {
          setShowGenerate(false);
          const created = results.filter((r) => r.generated).length;
          const skipped = results.length - created;
          notify(
            'Versements générés',
            `${created} versement(s) créé(s) à partir des données financières vérifiées.${
              skipped > 0 ? ` ${skipped} bien(s) avaient déjà un versement pour cette période (ignorés).` : ''
            }`
          );
        },
        onError: (error) => notify('Erreur', getErrorMessage(error, 'Impossible de générer les versements.')),
      }
    );
  };

  const handleExport = async () => {
    await exportCsv(
      'versements-proprietaires',
      ['N°', 'Propriétaire', 'Bien', 'Période début', 'Période fin', 'Revenu brut', 'Dépenses', 'Commission', 'Montant dû', 'Statut', 'Échéance'],
      filtered.map((p) => [
        p.payment_number,
        p.owner?.full_name ?? '',
        p.property?.name ?? '',
        p.period_start,
        p.period_end,
        p.gross_revenue,
        p.total_expenses,
        p.commission_amount,
        p.net_amount,
        STATUS_LABEL[computeDisplayStatus(p)] ?? p.status,
        p.due_date ?? '',
      ])
    );
  };

  return (
    <Screen contentPadding={false}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Paiements propriétaires</Text>
          <Text style={styles.subtitle}>{payments ? `${payments.length} au total` : 'Chargement…'}</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable onPress={handleExport} style={styles.iconButtonGhost}>
            <Icon name="download" size={20} color={AmkouyColors.primary} />
          </Pressable>
          <Pressable onPress={() => setShowGenerate(true)} style={styles.generateButton}>
            <Icon name="auto_awesome" size={18} color={AmkouyColors.primary} />
            <Text style={styles.generateButtonText}>Générer</Text>
          </Pressable>
          <Pressable onPress={() => setShowCreate(true)} style={styles.addButton}>
            <Icon name="add" size={24} color="#fff" />
          </Pressable>
        </View>
      </View>

      <DateFilterBar />

      <View style={styles.summaryRow}>
        <StatCard value={String(summary.dueToday)} label="Dus aujourd'hui" valueColor={AmkouyColors.secondary} bordered />
        <StatCard value={String(summary.dueThisWeek)} label="Dus cette semaine" valueColor={AmkouyColors.primaryContainer} bordered />
      </View>
      <View style={styles.summaryRow}>
        <StatCard value={String(summary.overdue)} label="En retard" valueColor={AmkouyColors.error} bordered />
        <StatCard value={formatMAD(summary.paidThisMonth)} label="Payé ce mois" valueColor={AmkouyColors.success} bordered />
      </View>

      <ListFilterBar
        searchValue={query}
        onSearchChange={setQuery}
        searchPlaceholder="N° versement, propriétaire…"
        sortOptions={SORT_OPTIONS}
        sortValue={sortBy}
        onSortChange={setSortBy}
        onRefresh={refetch}
      />

      <View style={styles.filterRow}>
        <FilterChipRow
          options={STATUS_FILTERS.map((f) => f.value)}
          active={statusFilter}
          onChange={setStatusFilter}
          getLabel={(v) => STATUS_FILTERS.find((f) => f.value === v)?.label ?? v}
        />
      </View>

      <View style={styles.filterRow}>
        <Pressable onPress={() => setManualOnly((v) => !v)} style={[styles.manualToggle, manualOnly && styles.manualToggleActive]}>
          <Icon name="warning" size={15} color={manualOnly ? '#fff' : '#B45309'} />
          <Text style={[styles.manualToggleText, manualOnly && { color: '#fff' }]}>Ajustements manuels uniquement</Text>
        </Pressable>
      </View>

      <View style={styles.dualFilterRow}>
        <View style={{ flex: 1 }}>
          <SelectField label="Propriétaire" value={ownerFilter} options={ownerOptions} onChange={setOwnerFilter} placeholder="Tous" />
        </View>
        <View style={{ flex: 1 }}>
          <SelectField label="Bien" value={propertyFilter} options={propertyOptions} onChange={setPropertyFilter} placeholder="Tous" />
        </View>
      </View>

      {isLoading && <LoadingState label="Chargement des versements…" />}
      {isError && <ErrorState message="Impossible de charger les versements." onRetry={refetch} />}
      {!isLoading && !isError && filtered.length === 0 && (
        <EmptyState icon="account_balance_wallet" message="Aucun versement ne correspond à votre recherche." />
      )}

      {!isLoading && !isError && (
        <View style={styles.list}>
          {filtered.map((payment) => {
            const displayStatus = computeDisplayStatus(payment);
            const colors = STATUS_COLOR[displayStatus];
            return (
              <Pressable key={payment.id} onPress={() => router.push(`/more/owner-payments/${payment.id}`)}>
                <Card style={styles.card}>
                  <View style={styles.topRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.owner}>{payment.owner?.full_name ?? 'Propriétaire inconnu'}</Text>
                      <Text style={styles.meta}>
                        {payment.payment_number} · {payment.period_start} → {payment.period_end}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 5 }}>
                      <Badge label={STATUS_LABEL[displayStatus] ?? displayStatus} bg={colors.bg} color={colors.text} />
                      {payment.is_manual_adjustment && <Badge label="Ajustement manuel" bg="#FDEBC8" color="#B45309" size="sm" />}
                    </View>
                  </View>
                  <View style={styles.bottomRow}>
                    <Text style={styles.due}>{payment.due_date ? `Échéance ${payment.due_date}` : '—'}</Text>
                    <Text style={styles.amount}>{formatMAD(payment.net_amount)}</Text>
                  </View>
                </Card>
              </Pressable>
            );
          })}
        </View>
      )}

      <OwnerPaymentCreateForm
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onSubmit={handleCreate}
        submitting={createPayment.isPending}
      />

      <GenerateSettlementsForm
        visible={showGenerate}
        onClose={() => setShowGenerate(false)}
        onSubmit={handleGenerate}
        submitting={generateSettlements.isPending}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 22,
    paddingTop: 8,
    paddingBottom: 4,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  title: {
    ...robotoText(700, 24, { color: AmkouyColors.primary, letterSpacing: -0.4 }),
  },
  subtitle: {
    ...robotoText(400, 13, { color: AmkouyColors.textFaint, marginTop: 3 }),
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconButtonGhost: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: AmkouyColors.hairline,
  },
  generateButton: {
    height: 40,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: AmkouyColors.secondaryContainer,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  generateButtonText: {
    ...robotoText(700, 13, { color: AmkouyColors.primary }),
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: AmkouyColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 22,
    marginTop: 10,
  },
  filterRow: {
    paddingTop: 10,
    paddingBottom: 4,
  },
  manualToggle: {
    marginHorizontal: 22,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#F3E2C6',
    backgroundColor: '#FFF8F0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 14,
    alignSelf: 'flex-start',
  },
  manualToggleActive: {
    backgroundColor: '#B45309',
    borderColor: '#B45309',
  },
  manualToggleText: {
    ...robotoText(600, 12, { color: '#8a6d1c' }),
  },
  dualFilterRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 22,
  },
  list: {
    paddingHorizontal: 22,
    paddingTop: 14,
    gap: 11,
  },
  card: {
    padding: 14,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  owner: {
    ...robotoText(600, 14.5, { color: AmkouyColors.text }),
  },
  meta: {
    ...robotoText(400, 11.5, { color: AmkouyColors.textFaint, marginTop: 2 }),
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 11,
    borderTopWidth: 1,
    borderTopColor: AmkouyColors.hairline,
  },
  due: {
    ...robotoText(500, 12, { color: AmkouyColors.textMuted }),
  },
  amount: {
    ...robotoText(700, 14, { color: AmkouyColors.primary }),
  },
});

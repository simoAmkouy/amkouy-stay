import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AccessGuard } from '@/components/amkouy/access-guard';
import { BarChart } from '@/components/amkouy/bar-chart';
import { Badge } from '@/components/amkouy/badge';
import { Card } from '@/components/amkouy/card';
import { DateFilterBar } from '@/components/amkouy/date-filter-bar';
import { EmptyState } from '@/components/amkouy/empty-state';
import { ErrorState } from '@/components/amkouy/error-state';
import { FilterChipRow } from '@/components/amkouy/filter-chip-row';
import { LoadingState } from '@/components/amkouy/loading-state';
import { Screen } from '@/components/amkouy/screen';
import { SearchBar } from '@/components/amkouy/search-bar';
import { SelectField } from '@/components/amkouy/select-field';
import { ExpenseForm } from '@/components/forms/expense-form';
import { Icon } from '@/components/icon';
import { AmkouyColors } from '@/constants/amkouy-theme';
import { robotoText } from '@/constants/typography';
import { DateFilterProvider, useDateFilter } from '@/hooks/use-date-filter';
import { useCreateExpense, useExpenseCategoryBreakdown, useExpenses } from '@/hooks/use-expenses';
import { useProperties } from '@/hooks/use-properties';
import {
  EXPENSE_CATEGORY_OPTIONS,
  EXPENSE_STATUS_OPTIONS,
  ExpenseFormValues,
} from '@/lib/validation/expense';
import { notify } from '@/utils/alert';
import { getErrorMessage } from '@/utils/errors';
import { formatMAD } from '@/utils/format';

const CATEGORY_LABEL = Object.fromEntries(EXPENSE_CATEGORY_OPTIONS.map((o) => [o.value, o.label]));
const STATUS_FILTERS = [{ label: 'Toutes', value: 'all' }, ...EXPENSE_STATUS_OPTIONS] as const;
const STATUS_LABEL = Object.fromEntries(EXPENSE_STATUS_OPTIONS.map((o) => [o.value, o.label]));
const STATUS_COLOR: Record<string, { bg: string; text: string }> = {
  draft: { bg: '#EEF0F4', text: '#5A5E66' },
  approved: { bg: '#E3E9F4', text: '#1E3A6E' },
  paid: { bg: '#DEF7E6', text: '#15803D' },
  cancelled: { bg: '#FAD9D9', text: '#B91C1C' },
};
const CHART_COLORS = ['#0F1F3D', '#C9A84C', '#1E3A6E', '#22C55E', '#EF4444', '#6D4FC9'];

export default function ExpensesScreen() {
  return (
    <AccessGuard resource="expenses">
      <DateFilterProvider>
        <ExpensesContent />
      </DateFilterProvider>
    </AccessGuard>
  );
}

function ExpensesContent() {
  const { range } = useDateFilter();
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [propertyFilter, setPropertyFilter] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const { data: expenses, isLoading, isError, refetch } = useExpenses();
  const { data: properties } = useProperties();
  const { data: breakdown } = useExpenseCategoryBreakdown(range);
  const createExpense = useCreateExpense();

  const propertyOptions = (properties ?? []).map((p) => ({ label: `${p.name} · ${p.city}`, value: p.id }));

  const filtered = useMemo(() => {
    return (expenses ?? []).filter((e) => {
      const matchesQuery =
        query.trim().length === 0 ||
        e.description.toLowerCase().includes(query.toLowerCase()) ||
        (e.vendor_name ?? '').toLowerCase().includes(query.toLowerCase()) ||
        e.expense_number.toLowerCase().includes(query.toLowerCase());
      const matchesStatus = statusFilter === 'all' || e.status === statusFilter;
      const matchesProperty = !propertyFilter || e.property_id === propertyFilter;
      const expenseTime = new Date(e.expense_date).getTime();
      const inRange = expenseTime >= range.start.getTime() && expenseTime <= range.end.getTime();
      return matchesQuery && matchesStatus && matchesProperty && inRange;
    });
  }, [expenses, query, statusFilter, propertyFilter, range]);

  const chartData = (breakdown ?? []).slice(0, 6).map((row, index) => {
    const max = Math.max(...(breakdown ?? []).map((b) => b.total), 1);
    return {
      m: CATEGORY_LABEL[row.category]?.split(' ')[0] ?? row.category,
      h: `${Math.max(6, Math.round((row.total / max) * 100))}%`,
      color: CHART_COLORS[index % CHART_COLORS.length],
    };
  });

  const handleCreate = (values: ExpenseFormValues) => {
    createExpense.mutate(
      {
        category: values.category as ExpenseFormValues['category'],
        description: values.description,
        propertyId: values.propertyId,
        reservationId: values.reservationId,
        ownerId: values.ownerId,
        amount: values.amount,
        expenseDate: values.expenseDate,
        vendorName: values.vendorName,
        paymentMethod: values.paymentMethod as never,
        receiptPath: values.receiptPath,
        notes: values.notes,
        status: values.status as ExpenseFormValues['status'],
      },
      {
        onSuccess: () => {
          setShowCreate(false);
          notify('Dépense créée', `${values.description} ajoutée avec succès.`);
        },
        onError: (error) => notify('Erreur', getErrorMessage(error, 'Impossible de créer la dépense.')),
      }
    );
  };

  return (
    <Screen contentPadding={false}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Dépenses</Text>
          <Text style={styles.subtitle}>{expenses ? `${expenses.length} au total` : 'Chargement…'}</Text>
        </View>
        <Pressable onPress={() => setShowCreate(true)} style={styles.addButton}>
          <Icon name="add" size={24} color="#fff" />
        </Pressable>
      </View>

      <DateFilterBar />

      {chartData.length > 0 && (
        <Card style={styles.chartCard}>
          <Text style={styles.chartTitle}>Répartition par catégorie</Text>
          <View style={styles.chartWrap}>
            <BarChart data={chartData} height={100} />
          </View>
        </Card>
      )}

      <SearchBar value={query} onChangeText={setQuery} placeholder="Description, fournisseur, N°…" />

      <View style={styles.filterRow}>
        <FilterChipRow
          options={STATUS_FILTERS.map((f) => f.value)}
          active={statusFilter}
          onChange={setStatusFilter}
          getLabel={(v) => STATUS_FILTERS.find((f) => f.value === v)?.label ?? v}
        />
      </View>

      <View style={styles.propertyFilterWrap}>
        <SelectField
          label="Filtrer par bien"
          value={propertyFilter}
          options={propertyOptions}
          onChange={setPropertyFilter}
          placeholder="Tous les biens"
        />
      </View>

      {isLoading && <LoadingState label="Chargement des dépenses…" />}
      {isError && <ErrorState message="Impossible de charger les dépenses." onRetry={refetch} />}
      {!isLoading && !isError && filtered.length === 0 && (
        <EmptyState icon="receipt_long" message="Aucune dépense ne correspond à votre recherche." />
      )}

      {!isLoading && !isError && (
        <View style={styles.list}>
          {filtered.map((expense) => {
            const colors = STATUS_COLOR[expense.status];
            return (
              <Pressable key={expense.id} onPress={() => router.push(`/more/expenses/${expense.id}`)}>
                <Card style={styles.card}>
                  <View style={styles.topRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.description}>{expense.description}</Text>
                      <Text style={styles.meta}>
                        {expense.expense_number} · {CATEGORY_LABEL[expense.category] ?? expense.category}
                      </Text>
                    </View>
                    <Badge label={STATUS_LABEL[expense.status] ?? expense.status} bg={colors.bg} color={colors.text} />
                  </View>
                  <View style={styles.bottomRow}>
                    <Text style={styles.date}>{expense.expense_date}</Text>
                    <Text style={styles.amount}>{formatMAD(expense.amount)}</Text>
                  </View>
                </Card>
              </Pressable>
            );
          })}
        </View>
      )}

      <ExpenseForm
        visible={showCreate}
        mode="create"
        onClose={() => setShowCreate(false)}
        onSubmit={handleCreate}
        submitting={createExpense.isPending}
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
    ...robotoText(700, 27, { color: AmkouyColors.primary, letterSpacing: -0.4 }),
  },
  subtitle: {
    ...robotoText(400, 13, { color: AmkouyColors.textFaint, marginTop: 3 }),
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: AmkouyColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartCard: {
    marginHorizontal: 22,
    marginTop: 14,
    padding: 16,
  },
  chartTitle: {
    ...robotoText(700, 14, { color: AmkouyColors.primary, marginBottom: 10 }),
  },
  chartWrap: {
    paddingTop: 4,
  },
  filterRow: {
    paddingTop: 10,
    paddingBottom: 4,
  },
  propertyFilterWrap: {
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
  description: {
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
  date: {
    ...robotoText(500, 12, { color: AmkouyColors.textMuted }),
  },
  amount: {
    ...robotoText(700, 14, { color: AmkouyColors.primary }),
  },
});

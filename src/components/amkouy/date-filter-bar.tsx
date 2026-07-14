import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FilterChipRow } from '@/components/amkouy/filter-chip-row';
import { FormModal } from '@/components/amkouy/form-modal';
import { FormField } from '@/components/amkouy/form-field';
import { SelectField } from '@/components/amkouy/select-field';
import { Icon } from '@/components/icon';
import { AmkouyColors } from '@/constants/amkouy-theme';
import { robotoText } from '@/constants/typography';
import { useDateFilter } from '@/hooks/use-date-filter';
import {
  ComparisonMode,
  getSelectableYears,
  QUICK_FILTER_LABEL,
  QUICK_FILTERS,
  QuickFilter,
  toDateOnlyString,
} from '@/utils/date-range';

const COMPARISON_LABEL: Record<ComparisonMode, string> = {
  none: 'Comparer',
  previous_period: 'Vs période préc.',
  previous_year: 'Vs année préc.',
};

/** Global date filter for the Dashboard: quick presets, custom range, year selector, comparison
 * toggle. `filters` lets a screen show a different preset subset (Module 8 report screens use
 * `REPORT_QUICK_FILTERS` — no forward-looking presets, adds last_quarter/last_year) without
 * building a second filter system; defaults to the original Dashboard/Operations Center set. */
export function DateFilterBar({ filters = QUICK_FILTERS }: { filters?: readonly QuickFilter[] }) {
  const {
    quickFilter,
    setQuickFilter,
    customRange,
    setCustomRange,
    selectedYear,
    setSelectedYear,
    comparisonMode,
    setComparisonMode,
    range,
  } = useDateFilter();

  const [showCustom, setShowCustom] = useState(false);
  const [draftStart, setDraftStart] = useState('');
  const [draftEnd, setDraftEnd] = useState('');
  const [customError, setCustomError] = useState<string | null>(null);

  const yearOptions = getSelectableYears().map((year) => ({ label: String(year), value: String(year) }));

  const handleQuickFilterChange = (value: QuickFilter) => {
    if (value === 'custom') {
      const base = customRange ?? range;
      setDraftStart(toDateOnlyString(base.start));
      setDraftEnd(toDateOnlyString(base.end));
      setCustomError(null);
      setShowCustom(true);
      return;
    }
    setQuickFilter(value);
  };

  const handleCustomSubmit = () => {
    const start = new Date(`${draftStart}T00:00:00`);
    const end = new Date(`${draftEnd}T23:59:59`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      setCustomError('Dates invalides. Format attendu : AAAA-MM-JJ.');
      return;
    }
    if (start > end) {
      setCustomError('La date de début doit précéder la date de fin.');
      return;
    }
    setCustomRange({ start, end });
    setQuickFilter('custom');
    setShowCustom(false);
  };

  const cycleComparisonMode = () => {
    setComparisonMode(
      comparisonMode === 'none' ? 'previous_period' : comparisonMode === 'previous_period' ? 'previous_year' : 'none'
    );
  };

  return (
    <View style={styles.wrap}>
      <FilterChipRow
        options={filters}
        active={quickFilter}
        onChange={handleQuickFilterChange}
        getLabel={(value) => QUICK_FILTER_LABEL[value]}
      />

      <View style={styles.controlsRow}>
        <View style={styles.yearField}>
          <SelectField
            label="Année"
            value={String(selectedYear)}
            options={yearOptions}
            onChange={(value) => {
              setSelectedYear(Number(value));
              setQuickFilter('this_year');
            }}
          />
        </View>
        <Pressable
          onPress={cycleComparisonMode}
          style={[styles.comparisonPill, comparisonMode !== 'none' && styles.comparisonPillActive]}>
          <Icon
            name="compare_arrows"
            size={15}
            color={comparisonMode !== 'none' ? '#fff' : AmkouyColors.textMuted}
          />
          <Text
            style={[
              styles.comparisonText,
              { color: comparisonMode !== 'none' ? '#fff' : AmkouyColors.textMuted },
            ]}>
            {COMPARISON_LABEL[comparisonMode]}
          </Text>
        </Pressable>
      </View>

      <FormModal
        visible={showCustom}
        title="Plage personnalisée"
        onClose={() => setShowCustom(false)}
        onSubmit={handleCustomSubmit}
        submitting={false}
        submitLabel="Appliquer">
        <FormField
          label="Date de début (AAAA-MM-JJ)"
          value={draftStart}
          onChangeText={setDraftStart}
          placeholder="2026-07-01"
        />
        <FormField
          label="Date de fin (AAAA-MM-JJ)"
          value={draftEnd}
          onChangeText={setDraftEnd}
          placeholder="2026-07-31"
        />
        {!!customError && <Text style={styles.errorText}>{customError}</Text>}
      </FormModal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingTop: 14,
    paddingBottom: 4,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: 22,
    marginTop: 2,
  },
  yearField: {
    width: 130,
  },
  comparisonPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    marginTop: 18,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: AmkouyColors.border,
  },
  comparisonPillActive: {
    backgroundColor: AmkouyColors.primary,
    borderColor: AmkouyColors.primary,
  },
  comparisonText: {
    ...robotoText(600, 12),
  },
  errorText: {
    ...robotoText(500, 12, { color: AmkouyColors.error, marginTop: 8 }),
  },
});

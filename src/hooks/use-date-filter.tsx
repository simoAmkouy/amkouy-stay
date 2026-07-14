import { createContext, ReactNode, useContext, useMemo, useState } from 'react';

import {
  ComparisonMode,
  computeComparisonRange,
  computeRangeForFilter,
  DateRange,
  QuickFilter,
} from '@/utils/date-range';

type DateFilterContextValue = {
  quickFilter: QuickFilter;
  setQuickFilter: (filter: QuickFilter) => void;
  customRange: DateRange | null;
  setCustomRange: (range: DateRange) => void;
  selectedYear: number;
  setSelectedYear: (year: number) => void;
  comparisonMode: ComparisonMode;
  setComparisonMode: (mode: ComparisonMode) => void;
  range: DateRange;
  comparisonRange: DateRange | null;
};

const DateFilterContext = createContext<DateFilterContextValue | null>(null);

/**
 * Screen-local shared state for the Dashboard's date filter — not app-wide, since only the
 * Dashboard needs it today. This is the first React Context in the codebase; everywhere else
 * shared state lives in the React Query cache, but that idiom doesn't fit a pure UI selection
 * with several sibling writers (chips, year picker, comparison toggle) and many readers (every KPI).
 */
export function DateFilterProvider({
  children,
  initialFilter = 'this_month',
}: {
  children: ReactNode;
  initialFilter?: QuickFilter;
}) {
  const [quickFilter, setQuickFilter] = useState<QuickFilter>(initialFilter);
  const [customRange, setCustomRange] = useState<DateRange | null>(null);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>('none');

  const range = useMemo(
    () => computeRangeForFilter(quickFilter, { customRange, selectedYear }),
    [quickFilter, customRange, selectedYear]
  );

  const comparisonRange = useMemo(
    () => computeComparisonRange(range, comparisonMode),
    [range, comparisonMode]
  );

  const value: DateFilterContextValue = {
    quickFilter,
    setQuickFilter,
    customRange,
    setCustomRange,
    selectedYear,
    setSelectedYear,
    comparisonMode,
    setComparisonMode,
    range,
    comparisonRange,
  };

  return <DateFilterContext.Provider value={value}>{children}</DateFilterContext.Provider>;
}

export function useDateFilter(): DateFilterContextValue {
  const ctx = useContext(DateFilterContext);
  if (!ctx) throw new Error('useDateFilter must be used within a DateFilterProvider');
  return ctx;
}

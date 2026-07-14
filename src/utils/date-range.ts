import {
  addDays,
  differenceInCalendarDays,
  endOfDay,
  endOfMonth,
  endOfQuarter,
  endOfWeek,
  endOfYear,
  format,
  isSameMonth,
  isSameYear,
  startOfDay,
  startOfMonth,
  startOfQuarter,
  startOfWeek,
  startOfYear,
  subDays,
  subMonths,
  subQuarters,
  subWeeks,
  subYears,
} from 'date-fns';
import { arMA, fr } from 'date-fns/locale';

import { Locale as AppLocale } from '@/i18n';

export type DateRange = { start: Date; end: Date };

export const QUICK_FILTERS = [
  'today',
  'tomorrow',
  'yesterday',
  'this_week',
  'last_week',
  'next_7_days',
  'this_month',
  'last_month',
  'next_30_days',
  'this_quarter',
  'last_quarter',
  'this_year',
  'last_year',
  'custom',
] as const;

export type QuickFilter = (typeof QUICK_FILTERS)[number];

export const QUICK_FILTER_LABEL: Record<QuickFilter, string> = {
  today: "Aujourd'hui",
  tomorrow: 'Demain',
  yesterday: 'Hier',
  this_week: 'Cette semaine',
  last_week: 'Semaine dernière',
  next_7_days: '7 prochains jours',
  this_month: 'Ce mois',
  last_month: 'Mois dernier',
  next_30_days: '30 prochains jours',
  this_quarter: 'Ce trimestre',
  last_quarter: 'Trimestre dernier',
  this_year: 'Cette année',
  last_year: 'Année dernière',
  custom: 'Personnalisé',
};

/** Module 8 reporting subset — the presets a Reports screen's quick-filter row actually shows
 * (Report Date Engine, Phase 2). Distinct from `QUICK_FILTERS` because Dashboard/Operations Center
 * don't need `last_quarter`/`last_year`/forward-looking presets like `tomorrow`/`next_30_days`. */
export const REPORT_QUICK_FILTERS: QuickFilter[] = [
  'today',
  'yesterday',
  'this_week',
  'last_week',
  'this_month',
  'last_month',
  'this_quarter',
  'last_quarter',
  'this_year',
  'last_year',
  'custom',
];

export type ComparisonMode = 'none' | 'previous_period' | 'previous_year';

/** Week starts Monday (French convention), matching the app's fr-FR number/date formatting elsewhere. */
const WEEK_OPTS = { weekStartsOn: 1 as const };

export function computeRangeForFilter(
  filter: QuickFilter,
  opts: { customRange?: DateRange | null; selectedYear?: number; referenceDate?: Date } = {}
): DateRange {
  const now = opts.referenceDate ?? new Date();

  switch (filter) {
    case 'today':
      return { start: startOfDay(now), end: endOfDay(now) };
    case 'tomorrow': {
      const d = addDays(now, 1);
      return { start: startOfDay(d), end: endOfDay(d) };
    }
    case 'yesterday': {
      const d = subDays(now, 1);
      return { start: startOfDay(d), end: endOfDay(d) };
    }
    case 'this_week':
      return { start: startOfWeek(now, WEEK_OPTS), end: endOfWeek(now, WEEK_OPTS) };
    case 'last_week': {
      const d = subWeeks(now, 1);
      return { start: startOfWeek(d, WEEK_OPTS), end: endOfWeek(d, WEEK_OPTS) };
    }
    case 'next_7_days':
      return { start: startOfDay(now), end: endOfDay(addDays(now, 7)) };
    case 'this_month':
      return { start: startOfMonth(now), end: endOfMonth(now) };
    case 'last_month': {
      const d = subMonths(now, 1);
      return { start: startOfMonth(d), end: endOfMonth(d) };
    }
    case 'next_30_days':
      return { start: startOfDay(now), end: endOfDay(addDays(now, 30)) };
    case 'this_quarter':
      return { start: startOfQuarter(now), end: endOfQuarter(now) };
    case 'last_quarter': {
      const d = subQuarters(now, 1);
      return { start: startOfQuarter(d), end: endOfQuarter(d) };
    }
    case 'this_year': {
      const year = opts.selectedYear ?? now.getFullYear();
      const ref = new Date(year, 0, 1);
      return { start: startOfYear(ref), end: endOfYear(ref) };
    }
    case 'last_year': {
      const year = (opts.selectedYear ?? now.getFullYear()) - 1;
      const ref = new Date(year, 0, 1);
      return { start: startOfYear(ref), end: endOfYear(ref) };
    }
    case 'custom':
      return opts.customRange ?? { start: startOfDay(now), end: endOfDay(now) };
  }
}

/** "Exact month" picker (Phase 2: "Select: exact month", e.g. "July 2026") — built on the same
 * `DateRange` shape as everything else, not a new filter type. UI wires this into `custom`. */
export function computeRangeForMonth(year: number, month: number): DateRange {
  const ref = new Date(year, month, 1);
  return { start: startOfMonth(ref), end: endOfMonth(ref) };
}

/** "Exact year" picker (Phase 2: "Select: exact year", e.g. "entire year 2025"). */
export function computeRangeForYear(year: number): DateRange {
  const ref = new Date(year, 0, 1);
  return { start: startOfYear(ref), end: endOfYear(ref) };
}

/** Same-length window immediately preceding the range, or the same range shifted back one year. */
export function computeComparisonRange(range: DateRange, mode: ComparisonMode): DateRange | null {
  if (mode === 'none') return null;
  if (mode === 'previous_year') {
    return { start: subYears(range.start, 1), end: subYears(range.end, 1) };
  }
  const lengthDays = differenceInCalendarDays(range.end, range.start) + 1;
  const end = subDays(range.start, 1);
  const start = subDays(end, lengthDays - 1);
  return { start: startOfDay(start), end: endOfDay(end) };
}

/** Compact range label: "4 juil. 2026" / "1 – 7 juil. 2026" / "28 juin – 4 juil. 2026" in French,
 * same shape in Arabic. `appLocale` defaults to `'fr'` so every pre-existing call site (most of
 * them don't have easy access to the current locale) keeps behaving exactly as before. */
export function formatRangeLabel(range: DateRange, appLocale: AppLocale = 'fr'): string {
  const locale = appLocale === 'ar' ? arMA : fr;
  if (differenceInCalendarDays(range.end, range.start) === 0) {
    return format(range.start, 'd MMM yyyy', { locale });
  }
  if (isSameMonth(range.start, range.end)) {
    return `${format(range.start, 'd', { locale })} – ${format(range.end, 'd MMM yyyy', { locale })}`;
  }
  if (isSameYear(range.start, range.end)) {
    return `${format(range.start, 'd MMM', { locale })} – ${format(range.end, 'd MMM yyyy', { locale })}`;
  }
  return `${format(range.start, 'd MMM yyyy', { locale })} – ${format(range.end, 'd MMM yyyy', { locale })}`;
}

/** Current year back a few years, newest first — for the Year Selector. */
export function getSelectableYears(referenceDate = new Date()): number[] {
  const currentYear = referenceDate.getFullYear();
  return [currentYear, currentYear - 1, currentYear - 2, currentYear - 3];
}

export function toDateOnlyString(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

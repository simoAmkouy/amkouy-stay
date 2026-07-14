import ar from '@/i18n/ar';
import fr, { TranslationDict } from '@/i18n/fr';

export type Locale = 'fr' | 'ar';
export const RTL_LOCALES: Locale[] = ['ar'];
export const LOCALE_STORAGE_KEY = 'amkouy-locale';
export const DEFAULT_LOCALE: Locale = 'fr';

export const TRANSLATIONS: Record<Locale, TranslationDict> = { fr, ar };

export const LANGUAGE_OPTIONS: { value: Locale; labelKey: 'languageScreen.french' | 'languageScreen.arabic' }[] = [
  { value: 'fr', labelKey: 'languageScreen.french' },
  { value: 'ar', labelKey: 'languageScreen.arabic' },
];

/** Every dotted path through the dictionary whose leaf is a string, e.g. `'common.save'` —
 * derived from the French dictionary's shape, so a translation key that doesn't exist is a
 * compile-time error rather than a silent runtime miss. */
type Path<T, Prefix extends string = ''> = T extends string
  ? never
  : { [K in keyof T & string]: T[K] extends string ? `${Prefix}${K}` : Path<T[K], `${Prefix}${K}.`> }[keyof T & string];

export type TranslationKey = Path<TranslationDict>;

/** Never throws — an unresolvable key (should only happen if `ar.ts` and `fr.ts` structurally
 * drift, which `TranslationDict` typing already prevents at compile time) falls back to the raw
 * key so the UI shows *something* instead of crashing. */
export function resolveTranslation(dict: TranslationDict, key: TranslationKey): string {
  const parts = key.split('.');
  let node: unknown = dict;
  for (const part of parts) {
    if (typeof node !== 'object' || node === null) return key;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === 'string' ? node : key;
}

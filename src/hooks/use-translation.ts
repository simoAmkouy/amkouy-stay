import { useCallback } from 'react';

import { useLocale } from '@/hooks/use-locale';
import { resolveTranslation, TRANSLATIONS, TranslationKey } from '@/i18n';

export function useTranslation() {
  const { locale, isRTL } = useLocale();
  const t = useCallback(
    (key: TranslationKey, vars?: Record<string, string | number>) => {
      let text = resolveTranslation(TRANSLATIONS[locale], key);
      if (vars) {
        for (const [name, value] of Object.entries(vars)) text = text.split(`{${name}}`).join(String(value));
      }
      return text;
    },
    [locale]
  );
  return { t, locale, isRTL };
}

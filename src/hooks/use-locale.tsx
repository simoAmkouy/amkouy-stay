import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { I18nManager, Platform } from 'react-native';

import { useAuth } from '@/hooks/use-auth';
import { DEFAULT_LOCALE, Locale, LOCALE_STORAGE_KEY, RTL_LOCALES } from '@/i18n';
import { supabaseStorage } from '@/lib/supabase-storage';
import { supabase } from '@/lib/supabase';

type LocaleContextValue = {
  locale: Locale;
  isRTL: boolean;
  setLocale: (locale: Locale) => void;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

/**
 * Web gets instant RTL (the browser reflows the moment `dir` changes — no reload). Native RN's
 * layout engine only re-mirrors `flexDirection`/text direction after `I18nManager.forceRTL()` is
 * followed by a JS bundle reload — a hard platform constraint, not something bypassable from
 * here. This still flips the flag so the *next* native launch renders correctly; a full "instant,
 * no-restart" RTL switch is only real on web with this architecture.
 */
function applyDirection(locale: Locale) {
  const isRTL = RTL_LOCALES.includes(locale);
  if (I18nManager.isRTL !== isRTL) {
    I18nManager.allowRTL(isRTL);
    I18nManager.forceRTL(isRTL);
  }
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
    document.documentElement.lang = locale;
  }
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);
  const [hydrated, setHydrated] = useState(false);

  // Fast local default — available before any auth/network round trip, so the Login screen
  // itself (no profile yet) still renders in the user's last-chosen language.
  useEffect(() => {
    supabaseStorage.getItem(LOCALE_STORAGE_KEY).then((stored) => {
      const initial: Locale = stored === 'ar' ? 'ar' : DEFAULT_LOCALE;
      setLocaleState(initial);
      applyDirection(initial);
      setHydrated(true);
    });
  }, []);

  // Once the authenticated profile loads, `users.locale` (the DB, reused as-is — see the
  // `set_my_locale` migration) is authoritative, reconciling a preference set on another device.
  useEffect(() => {
    if (!hydrated || !profile?.locale) return;
    const dbLocale: Locale = profile.locale === 'ar' ? 'ar' : 'fr';
    if (dbLocale !== locale) {
      setLocaleState(dbLocale);
      applyDirection(dbLocale);
      supabaseStorage.setItem(LOCALE_STORAGE_KEY, dbLocale);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, profile?.locale]);

  const setLocale = (next: Locale) => {
    setLocaleState(next);
    applyDirection(next);
    supabaseStorage.setItem(LOCALE_STORAGE_KEY, next);
    if (profile) {
      supabase.rpc('set_my_locale', { p_locale: next }).then(({ error }) => {
        if (error) console.warn('[locale] failed to persist to profile', error.message);
      });
    }
  };

  return <LocaleContext.Provider value={{ locale, isRTL: RTL_LOCALES.includes(locale), setLocale }}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useLocale must be used within a LocaleProvider');
  return ctx;
}

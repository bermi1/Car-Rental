import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { catalogues, type Language, type TranslationKey } from './translations';
import { api, getToken } from '../api/client';

const STORAGE_KEY = 'rental_language';

interface I18nValue {
  language: Language;
  setLanguage: (language: Language) => void;
  /** Look up a key in the active catalogue. */
  t: (key: TranslationKey) => string;
}

const I18nContext = createContext<I18nValue | undefined>(undefined);

function initialLanguage(): Language {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'sw' || stored === 'en') return stored;
  // Default from the browser, so a Kiswahili-speaking user lands in Kiswahili
  // without hunting for the switcher.
  return navigator.language?.toLowerCase().startsWith('sw') ? 'sw' : 'en';
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(initialLanguage);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, language);
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next);
    // Persist to the account too, so the choice follows the user to another
    // device. Failure is not worth surfacing — the local preference still holds.
    if (getToken()) {
      api.put('/auth/me/language', { language: next }).catch(() => {});
    }
  }, []);

  const t = useCallback((key: TranslationKey) => catalogues[language][key] ?? catalogues.en[key], [language]);

  return <I18nContext.Provider value={{ language, setLanguage, t }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}

/** Shorthand for components that only need the lookup function. */
export function useT() {
  return useI18n().t;
}

export type { Language, TranslationKey };

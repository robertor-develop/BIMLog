import React, { createContext, useContext, useEffect, useState } from 'react';
import en from './i18n/en.json';
import es from './i18n/es.json';

type Language = 'en' | 'es';

const translations: Record<Language, Record<string, string>> = { en, es };

type TranslationKey = keyof typeof en;

type I18nContextType = {
  lang: Language;
  setLang: (lang: Language) => void;
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey) => string;
  /** Inline helper: returns es when language is es, else en. Use for ad-hoc strings without a key. */
  tt: (en: string, es: string) => string;
};

const I18nContext = createContext<I18nContextType | null>(null);

const LS_KEY = 'bimlog-lang';

function readInitialLang(): Language {
  if (typeof window === 'undefined') return 'en';
  try {
    const saved = window.localStorage.getItem(LS_KEY);
    if (saved === 'en' || saved === 'es') return saved;
  } catch { /* localStorage may be unavailable */ }
  return 'en';
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Language>(() => readInitialLang());

  const setLang = (next: Language) => {
    setLangState(next);
    try { window.localStorage.setItem(LS_KEY, next); } catch { /* ignore */ }
  };

  // Reflect language on <html lang> for accessibility / SEO.
  useEffect(() => {
    if (typeof document !== 'undefined') document.documentElement.lang = lang;
  }, [lang]);

  const t = (key: TranslationKey) => {
    return translations[lang][key] || translations['en'][key] || key;
  };

  const tt = (enStr: string, esStr: string) => (lang === 'es' ? esStr : enStr);

  return (
    <I18nContext.Provider value={{ lang, setLang, language: lang, setLanguage: setLang, t, tt }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}

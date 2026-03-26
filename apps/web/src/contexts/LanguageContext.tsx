import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { getCurrentLanguage, setLanguage as setLangStorage, setLanguageFromCountry as setLangFromCountry, type Language } from '@/lib/i18n';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  setLanguageFromCountry: (countryCode: string | null | undefined) => void;
}

const LanguageContext = createContext<LanguageContextType | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLang] = useState<Language>(getCurrentLanguage);

  const setLanguage = useCallback((lang: Language) => {
    setLangStorage(lang);
    setLang(lang);
  }, []);

  const setLanguageFromCountry = useCallback((countryCode: string | null | undefined) => {
    if (!countryCode) return;
    setLangFromCountry(countryCode);
    setLang(getCurrentLanguage());
  }, []);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, setLanguageFromCountry }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    return {
      language: getCurrentLanguage(),
      setLanguage: setLangStorage,
      setLanguageFromCountry: setLangFromCountry,
    } as LanguageContextType;
  }
  return ctx;
}

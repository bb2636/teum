import { useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { t as translate } from '@/lib/i18n';

export function useT() {
  const { language } = useLanguage();

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => {
      void language;
      return translate(key, params);
    },
    [language]
  );

  return t;
}

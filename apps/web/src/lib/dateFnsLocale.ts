import { ko } from 'date-fns/locale';
import { enUS } from 'date-fns/locale';
import { getCurrentLanguage } from './i18n';

export function getDateLocale() {
  return getCurrentLanguage() === 'ko' ? ko : enUS;
}

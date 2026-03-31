/**
 * 국가 코드를 언어 코드로 매핑하는 유틸리티
 */

const COUNTRY_TO_LANGUAGE: Record<string, string> = {
  // 한국
  KR: 'ko',
  // 영어권 국가
  US: 'en',
  GB: 'en',
  CA: 'en',
  AU: 'en',
  NZ: 'en',
  IE: 'en',
  // 일본
  JP: 'ja',
  // 중국
  CN: 'zh',
  TW: 'zh',
  HK: 'zh',
  // 독일
  DE: 'de',
  AT: 'de',
  CH: 'de',
  // 프랑스
  FR: 'fr',
  // 스페인
  ES: 'es',
  MX: 'es',
  AR: 'es',
  CO: 'es',
  CL: 'es',
  PE: 'es',
  // 이탈리아
  IT: 'it',
  // 포르투갈
  PT: 'pt',
  BR: 'pt',
  // 러시아
  RU: 'ru',
  // 네덜란드
  NL: 'nl',
  // 스웨덴
  SE: 'sv',
  // 노르웨이
  NO: 'no',
  // 덴마크
  DK: 'da',
  // 핀란드
  FI: 'fi',
  // 폴란드
  PL: 'pl',
  // 터키
  TR: 'tr',
  // 아랍어권
  SA: 'ar',
  AE: 'ar',
  EG: 'ar',
  // 베트남
  VN: 'vi',
  // 태국
  TH: 'th',
  // 인도네시아
  ID: 'id',
  // 말레이시아
  MY: 'ms',
  // 필리핀
  PH: 'tl',
  // 싱가포르
  SG: 'en', // 영어가 주요 언어
  // 인도
  IN: 'en', // 영어가 주요 언어
};

/**
 * 국가 코드를 언어 코드로 변환합니다.
 * @param countryCode - 국가 코드 (예: 'KR', 'US')
 * @returns 언어 코드 (예: 'ko', 'en') 또는 기본값 'ko'
 */
export function getLanguageFromCountry(countryCode: string | null | undefined): string {
  if (!countryCode) {
    return 'ko'; // 기본값: 한국어
  }

  return COUNTRY_TO_LANGUAGE[countryCode.toUpperCase()] || 'ko';
}

/**
 * 지원되는 언어 목록
 */
export const SUPPORTED_LANGUAGES = ['ko', 'en', 'ja', 'zh', 'de', 'es', 'it', 'pt', 'ru', 'ar', 'vi', 'th'] as const;

export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];

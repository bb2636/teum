/**
 * 다국어 지원 (i18n) 유틸리티
 * IP 기반 국가 감지로 자동 언어 설정
 */

export type Language = 'ko' | 'en' | 'ja' | 'zh' | 'de' | 'es' | 'it' | 'pt' | 'ru' | 'ar' | 'vi' | 'th';

// 국가 코드를 언어 코드로 매핑
const COUNTRY_TO_LANGUAGE: Record<string, Language> = {
  KR: 'ko',
  US: 'en',
  GB: 'en',
  CA: 'en',
  AU: 'en',
  NZ: 'en',
  IE: 'en',
  JP: 'ja',
  CN: 'zh',
  TW: 'zh',
  HK: 'zh',
  DE: 'de',
  AT: 'de',
  CH: 'de',
  FR: 'fr',
  BE: 'fr', // 벨기에도 프랑스어 사용
  ES: 'es',
  MX: 'es',
  AR: 'es',
  CO: 'es',
  CL: 'es',
  PE: 'es',
  IT: 'it',
  PT: 'pt',
  BR: 'pt',
  RU: 'ru',
  NL: 'nl',
  SE: 'sv',
  NO: 'no',
  DK: 'da',
  FI: 'fi',
  PL: 'pl',
  TR: 'tr',
  SA: 'ar',
  AE: 'ar',
  EG: 'ar',
  VN: 'vi',
  TH: 'th',
  ID: 'id',
  MY: 'ms',
  PH: 'tl',
  SG: 'en',
  IN: 'en',
};

// 기본 언어 (한국어)
const DEFAULT_LANGUAGE: Language = 'ko';

// 언어별 번역 데이터 (간단한 예시 - 실제로는 별도 파일로 분리)
const translations: Record<Language, Record<string, string>> = {
  ko: {
    // 기본 UI 텍스트
    'app.name': 'teum',
    'app.tagline': '기록이 곧, 당신만의 트랙이 됩니다.',
    'auth.login': '이메일로 로그인',
    'auth.signup': '회원가입',
    'auth.email': '이메일',
    'auth.password': '비밀번호',
    'auth.confirmPassword': '비밀번호 확인',
    'auth.nickname': '닉네임',
    'auth.name': '이름',
    'auth.dateOfBirth': '생년월일',
    'auth.next': '다음',
    'auth.back': '뒤로',
    'auth.sendVerificationCode': '인증번호 보내기',
    'auth.verificationCode': '인증번호',
    'auth.verify': '인증하기',
    'auth.emailVerified': '이메일 인증이 완료되었습니다',
    'auth.emailExists': '이미 존재하는 이메일 입니다. 다른 이메일을 입력해주세요.',
    'auth.passwordRequirements': '비밀번호는 8자 이상, 영문/숫자를 포함해주세요',
    'auth.passwordMismatch': '비밀번호가 일치하지 않습니다.',
    'auth.accountInfo': '사용하실 계정 정보를 입력해주세요.',
    'auth.profileInfo': '회원 정보를 입력해주세요.',
    'auth.termsAgreement': '약관에 동의해주세요.',
  },
  en: {
    'app.name': 'teum',
    'app.tagline': 'Your records become your own track.',
    'auth.login': 'Login with Email',
    'auth.signup': 'Sign Up',
    'auth.email': 'Email',
    'auth.password': 'Password',
    'auth.confirmPassword': 'Confirm Password',
    'auth.nickname': 'Nickname',
    'auth.name': 'Name',
    'auth.dateOfBirth': 'Date of Birth',
    'auth.next': 'Next',
    'auth.back': 'Back',
    'auth.sendVerificationCode': 'Send Verification Code',
    'auth.verificationCode': 'Verification Code',
    'auth.verify': 'Verify',
    'auth.emailVerified': 'Email verification completed',
    'auth.emailExists': 'This email already exists. Please enter another email.',
    'auth.passwordRequirements': 'Password must be at least 8 characters and include letters and numbers',
    'auth.passwordMismatch': 'Passwords do not match.',
    'auth.accountInfo': 'Please enter the account information you will use.',
    'auth.profileInfo': 'Please enter your profile information.',
    'auth.termsAgreement': 'Please agree to the terms and conditions.',
  },
  ja: {
    'app.name': 'teum',
    'app.tagline': '記録が、あなただけのトラックになります。',
    'auth.login': 'メールでログイン',
    'auth.signup': '会員登録',
    'auth.email': 'メール',
    'auth.password': 'パスワード',
    'auth.confirmPassword': 'パスワード確認',
    'auth.nickname': 'ニックネーム',
    'auth.name': '名前',
    'auth.dateOfBirth': '生年月日',
    'auth.next': '次へ',
    'auth.back': '戻る',
    'auth.sendVerificationCode': '認証コードを送信',
    'auth.verificationCode': '認証コード',
    'auth.verify': '認証',
    'auth.emailVerified': 'メール認証が完了しました',
    'auth.emailExists': 'このメールアドレスは既に存在します。別のメールアドレスを入力してください。',
    'auth.passwordRequirements': 'パスワードは8文字以上で、英字と数字を含めてください',
    'auth.passwordMismatch': 'パスワードが一致しません。',
    'auth.accountInfo': '使用するアカウント情報を入力してください。',
    'auth.profileInfo': 'プロフィール情報を入力してください。',
    'auth.termsAgreement': '利用規約に同意してください。',
  },
  zh: {
    'app.name': 'teum',
    'app.tagline': '记录成为您自己的轨道。',
    'auth.login': '使用邮箱登录',
    'auth.signup': '注册',
    'auth.email': '邮箱',
    'auth.password': '密码',
    'auth.confirmPassword': '确认密码',
    'auth.nickname': '昵称',
    'auth.name': '姓名',
    'auth.dateOfBirth': '出生日期',
    'auth.next': '下一步',
    'auth.back': '返回',
    'auth.sendVerificationCode': '发送验证码',
    'auth.verificationCode': '验证码',
    'auth.verify': '验证',
    'auth.emailVerified': '邮箱验证已完成',
    'auth.emailExists': '此邮箱已存在。请输入其他邮箱。',
    'auth.passwordRequirements': '密码必须至少8个字符，包含字母和数字',
    'auth.passwordMismatch': '密码不匹配。',
    'auth.accountInfo': '请输入您将使用的账户信息。',
    'auth.profileInfo': '请输入您的个人资料信息。',
    'auth.termsAgreement': '请同意条款和条件。',
  },
  de: {},
  es: {},
  it: {},
  pt: {},
  ru: {},
  ar: {},
  vi: {},
  th: {},
};

/**
 * 현재 언어 가져오기
 */
export function getCurrentLanguage(): Language {
  if (typeof window === 'undefined') {
    return DEFAULT_LANGUAGE;
  }

  // localStorage에서 저장된 언어 확인
  const savedLanguage = localStorage.getItem('teum_language') as Language | null;
  if (savedLanguage && translations[savedLanguage]) {
    return savedLanguage;
  }

  // 사용자 프로필의 국가 코드로 언어 감지
  // (이 부분은 나중에 사용자 프로필에서 가져올 수 있음)
  const userCountry = localStorage.getItem('teum_user_country');
  if (userCountry && COUNTRY_TO_LANGUAGE[userCountry]) {
    return COUNTRY_TO_LANGUAGE[userCountry];
  }

  // 브라우저 언어 감지
  const browserLang = navigator.language.split('-')[0] as Language;
  if (translations[browserLang]) {
    return browserLang;
  }

  return DEFAULT_LANGUAGE;
}

/**
 * 언어 설정
 */
export function setLanguage(language: Language): void {
  if (typeof window === 'undefined') {
    return;
  }
  localStorage.setItem('teum_language', language);
}

/**
 * 번역 함수
 */
export function t(key: string, language?: Language): string {
  const lang = language || getCurrentLanguage();
  const translation = translations[lang]?.[key];
  
  // 번역이 없으면 한국어로 폴백
  if (!translation) {
    return translations[DEFAULT_LANGUAGE]?.[key] || key;
  }
  
  return translation;
}

/**
 * 국가 코드로 언어 설정
 */
export function setLanguageFromCountry(countryCode: string | null | undefined): void {
  if (!countryCode) {
    return;
  }
  
  const language = COUNTRY_TO_LANGUAGE[countryCode.toUpperCase()];
  if (language) {
    setLanguage(language);
    localStorage.setItem('teum_user_country', countryCode.toUpperCase());
  }
}

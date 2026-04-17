import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSocialOnboarding, type SocialProfile } from '@/hooks/useSocialAuth';
import { useNicknameCheck } from '@/hooks/useNicknameCheck';
import { useEmailCheck } from '@/hooks/useEmailCheck';
import { useRequestPhoneVerification, useConfirmPhoneVerification } from '@/hooks/usePhoneVerification';
import { ChevronLeft, ChevronRight, CheckCircle2, Calendar, X, HelpCircle, ChevronDown } from 'lucide-react';
import { TermsModal } from '@/pages/my/TermsModal';
import { ScrollYearMonthPicker } from '@/components/ScrollYearMonthPicker';
import { useT } from '@/hooks/useTranslation';
import { getCurrentLanguage } from '@/lib/i18n';
import { countryCodes } from '@/lib/countryCodes';

const nicknameSchema = z
  .string()
  .min(2, 'auth.nicknameRule')
  .max(12, 'auth.nicknameRule')
  .refine((val) => !val.includes(' '), 'auth.nicknameNoSpace')
  .refine((val) => /^[a-zA-Z0-9가-힣_]+$/.test(val), 'auth.nicknameInvalidChar');

const createProfileSchema = (isEmailOptional: boolean) => z.object({
  email: isEmailOptional
    ? z.string().email('auth.emailPlaceholder').or(z.literal('')).optional()
    : z.string().email('auth.emailPlaceholder'),
  nickname: nicknameSchema,
  name: z.string().min(1, 'auth.enterName').max(100),
  phone: z.string().min(4, 'auth.phoneInvalidLength').max(15, 'auth.phoneInvalidLength'),
  dateOfBirth: z
    .string()
    .refine((val) => {
      if (!val) return false;
      const parts = val.split('-');
      if (parts.length !== 3) return false;
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10);
      const day = parseInt(parts[2], 10);
      const currentYear = new Date().getFullYear();
      if (isNaN(year) || year < 1900 || year > currentYear) return false;
      if (isNaN(month) || month < 1 || month > 12) return false;
      if (isNaN(day) || day < 1 || day > 31) return false;
      const date = new Date(year, month - 1, day);
      return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
    }, 'auth.enterDateOfBirth')
    .optional(),
});

const termsSchema = z.object({
  termsService: z.boolean().refine((val) => val === true),
  termsPayment: z.boolean().refine((val) => val === true),
  termsRefund: z.boolean().refine((val) => val === true),
});

type ProfileFormData = z.infer<ReturnType<typeof createProfileSchema>>;
type TermsFormData = z.infer<typeof termsSchema>;

export function SocialOnboardingPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const t = useT();

  const queryParams = new URLSearchParams(location.search);
  const socialProfile: SocialProfile | undefined =
    location.state?.socialProfile ||
    (queryParams.get('isNewUser') === 'true'
      ? {
          provider: (queryParams.get('provider') || 'google') as 'google' | 'apple',
          providerAccountId: queryParams.get('providerAccountId') || '',
          email: queryParams.get('email') || '',
          name: queryParams.get('name') || '',
          picture: queryParams.get('picture') || undefined,
          isEmailHidden: queryParams.get('isEmailHidden') === 'true',
        }
      : undefined);
  const onboardingToken: string | undefined =
    location.state?.onboardingToken || queryParams.get('onboardingToken') || undefined;
  const socialOnboarding = useSocialOnboarding();

  const [step, setStep] = useState<1 | 2>(1);
  const [error, setError] = useState<string | null>(null);
  const [nicknameError, setNicknameError] = useState<string[]>([]);
  const [showTermsModal, setShowTermsModal] = useState<false | 'service' | 'payment' | 'refund'>(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [dateDisplayValue, setDateDisplayValue] = useState('');
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [showPhoneVerificationModal, setShowPhoneVerificationModal] = useState(false);
  const [phoneVerificationInput, setPhoneVerificationInput] = useState('');
  const [phoneVerificationError, setPhoneVerificationError] = useState<string | null>(null);
  const [verifyKbHeight, setVerifyKbHeight] = useState(0);
  const [showEmailTooltip, setShowEmailTooltip] = useState(false);
  const [selectedCountryCode, setSelectedCountryCode] = useState(countryCodes[0]);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');

  const isAppleHiddenEmail = socialProfile?.provider === 'apple' && socialProfile?.isEmailHidden;
  const isGoogleProvider = socialProfile?.provider === 'google';

  const requestPhoneVerification = useRequestPhoneVerification();
  const confirmPhoneVerification = useConfirmPhoneVerification();

  useEffect(() => {
    if (!socialProfile || !onboardingToken) {
      navigate('/splash');
    }
  }, [socialProfile, onboardingToken, navigate]);

  useEffect(() => {
    if (!showPhoneVerificationModal) { setVerifyKbHeight(0); return; }
    const vv = window.visualViewport;
    if (!vv) return;
    const handleResize = () => {
      const kbH = window.innerHeight - vv.height;
      setVerifyKbHeight(kbH > 50 ? kbH : 0);
    };
    vv.addEventListener('resize', handleResize);
    return () => vv.removeEventListener('resize', handleResize);
  }, [showPhoneVerificationModal]);

  const profileForm = useForm<ProfileFormData>({
    resolver: zodResolver(createProfileSchema(!!isAppleHiddenEmail)),
    mode: 'onTouched',
    defaultValues: {
      email: isAppleHiddenEmail ? '' : (socialProfile?.email || ''),
      nickname: socialProfile?.name?.replace(/\s/g, '') || '',
      name: socialProfile?.name || '',
      phone: '',
    },
  });

  const termsForm = useForm<TermsFormData>({
    resolver: zodResolver(termsSchema),
    mode: 'onChange',
  });

  const watchNickname = profileForm.watch('nickname');
  const watchName = profileForm.watch('name');
  const watchEmail = profileForm.watch('email');
  const watchPhone = profileForm.watch('phone');
  const watchDateOfBirth = profileForm.watch('dateOfBirth');

  const shouldCheckNickname = watchNickname && watchNickname.length >= 2 && watchNickname.length <= 12 && !watchNickname.includes(' ') && /^[a-zA-Z0-9가-힣_]+$/.test(watchNickname);
  const nicknameCheck = useNicknameCheck(watchNickname || '', shouldCheckNickname || false);

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const shouldCheckEmail = isAppleHiddenEmail && !!watchEmail && emailRegex.test(watchEmail);
  const emailCheck = useEmailCheck(watchEmail || '', shouldCheckEmail);
  const [emailError, setEmailError] = useState<string[]>([]);

  useEffect(() => {
    if (watchDateOfBirth && watchDateOfBirth.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const [year, month, day] = watchDateOfBirth.split('-');
      setDateDisplayValue(`${year} / ${month} / ${day}`);
    }
  }, [watchDateOfBirth]);

  useEffect(() => {
    if (watchNickname && watchNickname.length > 0) {
      const errors: string[] = [];
      if (watchNickname.length < 2 || watchNickname.length > 12) errors.push(t('auth.nicknameRule'));
      if (watchNickname.includes(' ')) errors.push(t('auth.nicknameNoSpace'));
      if (!/^[a-zA-Z0-9가-힣_]+$/.test(watchNickname)) errors.push(t('auth.nicknameInvalidChar'));
      if (shouldCheckNickname && nicknameCheck.data && !nicknameCheck.data.available) {
        if (nicknameCheck.data.reason === 'duplicate') errors.push(t('auth.nicknameDuplicate'));
      }
      setNicknameError(errors);
    } else {
      setNicknameError([]);
    }
  }, [watchNickname, nicknameCheck.data, shouldCheckNickname]);

  useEffect(() => {
    if (isAppleHiddenEmail && watchEmail && watchEmail.length > 0) {
      const errors: string[] = [];
      if (!emailRegex.test(watchEmail)) {
        errors.push(t('auth.emailPlaceholder'));
      } else if (shouldCheckEmail && emailCheck.data && !emailCheck.data.available) {
        if (emailCheck.data.reason === 'duplicate') errors.push(t('auth.emailDuplicate'));
        if (emailCheck.data.reason === 'withdrawn') errors.push(t('auth.emailWithdrawn'));
      }
      setEmailError(errors);
    } else {
      setEmailError([]);
    }
  }, [watchEmail, emailCheck.data, shouldCheckEmail, isAppleHiddenEmail]);

  const isValidDateOfBirth = (dateStr: string | undefined): boolean => {
    if (!dateStr) return false;
    const parts = dateStr.split('-');
    if (parts.length !== 3) return false;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const day = parseInt(parts[2], 10);
    const currentYear = new Date().getFullYear();
    if (isNaN(year) || year < 1900 || year > currentYear) return false;
    if (isNaN(month) || month < 1 || month > 12) return false;
    if (isNaN(day) || day < 1 || day > 31) return false;
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  };

  const profileErrors = profileForm.formState.errors;
  const isEmailOk = isAppleHiddenEmail
    ? (!watchEmail || (!profileErrors.email && emailError.length === 0 && (!shouldCheckEmail || (emailCheck.data?.available === true))))
    : (!!watchEmail && !profileErrors.email);
  const isProfileValid =
    isEmailOk &&
    watchNickname &&
    watchName &&
    watchPhone &&
    watchDateOfBirth &&
    !profileErrors.nickname &&
    !profileErrors.name &&
    !profileErrors.phone &&
    nicknameError.length === 0 &&
    isValidDateOfBirth(watchDateOfBirth) &&
    phoneVerified;

  const watchTermsService = termsForm.watch('termsService');
  const watchTermsPayment = termsForm.watch('termsPayment');
  const watchTermsRefund = termsForm.watch('termsRefund');
  const agreeAll = watchTermsService && watchTermsPayment && watchTermsRefund;
  const isTermsValid = watchTermsService && watchTermsPayment && watchTermsRefund;

  const handleAgreeAll = () => {
    termsForm.setValue('termsService', !agreeAll);
    termsForm.setValue('termsPayment', !agreeAll);
    termsForm.setValue('termsRefund', !agreeAll);
  };

  const handleRequestPhoneVerification = async () => {
    const phone = profileForm.getValues('phone');
    if (!phone || phone.length < 4) return;
    setError(null);
    try {
      await requestPhoneVerification.mutateAsync({ phone, countryCode: selectedCountryCode.dial });
      setShowPhoneVerificationModal(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('auth.verificationFailed'));
    }
  };

  const handleConfirmPhoneVerification = async () => {
    const phone = profileForm.getValues('phone');
    if (!phone || !phoneVerificationInput) {
      setPhoneVerificationError(t('auth.enterVerification'));
      return;
    }
    setPhoneVerificationError(null);
    try {
      await confirmPhoneVerification.mutateAsync({ phone, code: phoneVerificationInput });
      setPhoneVerified(true);
      setShowPhoneVerificationModal(false);
      setPhoneVerificationInput('');
      setPhoneVerificationError(null);
    } catch (err: unknown) {
      setPhoneVerificationError(err instanceof Error ? err.message : t('auth.verificationInvalid'));
    }
  };

  const onProfileSubmit = async (_data: ProfileFormData) => {
    if (nicknameError.length > 0) {
      setError(t('auth.fixNickname'));
      return;
    }
    if (!phoneVerified) {
      setError(t('auth.completePhoneVerification'));
      return;
    }
    setStep(2);
    setError(null);
  };

  const onTermsSubmit = async (data: TermsFormData) => {
    if (!socialProfile || !onboardingToken) return;
    setError(null);

    const profileData = profileForm.getValues();

    socialOnboarding.mutate(
      {
        onboardingToken,
        email: profileData.email || undefined,
        nickname: profileData.nickname,
        name: profileData.name,
        phone: profileData.phone,
        dateOfBirth: profileData.dateOfBirth,
        language: getCurrentLanguage(),
        termsConsents: [
          { termsType: 'service', consented: data.termsService },
          { termsType: 'payment', consented: data.termsPayment },
          { termsType: 'refund', consented: data.termsRefund },
        ],
      },
      {
        onError: (err) => {
          setError(err instanceof Error ? err.message : t('auth.signupFailed'));
        },
      }
    );
  };

  if (!socialProfile) return null;

  const providerLabel = socialProfile.provider === 'google' ? 'Google' : 'Apple';

  return (
    <div className="min-h-screen flex flex-col px-4 py-8 bg-white" style={{ paddingTop: 'max(32px, env(safe-area-inset-top, 32px))' }}>
      <div className="w-full max-w-sm mx-auto space-y-6">
        <div className="relative">
          <button
            onClick={() => {
              if (step === 1) navigate('/splash');
              else setStep(1);
            }}
            className="absolute left-0 top-0 w-10 h-10 rounded-full bg-white flex items-center justify-center hover:bg-gray-100 shadow-sm -ml-2"
          >
            <ChevronLeft className="w-5 h-5 text-gray-700" />
          </button>
          <div className="text-center space-y-4">
            <h1 className="text-2xl font-bold">{t('auth.socialSignup', { provider: providerLabel })}</h1>
            <p className="text-sm text-muted-foreground">
              {step === 1 && t('auth.profileInfo')}
              {step === 2 && t('auth.termsAgreement')}
            </p>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
        )}

        {step === 1 && (
          <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-1">
                <Label htmlFor="email">{t('auth.email')}</Label>
                {isAppleHiddenEmail && (
                  <>
                    <span className="text-xs text-gray-400">({t('common.optional')})</span>
                    <button
                      type="button"
                      onClick={() => setShowEmailTooltip(!showEmailTooltip)}
                      className="text-gray-400 hover:text-gray-600 ml-0.5"
                    >
                      <HelpCircle className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
              {showEmailTooltip && (
                <div className="relative bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-600 leading-relaxed">
                  <button
                    type="button"
                    onClick={() => setShowEmailTooltip(false)}
                    className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                  <p className="pr-5">{t('auth.emailTooltip')}</p>
                </div>
              )}
              <Input
                id="email"
                type="email"
                {...profileForm.register('email')}
                placeholder={isAppleHiddenEmail ? t('auth.emailOptionalPlaceholder') : t('auth.emailPlaceholder')}
                className={`bg-gray-100 ${profileErrors.email || emailError.length > 0 ? 'border-red-500' : ''}`}
                disabled={isGoogleProvider}
              />
              {profileErrors.email && watchEmail && !isAppleHiddenEmail && <p className="text-sm text-red-500">{t('auth.emailPlaceholder')}</p>}
              {emailError.length > 0 && emailError.map((err, i) => (
                <p key={i} className="text-sm text-red-500">{err}</p>
              ))}
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">{t('auth.phone')}</Label>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => { if (!phoneVerified) { setShowCountryPicker(true); setCountrySearch(''); } }}
                  disabled={phoneVerified}
                  className="flex items-center gap-1 px-2 h-10 border border-gray-300 rounded-md text-sm whitespace-nowrap shrink-0 hover:bg-gray-50 disabled:opacity-50"
                >
                  <span>{selectedCountryCode.flag}</span>
                  <span className="text-gray-700">{selectedCountryCode.dial}</span>
                  <ChevronDown className="w-3 h-3 text-gray-400" />
                </button>
                <div className="relative flex-1">
                  <Input
                    id="phone"
                    type="tel"
                    {...profileForm.register('phone', {
                      onChange: (e) => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 15);
                        profileForm.setValue('phone', val, { shouldValidate: true });
                        if (phoneVerified) {
                          setPhoneVerified(false);
                        }
                      }
                    })}
                    placeholder={t('auth.phonePlaceholder')}
                    className={`pr-24 bg-gray-100 ${profileErrors.phone ? 'border-red-500' : ''}`}
                    disabled={phoneVerified}
                    maxLength={15}
                    inputMode="numeric"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleRequestPhoneVerification}
                    disabled={requestPhoneVerification.isPending || phoneVerified || !watchPhone || watchPhone.length < 4}
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 px-2 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700"
                  >
                    {phoneVerified ? t('auth.verificationComplete') : requestPhoneVerification.isPending ? t('auth.sending') : t('auth.sendVerificationCode')}
                  </Button>
                </div>
              </div>
              {profileErrors.phone && !phoneVerified && (
                <p className="text-sm text-red-500">{t(profileErrors.phone.message || '')}</p>
              )}
              {phoneVerified && (
                <p className="text-sm text-green-600">✓ {t('auth.phoneVerified')}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="nickname">{t('auth.nickname')}</Label>
              <div className="relative">
                <Input
                  id="nickname"
                  type="text"
                  {...profileForm.register('nickname')}
                  placeholder={t('auth.enterNickname')}
                  className={`pr-10 bg-gray-100 ${nicknameError.length > 0 ? 'border-red-500' : ''}`}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); document.getElementById('name')?.focus(); } }}
                />
                {watchNickname && nicknameError.length === 0 && !profileErrors.nickname && nicknameCheck.data?.available && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <CheckCircle2 className="w-5 h-5 text-[#4A2C1A]" />
                  </div>
                )}
              </div>
              {nicknameError.length > 0 && (
                <div className="space-y-1">
                  {nicknameError.map((err, i) => (
                    <p key={i} className="text-sm text-red-500">{err}</p>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">{t('auth.name')}</Label>
              <Input
                id="name"
                type="text"
                {...profileForm.register('name')}
                placeholder={t('auth.enterName')}
                className={`bg-gray-100 ${profileErrors.name ? 'border-red-500' : ''}`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    (e.target as HTMLInputElement).blur();
                    setShowCalendar(true);
                  }
                }}
              />
              {profileErrors.name && <p className="text-sm text-red-500">{t(profileErrors.name.message || '')}</p>}
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="dateOfBirth">{t('auth.dateOfBirth')}</Label>
                <button type="button" onClick={() => setShowCalendar(!showCalendar)} className="text-gray-500 hover:text-gray-700">
                  <Calendar className="w-4 h-4" />
                </button>
              </div>
              <Input
                id="dateOfBirth"
                type="text"
                value={dateDisplayValue}
                readOnly
                inputMode="none"
                onFocus={(e) => { e.target.blur(); setShowCalendar(true); }}
                onClick={() => setShowCalendar(true)}
                placeholder="YYYY / MM / DD"
                className={`bg-gray-100 text-center cursor-pointer select-none ${profileErrors.dateOfBirth ? 'border-red-500' : ''}`}
                style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
              />
              {profileErrors.dateOfBirth && <p className="text-sm text-red-500">{t(profileErrors.dateOfBirth.message || '')}</p>}
            </div>

            {showCalendar && (
              <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center px-4" onClick={() => setShowCalendar(false)}>
                <div className="bg-white rounded-2xl w-full max-w-sm p-4 animate-modal-pop" onClick={(e) => e.stopPropagation()}>
                  <ScrollYearMonthPicker
                    selectedYear={watchDateOfBirth ? parseInt(watchDateOfBirth.split('-')[0]) : 2000}
                    selectedMonth={watchDateOfBirth ? parseInt(watchDateOfBirth.split('-')[1]) : 1}
                    selectedDay={watchDateOfBirth ? parseInt(watchDateOfBirth.split('-')[2]) : 1}
                    onSelect={() => {}}
                    onSelectDay={(year: number, month: number, day: number) => {
                      const m = String(month).padStart(2, '0');
                      const d = String(day).padStart(2, '0');
                      profileForm.setValue('dateOfBirth', `${year}-${m}-${d}`, { shouldValidate: true });
                      setDateDisplayValue(`${year} / ${m} / ${d}`);
                      setShowCalendar(false);
                    }}
                    onClose={() => setShowCalendar(false)}
                    mode="year-month-day"
                  />
                </div>
              </div>
            )}

            <Button type="submit" className="w-full bg-[#4A2C1A] hover:bg-[#3A2010] text-white" disabled={!isProfileValid}>
              {t('common.next')}
            </Button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={termsForm.handleSubmit(onTermsSubmit)} className="space-y-4">
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={handleAgreeAll}
                className="w-full flex items-center gap-3 px-4 py-4 bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${agreeAll ? 'bg-[#4A2C1A] border-[#4A2C1A]' : 'border-gray-300'}`}>
                  {agreeAll && <CheckCircle2 className="w-4 h-4 text-white" />}
                </div>
                <span className="text-base font-semibold text-gray-900">{t('auth.agreeAll')}</span>
              </button>

              <div className="divide-y divide-gray-100">
                {(['service', 'payment', 'refund'] as const).map((type) => {
                  const key = `terms${type.charAt(0).toUpperCase() + type.slice(1)}` as keyof TermsFormData;
                  const label = t(`auth.terms${type.charAt(0).toUpperCase() + type.slice(1)}` as Parameters<typeof t>[0]);
                  const checked = termsForm.watch(key);

                  return (
                    <label key={type} className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors">
                      <input type="checkbox" checked={!!checked} onChange={(e) => termsForm.setValue(key, e.target.checked)} className="sr-only" />
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${checked ? 'bg-[#4A2C1A] border-[#4A2C1A]' : 'border-gray-300'}`}>
                        {checked && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                      </div>
                      <div className="flex-1 flex items-center justify-between">
                        <span className="text-sm text-gray-700">{t('auth.required')} {label}</span>
                        <button type="button" onClick={(e) => { e.preventDefault(); setShowTermsModal(type); }} className="text-xs text-gray-400 hover:text-gray-600">
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            <Button type="submit" className="w-full bg-[#4A2C1A] hover:bg-[#3A2010] text-white" disabled={!isTermsValid || socialOnboarding.isPending}>
              {socialOnboarding.isPending ? t('auth.signingUp') : t('auth.signupAction')}
            </Button>
          </form>
        )}
      </div>

      {showPhoneVerificationModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center animate-overlay-fade px-4" onClick={() => setShowPhoneVerificationModal(false)}>
          <div
            className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4 animate-modal-pop"
            onClick={(e) => e.stopPropagation()}
            style={{
              transform: verifyKbHeight > 0 ? `translateY(-${verifyKbHeight / 2}px)` : 'none',
              transition: 'transform 0.2s ease-out',
            }}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{t('auth.phoneVerifyTitle')}</h2>
              <button onClick={() => setShowPhoneVerificationModal(false)} className="p-2 rounded-full hover:bg-gray-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-gray-500">{t('auth.phoneVerifyDesc')}</p>
            <div className="space-y-2">
              <Label htmlFor="phoneCode">{t('auth.verificationCode')}</Label>
              <Input
                id="phoneCode"
                type="text"
                value={phoneVerificationInput}
                onChange={(e) => {
                  setPhoneVerificationInput(e.target.value.replace(/\D/g, '').slice(0, 6));
                  setPhoneVerificationError(null);
                }}
                placeholder={t('auth.enterVerificationCode')}
                maxLength={6}
                className={`text-center text-lg tracking-widest focus:placeholder-transparent ${phoneVerificationError ? 'border-red-500' : ''}`}
              />
              {phoneVerificationError && (
                <p className="text-sm text-red-500">{phoneVerificationError}</p>
              )}
            </div>
            <Button onClick={handleConfirmPhoneVerification} className="w-full bg-[#4A2C1A] hover:bg-[#3A2010] text-white" disabled={phoneVerificationInput.length !== 6 || confirmPhoneVerification.isPending}>
              {confirmPhoneVerification.isPending ? t('auth.verifying') : t('common.confirm')}
            </Button>
          </div>
        </div>
      )}

      {showCountryPicker && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center animate-overlay-fade"
          onClick={() => setShowCountryPicker(false)}
        >
          <div
            className="bg-white rounded-t-2xl w-full max-w-sm animate-modal-pop"
            onClick={(e) => e.stopPropagation()}
            style={{ maxHeight: '70vh' }}
          >
            <div className="p-4 border-b border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold">{getCurrentLanguage() === 'ko' ? '국가 선택' : 'Select Country'}</h2>
                <button onClick={() => setShowCountryPicker(false)} className="p-2 rounded-full hover:bg-gray-100">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <Input
                type="text"
                value={countrySearch}
                onChange={(e) => setCountrySearch(e.target.value)}
                placeholder={getCurrentLanguage() === 'ko' ? '국가 검색...' : 'Search country...'}
                className="text-sm"
                autoFocus
              />
            </div>
            <div className="overflow-y-auto" style={{ maxHeight: 'calc(70vh - 120px)' }}>
              {countryCodes
                .filter((c) => {
                  if (!countrySearch) return true;
                  const q = countrySearch.toLowerCase();
                  return c.name.toLowerCase().includes(q) || c.nameEn.toLowerCase().includes(q) || c.dial.includes(q) || c.code.toLowerCase().includes(q);
                })
                .map((c) => (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => {
                      setSelectedCountryCode(c);
                      setShowCountryPicker(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-left ${
                      selectedCountryCode.code === c.code ? 'bg-[#f6efed]' : ''
                    }`}
                  >
                    <span className="text-xl">{c.flag}</span>
                    <span className="flex-1 text-sm text-gray-800">
                      {getCurrentLanguage() === 'ko' ? c.name : c.nameEn}
                    </span>
                    <span className="text-sm text-gray-500">{c.dial}</span>
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}

      {showTermsModal && <TermsModal type={showTermsModal} onClose={() => setShowTermsModal(false)} />}
    </div>
  );
}

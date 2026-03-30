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
import { useRequestEmailVerification, useConfirmEmailVerification } from '@/hooks/useEmailVerification';
import { ChevronLeft, ChevronRight, CheckCircle2, Calendar, X } from 'lucide-react';
import { TermsModal } from '@/pages/my/TermsModal';
import { ScrollYearMonthPicker } from '@/components/ScrollYearMonthPicker';
import { useT } from '@/hooks/useTranslation';

const nicknameSchema = z
  .string()
  .min(2, 'auth.nicknameRule')
  .max(12, 'auth.nicknameRule')
  .refine((val) => !val.includes(' '), 'auth.nicknameNoSpace')
  .refine((val) => /^[a-zA-Z0-9가-힣_]+$/.test(val), 'auth.nicknameInvalidChar');

const profileSchema = z.object({
  email: z.string().email('auth.emailPlaceholder'),
  nickname: nicknameSchema,
  name: z.string().min(1, 'auth.enterName').max(100),
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

type ProfileFormData = z.infer<typeof profileSchema>;
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
  const [emailVerified, setEmailVerified] = useState(false);
  const [showEmailVerificationModal, setShowEmailVerificationModal] = useState(false);
  const [emailVerificationInput, setEmailVerificationInput] = useState('');

  const requestEmailVerification = useRequestEmailVerification();
  const confirmEmailVerification = useConfirmEmailVerification();

  const isAppleEmailHidden = socialProfile?.provider === 'apple' && socialProfile?.isEmailHidden;
  const needsEmailInput = isAppleEmailHidden;

  useEffect(() => {
    if (!socialProfile || !onboardingToken) {
      navigate('/splash');
    }
  }, [socialProfile, onboardingToken, navigate]);

  const profileForm = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    mode: 'onChange',
    defaultValues: {
      email: socialProfile?.email || '',
      nickname: socialProfile?.name?.replace(/\s/g, '') || '',
      name: socialProfile?.name || '',
    },
  });

  const termsForm = useForm<TermsFormData>({
    resolver: zodResolver(termsSchema),
    mode: 'onChange',
  });

  const watchNickname = profileForm.watch('nickname');
  const watchName = profileForm.watch('name');
  const watchEmail = profileForm.watch('email');
  const watchDateOfBirth = profileForm.watch('dateOfBirth');

  const shouldCheckNickname = watchNickname && watchNickname.length >= 2 && watchNickname.length <= 12 && !watchNickname.includes(' ') && /^[a-zA-Z0-9가-힣_]+$/.test(watchNickname);
  const nicknameCheck = useNicknameCheck(watchNickname || '', shouldCheckNickname || false);

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
  const isProfileValid =
    watchEmail &&
    watchNickname &&
    watchName &&
    watchDateOfBirth &&
    !profileErrors.email &&
    !profileErrors.nickname &&
    !profileErrors.name &&
    nicknameError.length === 0 &&
    isValidDateOfBirth(watchDateOfBirth) &&
    (!needsEmailInput || emailVerified);

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

  const handleRequestEmailVerification = async () => {
    const email = profileForm.getValues('email');
    if (!email) return;
    setError(null);
    try {
      await requestEmailVerification.mutateAsync(email);
      setShowEmailVerificationModal(true);
    } catch (err: any) {
      setError(err?.message || t('auth.verificationFailed'));
    }
  };

  const handleConfirmEmailVerification = async () => {
    const email = profileForm.getValues('email');
    if (!email || !emailVerificationInput) return;
    setError(null);
    try {
      await confirmEmailVerification.mutateAsync({ email, code: emailVerificationInput });
      setEmailVerified(true);
      setShowEmailVerificationModal(false);
      setEmailVerificationInput('');
    } catch (err: any) {
      setError(err?.message || t('auth.verificationInvalid'));
    }
  };

  const onProfileSubmit = async (_data: ProfileFormData) => {
    if (nicknameError.length > 0) {
      setError(t('auth.fixNickname'));
      return;
    }
    if (needsEmailInput && !emailVerified) {
      setError(t('auth.completeEmailVerification'));
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
        email: isAppleEmailHidden ? profileData.email : undefined,
        nickname: profileData.nickname,
        name: profileData.name,
        dateOfBirth: profileData.dateOfBirth,
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
    <div className="min-h-screen flex flex-col px-4 py-8 bg-white">
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
              <Label htmlFor="email">{t('auth.email')}</Label>
              {needsEmailInput ? (
                <div className="relative">
                  <Input
                    id="email"
                    type="email"
                    {...profileForm.register('email')}
                    placeholder={t('auth.emailPlaceholder')}
                    className={`pr-28 ${profileErrors.email ? 'border-red-500' : ''}`}
                    disabled={emailVerified}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleRequestEmailVerification}
                    disabled={requestEmailVerification.isPending || emailVerified || !watchEmail || !!profileErrors.email}
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-8 px-3 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700"
                  >
                    {emailVerified ? t('auth.verificationComplete') : requestEmailVerification.isPending ? t('auth.sending') : t('auth.sendVerificationCode')}
                  </Button>
                </div>
              ) : (
                <Input
                  id="email"
                  type="email"
                  value={socialProfile.email}
                  disabled
                  className="bg-gray-100 text-gray-600"
                />
              )}
              {emailVerified && needsEmailInput && (
                <p className="text-sm text-green-600">✓ {t('auth.emailVerified')}</p>
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
                />
                {watchNickname && nicknameError.length === 0 && !profileErrors.nickname && nicknameCheck.data?.available && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <CheckCircle2 className="w-5 h-5 text-[#665146]" />
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
              />
              {profileErrors.name && <p className="text-sm text-red-500">{profileErrors.name.message}</p>}
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
                onChange={(e) => {
                  let value = e.target.value.replace(/[^0-9/\s]/g, '');
                  setDateDisplayValue(value);
                  const cleaned = value.replace(/[\s/]/g, '');
                  if (cleaned.length === 8) {
                    const year = cleaned.substring(0, 4);
                    const month = cleaned.substring(4, 6);
                    const day = cleaned.substring(6, 8);
                    profileForm.setValue('dateOfBirth', `${year}-${month}-${day}`, { shouldValidate: true });
                  } else {
                    profileForm.setValue('dateOfBirth', '', { shouldValidate: true });
                  }
                }}
                placeholder="YYYY / MM / DD"
                className={`bg-gray-100 ${profileErrors.dateOfBirth ? 'border-red-500' : ''}`}
                maxLength={14}
              />
              {profileErrors.dateOfBirth && <p className="text-sm text-red-500">{profileErrors.dateOfBirth.message}</p>}
            </div>

            {showCalendar && (
              <div className="fixed inset-0 z-50 bg-black/50 flex items-end" onClick={() => setShowCalendar(false)}>
                <div className="bg-white rounded-t-2xl w-full p-4 animate-modal-sheet" onClick={(e) => e.stopPropagation()}>
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

            <Button type="submit" className="w-full bg-[#665146] hover:bg-[#5A453A] text-white" disabled={!isProfileValid}>
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
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${agreeAll ? 'bg-[#665146] border-[#665146]' : 'border-gray-300'}`}>
                  {agreeAll && <CheckCircle2 className="w-4 h-4 text-white" />}
                </div>
                <span className="text-base font-semibold text-gray-900">{t('auth.agreeAll')}</span>
              </button>

              <div className="divide-y divide-gray-100">
                {(['service', 'payment', 'refund'] as const).map((type) => {
                  const key = `terms${type.charAt(0).toUpperCase() + type.slice(1)}` as keyof TermsFormData;
                  const label = t(`auth.terms${type.charAt(0).toUpperCase() + type.slice(1)}` as any);
                  const checked = termsForm.watch(key);

                  return (
                    <label key={type} className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors">
                      <input type="checkbox" checked={!!checked} onChange={(e) => termsForm.setValue(key, e.target.checked)} className="sr-only" />
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${checked ? 'bg-[#665146] border-[#665146]' : 'border-gray-300'}`}>
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

            <Button type="submit" className="w-full bg-[#665146] hover:bg-[#5A453A] text-white" disabled={!isTermsValid || socialOnboarding.isPending}>
              {socialOnboarding.isPending ? t('auth.signingUp') : t('auth.signupAction')}
            </Button>
          </form>
        )}
      </div>

      {showEmailVerificationModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center animate-overlay-fade px-4" onClick={() => setShowEmailVerificationModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4 animate-modal-pop" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{t('auth.emailVerifyTitle')}</h2>
              <button onClick={() => setShowEmailVerificationModal(false)} className="p-2 rounded-full hover:bg-gray-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-2">
              <Label htmlFor="emailCode">{t('auth.verificationCode')}</Label>
              <Input
                id="emailCode"
                type="text"
                value={emailVerificationInput}
                onChange={(e) => setEmailVerificationInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder={t('auth.enterVerificationCode')}
                maxLength={6}
                className="text-center text-lg tracking-widest"
              />
            </div>
            <Button onClick={handleConfirmEmailVerification} className="w-full bg-[#665146] hover:bg-[#5A453A] text-white" disabled={emailVerificationInput.length !== 6 || confirmEmailVerification.isPending}>
              {confirmEmailVerification.isPending ? t('auth.verifying') : t('common.confirm')}
            </Button>
          </div>
        </div>
      )}

      {showTermsModal && <TermsModal type={showTermsModal} onClose={() => setShowTermsModal(false)} />}
    </div>
  );
}

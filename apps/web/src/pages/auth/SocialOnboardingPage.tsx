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

const nicknameSchema = z
  .string()
  .min(2, '닉네임은 2~12자로 입력해 주세요.')
  .max(12, '닉네임은 2~12자로 입력해 주세요.')
  .refine((val) => !val.includes(' '), '닉네임에 공백은 사용할 수 없습니다.')
  .refine((val) => /^[a-zA-Z0-9가-힣_]+$/.test(val), '사용할 수 없는 문자가 포함되어 있습니다.');

const profileSchema = z.object({
  email: z.string().email('올바른 이메일을 입력해주세요'),
  nickname: nicknameSchema,
  name: z.string().min(1, '이름을 입력해주세요.').max(100),
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
    }, '생년월일을 정확하게 입력해주세요.')
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
  const socialProfile = location.state?.socialProfile as SocialProfile | undefined;
  const onboardingToken = location.state?.onboardingToken as string | undefined;
  const socialOnboarding = useSocialOnboarding();

  const [step, setStep] = useState<1 | 2>(1);
  const [error, setError] = useState<string | null>(null);
  const [nicknameError, setNicknameError] = useState<string[]>([]);
  const [showTermsModal, setShowTermsModal] = useState<false | 'service' | 'payment' | 'refund'>(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [dateDisplayValue, setDateDisplayValue] = useState('');
  const [emailVerified, setEmailVerified] = useState(false);
  const [showEmailVerificationModal, setShowEmailVerificationModal] = useState(false);
  const [emailVerificationCode, setEmailVerificationCode] = useState<string | null>(null);
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
      if (watchNickname.length < 2 || watchNickname.length > 12) errors.push('닉네임은 2~12자로 입력해 주세요.');
      if (watchNickname.includes(' ')) errors.push('닉네임에 공백은 사용할 수 없습니다.');
      if (!/^[a-zA-Z0-9가-힣_]+$/.test(watchNickname)) errors.push('사용할 수 없는 문자가 포함되어 있습니다.');
      if (shouldCheckNickname && nicknameCheck.data && !nicknameCheck.data.available) {
        if (nicknameCheck.data.reason === 'duplicate') errors.push('이미 사용 중인 닉네임입니다.');
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
      const result = await requestEmailVerification.mutateAsync(email);
      setShowEmailVerificationModal(true);
      if (result.code) {
        setEmailVerificationCode(result.code);
      }
    } catch (err: any) {
      setError(err?.message || '인증 코드 발송에 실패했습니다');
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
      setError(err?.message || '인증 코드가 올바르지 않습니다');
    }
  };

  const onProfileSubmit = async (_data: ProfileFormData) => {
    if (nicknameError.length > 0) {
      setError('닉네임을 올바르게 입력해주세요');
      return;
    }
    if (needsEmailInput && !emailVerified) {
      setError('이메일 인증을 완료해주세요');
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
          setError(err instanceof Error ? err.message : '회원가입에 실패했습니다');
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
            <h1 className="text-2xl font-bold">{providerLabel} 회원가입</h1>
            <p className="text-sm text-muted-foreground">
              {step === 1 && '회원 정보를 입력해주세요.'}
              {step === 2 && '약관에 동의해주세요.'}
            </p>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
        )}

        {step === 1 && (
          <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">이메일</Label>
              {needsEmailInput ? (
                <div className="relative">
                  <Input
                    id="email"
                    type="email"
                    {...profileForm.register('email')}
                    placeholder="이메일을 입력해주세요"
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
                    {emailVerified ? '인증완료' : requestEmailVerification.isPending ? '전송 중...' : '인증번호 보내기'}
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
                <p className="text-sm text-green-600">✓ 이메일 인증이 완료되었습니다</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="nickname">닉네임</Label>
              <div className="relative">
                <Input
                  id="nickname"
                  type="text"
                  {...profileForm.register('nickname')}
                  placeholder="닉네임을 입력하세요"
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
              <Label htmlFor="name">이름</Label>
              <Input
                id="name"
                type="text"
                {...profileForm.register('name')}
                placeholder="이름을 입력하세요"
                className={`bg-gray-100 ${profileErrors.name ? 'border-red-500' : ''}`}
              />
              {profileErrors.name && <p className="text-sm text-red-500">{profileErrors.name.message}</p>}
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="dateOfBirth">생년월일</Label>
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
              다음
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
                <span className="text-base font-semibold text-gray-900">전체 동의합니다</span>
              </button>

              <div className="divide-y divide-gray-100">
                {(['service', 'payment', 'refund'] as const).map((type) => {
                  const key = `terms${type.charAt(0).toUpperCase() + type.slice(1)}` as keyof TermsFormData;
                  const label = type === 'service' ? '서비스 이용약관' : type === 'payment' ? '정기 결제 및 자동 갱신' : '환불/해지 정책';
                  const checked = termsForm.watch(key);

                  return (
                    <label key={type} className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors">
                      <input type="checkbox" checked={!!checked} onChange={(e) => termsForm.setValue(key, e.target.checked)} className="sr-only" />
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${checked ? 'bg-[#665146] border-[#665146]' : 'border-gray-300'}`}>
                        {checked && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                      </div>
                      <div className="flex-1 flex items-center justify-between">
                        <span className="text-sm text-gray-700">(필수) {label}</span>
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
              {socialOnboarding.isPending ? '가입 중...' : '가입하기'}
            </Button>
          </form>
        )}
      </div>

      {showEmailVerificationModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end animate-overlay-fade" onClick={() => setShowEmailVerificationModal(false)}>
          <div className="bg-white rounded-t-2xl w-full max-w-md p-6 space-y-4 animate-modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">이메일 인증번호 입력</h2>
              <button onClick={() => setShowEmailVerificationModal(false)} className="p-2 rounded-full hover:bg-gray-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-2">
              <Label htmlFor="emailCode">인증번호</Label>
              <Input
                id="emailCode"
                type="text"
                value={emailVerificationInput}
                onChange={(e) => setEmailVerificationInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="인증번호 입력"
                maxLength={6}
                className="text-center text-lg tracking-widest"
              />
              {emailVerificationCode && (
                <p className="text-xs text-gray-500 text-center">개발 모드: 인증번호 ({emailVerificationCode})</p>
              )}
            </div>
            <Button onClick={handleConfirmEmailVerification} className="w-full bg-[#665146] hover:bg-[#5A453A] text-white" disabled={emailVerificationInput.length !== 6 || confirmEmailVerification.isPending}>
              {confirmEmailVerification.isPending ? '확인 중...' : '확인'}
            </Button>
          </div>
        </div>
      )}

      {showTermsModal && <TermsModal type={showTermsModal} onClose={() => setShowTermsModal(false)} />}
    </div>
  );
}

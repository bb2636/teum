import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSignup } from '@/hooks/useAuth';
import { useNicknameCheck } from '@/hooks/useNicknameCheck';
import { useEmailDuplicateCheck, useRequestEmailVerification, useConfirmEmailVerification } from '@/hooks/useEmailVerification';
import { useRequestPhoneVerification, useConfirmPhoneVerification } from '@/hooks/usePhoneVerification';
import { getCurrentLanguage } from '@/lib/i18n';
import { ChevronLeft, Eye, EyeOff, X, Calendar, ChevronRight, CheckCircle2 } from 'lucide-react';
import { TermsModal } from '@/pages/my/TermsModal';
import { ScrollYearMonthPicker } from '@/components/ScrollYearMonthPicker';
import { useT } from '@/hooks/useTranslation';

const nicknameSchema = z
  .string()
  .min(2, 'auth.nicknameRule')
  .max(12, 'auth.nicknameRule')
  .refine((val) => !val.includes(' '), 'auth.nicknameNoSpace')
  .refine((val) => /^[a-zA-Z0-9가-힣_]+$/.test(val), 'auth.nicknameInvalidChar');

const passwordSchema = z
  .string()
  .min(8, 'auth.passwordMinLength')
  .refine((val) => /[a-zA-Z]/.test(val), 'auth.passwordNeedLetter')
  .refine((val) => /[0-9]/.test(val), 'auth.passwordNeedNumber');

const step1Schema = z.object({
  email: z.string().email('auth.emailPlaceholder'),
  password: passwordSchema,
  confirmPassword: z.string(),
  phone: z.string().min(10, 'auth.phoneInvalidLength').max(11, 'auth.phoneInvalidLength').optional().or(z.literal('')),
});

const step2Schema = z.object({
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
      if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return false;
      return true;
    }, 'auth.enterDateOfBirth')
    .optional(),
});

const step3Schema = z.object({
  termsService: z.boolean().refine((val) => val === true, 'auth.termsService'),
  termsPayment: z.boolean().refine((val) => val === true, 'auth.termsPayment'),
  termsRefund: z.boolean().refine((val) => val === true, 'auth.termsRefund'),
});

type Step1FormData = z.infer<typeof step1Schema>;
type Step2FormData = z.infer<typeof step2Schema>;
type Step3FormData = z.infer<typeof step3Schema>;

export function SignupPage() {
  const navigate = useNavigate();
  const signupMutation = useSignup();
  const t = useT();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [error, setError] = useState<string | null>(null);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [verificationMode, setVerificationMode] = useState<'phone' | 'email'>('phone');
  const [showPhoneVerificationModal, setShowPhoneVerificationModal] = useState(false);
  const [showEmailVerificationModal, setShowEmailVerificationModal] = useState(false);
  const [verifyKbHeight, setVerifyKbHeight] = useState(0);
  const [phoneVerificationInput, setPhoneVerificationInput] = useState('');
  const [emailVerificationInput, setEmailVerificationInput] = useState('');
  const [phoneVerificationError, setPhoneVerificationError] = useState<string | null>(null);
  const [emailVerificationError, setEmailVerificationError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [nicknameError, setNicknameError] = useState<string[]>([]);
  const [formData, setFormData] = useState<{
    step1?: Step1FormData;
    step2?: Step2FormData;
    step3?: Step3FormData;
  }>({});

  const [emailError, setEmailError] = useState<string | null>(null);
  const requestPhoneVerification = useRequestPhoneVerification();
  const confirmPhoneVerification = useConfirmPhoneVerification();
  const requestEmailVerification = useRequestEmailVerification();
  const confirmEmailVerification = useConfirmEmailVerification();
  const [showTermsModal, setShowTermsModal] = useState<false | 'service' | 'payment' | 'refund'>(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const calendarButtonRef = useRef<HTMLButtonElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const [dateDisplayValue, setDateDisplayValue] = useState('');

  const step1Form = useForm<Step1FormData>({
    resolver: zodResolver(step1Schema),
    mode: 'onBlur',
  });

  const step2Form = useForm<Step2FormData>({
    resolver: zodResolver(step2Schema),
    mode: 'onSubmit',
  });

  const step3Form = useForm<Step3FormData>({
    resolver: zodResolver(step3Schema),
    mode: 'onSubmit',
  });

  const step1Email = step1Form.watch('email');
  const step1Password = step1Form.watch('password');
  const step1ConfirmPassword = step1Form.watch('confirmPassword');
  const step1Phone = step1Form.watch('phone');
  const step2Nickname = step2Form.watch('nickname');
  const step2Name = step2Form.watch('name');
  const step2DateOfBirth = step2Form.watch('dateOfBirth');

  useEffect(() => {
    if (step2DateOfBirth && step2DateOfBirth.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const [year, month, day] = step2DateOfBirth.split('-');
      setDateDisplayValue(`${year} / ${month} / ${day}`);
    }
  }, [step2DateOfBirth]);

  useEffect(() => {
    const isOpen = showPhoneVerificationModal || showEmailVerificationModal;
    if (!isOpen) { setVerifyKbHeight(0); return; }
    const vv = window.visualViewport;
    if (!vv) return;
    const handleResize = () => {
      const kbH = window.innerHeight - vv.height;
      setVerifyKbHeight(kbH > 50 ? kbH : 0);
    };
    vv.addEventListener('resize', handleResize);
    return () => vv.removeEventListener('resize', handleResize);
  }, [showPhoneVerificationModal, showEmailVerificationModal]);
  const step3TermsService = step3Form.watch('termsService');
  const step3TermsPayment = step3Form.watch('termsPayment');
  const step3TermsRefund = step3Form.watch('termsRefund');

  const agreeAll = step3TermsService && step3TermsPayment && step3TermsRefund;

  const handleAgreeAll = () => {
    step3Form.setValue('termsService', !agreeAll);
    step3Form.setValue('termsPayment', !agreeAll);
    step3Form.setValue('termsRefund', !agreeAll);
  };

  const shouldCheckEmail = !!step1Email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(step1Email) && !step1Form.formState.errors.email;
  const emailDuplicateCheck = useEmailDuplicateCheck(step1Email || '', shouldCheckEmail);

  const shouldCheckNickname = step2Nickname && step2Nickname.length >= 2 && step2Nickname.length <= 12 && !step2Nickname.includes(' ') && /^[a-zA-Z0-9가-힣_]+$/.test(step2Nickname);
  const nicknameCheck = useNicknameCheck(step2Nickname || '', shouldCheckNickname || false);

  useEffect(() => {
    if (shouldCheckEmail && emailDuplicateCheck.data) {
      if (emailDuplicateCheck.data.exists) {
        setEmailError(t('auth.emailExistsDuplicate'));
      } else {
        setEmailError(null);
      }
    } else if (!shouldCheckEmail) {
      setEmailError(null);
    }
  }, [shouldCheckEmail, emailDuplicateCheck.data]);

  const handleEnterKey = (e: React.KeyboardEvent, nextId: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const next = document.getElementById(nextId);
      if (next) next.focus();
    }
  };

  const step1Errors = step1Form.formState.errors;
  const isVerified = verificationMode === 'phone' ? phoneVerified : emailVerified;
  const isStep1Valid =
    step1Email &&
    step1Password &&
    step1ConfirmPassword &&
    !emailError &&
    isVerified;

  const step2Errors = step2Form.formState.errors;

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
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return false;
    return true;
  };

  const isStep2Valid =
    step2Nickname &&
    step2Name &&
    step2DateOfBirth &&
    nicknameError.length === 0 &&
    isValidDateOfBirth(step2DateOfBirth);

  const isStep3Valid = step3TermsService === true && step3TermsPayment === true && step3TermsRefund === true;

  useEffect(() => {
    if (step2Nickname && step2Nickname.length > 0) {
      const errors: string[] = [];
      if (step2Nickname.length < 2 || step2Nickname.length > 12) {
        errors.push(t('auth.nicknameRule'));
      }
      if (step2Nickname.includes(' ')) {
        errors.push(t('auth.nicknameNoSpace'));
      }
      if (!/^[a-zA-Z0-9가-힣_]+$/.test(step2Nickname)) {
        errors.push(t('auth.nicknameInvalidChar'));
      }
      if (shouldCheckNickname && nicknameCheck.data && !nicknameCheck.data.available) {
        if (nicknameCheck.data.reason === 'duplicate') {
          errors.push(t('auth.nicknameDuplicate'));
        }
      }
      setNicknameError(errors);
    } else {
      setNicknameError([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step2Nickname, nicknameCheck.data, shouldCheckNickname]);

  const handleRequestPhoneVerification = async () => {
    const phone = step1Form.getValues('phone');
    if (!phone || phone.length < 10) {
      setError(t('auth.phoneRequired'));
      return;
    }

    setError(null);

    if (emailError) {
      setError(t('auth.emailExistsDuplicate'));
      return;
    }

    try {
      await requestPhoneVerification.mutateAsync(phone);
      setShowPhoneVerificationModal(true);
    } catch (err) {
      const error = err as Error;
      setError(error.message || t('auth.verificationFailed'));
    }
  };

  const handleConfirmPhoneVerification = async () => {
    const phone = step1Form.getValues('phone');
    if (!phone || !phoneVerificationInput) {
      setPhoneVerificationError(t('auth.enterVerification'));
      return;
    }

    if (phoneVerificationInput.length !== 6) {
      setPhoneVerificationError(t('auth.verification6Digits'));
      return;
    }

    setPhoneVerificationError(null);

    try {
      await confirmPhoneVerification.mutateAsync({
        phone,
        code: phoneVerificationInput,
      });
      setPhoneVerified(true);
      setShowPhoneVerificationModal(false);
      setPhoneVerificationInput('');
      setPhoneVerificationError(null);
    } catch (err) {
      const error = err as Error;
      setPhoneVerificationError(error.message || t('auth.verificationInvalid'));
    }
  };

  const handleRequestEmailVerification = async () => {
    const email = step1Form.getValues('email');
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError(t('auth.emailPlaceholder'));
      return;
    }

    if (emailError) {
      setError(t('auth.emailExistsDuplicate'));
      return;
    }

    setError(null);

    try {
      await requestEmailVerification.mutateAsync(email);
      setShowEmailVerificationModal(true);
    } catch (err) {
      const error = err as Error;
      setError(error.message || t('auth.verificationFailed'));
    }
  };

  const handleConfirmEmailVerification = async () => {
    const email = step1Form.getValues('email');
    if (!email || !emailVerificationInput) {
      setEmailVerificationError(t('auth.enterVerification'));
      return;
    }

    if (emailVerificationInput.length !== 6) {
      setEmailVerificationError(t('auth.verification6Digits'));
      return;
    }

    setEmailVerificationError(null);

    try {
      await confirmEmailVerification.mutateAsync({
        email,
        code: emailVerificationInput,
      });
      setEmailVerified(true);
      setShowEmailVerificationModal(false);
      setEmailVerificationInput('');
      setEmailVerificationError(null);
    } catch (err) {
      const error = err as Error;
      setEmailVerificationError(error.message || t('auth.verificationInvalid'));
    }
  };

  const onStep1Submit = async (data: Step1FormData) => {
    if (!isVerified) {
      setError(t('auth.completeVerification'));
      return;
    }

    if (data.password !== data.confirmPassword) {
      setError(t('auth.passwordMismatch'));
      return;
    }

    setFormData((prev) => ({ ...prev, step1: data }));
    setStep(2);
    setError(null);
  };

  const onStep2Submit = async (data: Step2FormData) => {
    if (nicknameError.length > 0) {
      setError(t('auth.fixNickname'));
      return;
    }

    setFormData((prev) => ({ ...prev, step2: data }));
    setStep(3);
    setError(null);
  };

  const onStep3Submit = async (data: Step3FormData) => {
    if (!formData.step1 || !formData.step2) {
      setError(t('auth.prevStepMissing'));
      return;
    }

    setError(null);
    signupMutation.mutate(
      {
        email: formData.step1.email,
        password: formData.step1.password,
        nickname: formData.step2.nickname,
        name: formData.step2.name,
        dateOfBirth: formData.step2.dateOfBirth,
        phone: formData.step1.phone,
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

  return (
    <div className="min-h-screen flex flex-col px-4 py-8 bg-white" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)' }}>
      <div className="w-full max-w-sm mx-auto space-y-6">
        <div className="relative">
          <button
            onClick={() => {
              if (step === 1) {
                navigate('/splash');
              } else {
                setStep((prev) => (prev === 2 ? 1 : 2) as 1 | 2 | 3);
              }
            }}
            className="absolute left-0 top-0 w-10 h-10 rounded-full bg-white flex items-center justify-center hover:bg-gray-100 shadow-sm -ml-2"
          >
            <ChevronLeft className="w-5 h-5 text-gray-700" />
          </button>
          <div className="text-center space-y-4">
            <h1 className="text-2xl font-bold">{t('auth.signup')}</h1>
            <p className="text-sm text-muted-foreground">
              {step === 1 && t('auth.accountInfo')}
              {step === 2 && t('auth.profileInfo')}
              {step === 3 && t('auth.termsAgreement')}
            </p>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {step === 1 && (
          <form onSubmit={step1Form.handleSubmit(onStep1Submit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t('auth.email')}</Label>
              <Input
                id="email"
                type="email"
                {...step1Form.register('email')}
                placeholder={t('auth.emailPlaceholder')}
                className={emailError ? 'border-red-500' : ''}
                onKeyDown={(e) => handleEnterKey(e, 'password')}
              />
              {step1Errors.email && (
                <p className="text-sm text-red-500">{t(step1Errors.email.message || '')}</p>
              )}
              {!step1Errors.email && emailError && (
                <p className="text-sm text-red-500">{emailError}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">{t('auth.password')}</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  {...step1Form.register('password')}
                  placeholder={t('auth.passwordPlaceholder')}
                  onKeyDown={(e) => handleEnterKey(e, 'confirmPassword')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {step1Errors.password && (
                <p className="text-sm text-red-500">{t(step1Errors.password.message || '')}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">{t('auth.confirmPassword')}</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  {...step1Form.register('confirmPassword')}
                  placeholder={t('auth.passwordPlaceholder')}
                  onKeyDown={(e) => handleEnterKey(e, 'phone')}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              {step1ConfirmPassword && step1Password && step1ConfirmPassword !== step1Password && step1Form.formState.touchedFields.confirmPassword && (
                <p className="text-sm text-red-500">{t('auth.passwordMismatch')}</p>
              )}
            </div>

            {verificationMode === 'phone' ? (
              <div className="space-y-2">
                <Label htmlFor="phone">{t('auth.phone')}</Label>
                <div className="relative">
                  <Input
                    id="phone"
                    type="tel"
                    {...step1Form.register('phone', {
                      onChange: (e) => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 11);
                        step1Form.setValue('phone', val, { shouldValidate: true });
                      }
                    })}
                    placeholder={t('auth.phonePlaceholder')}
                    className={`pr-32 ${step1Errors.phone ? 'border-red-500' : ''}`}
                    disabled={phoneVerified}
                    maxLength={11}
                    inputMode="numeric"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleRequestPhoneVerification}
                    disabled={requestPhoneVerification.isPending || phoneVerified || !step1Phone || step1Phone.length < 10 || !step1Email || !!step1Errors.email}
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-8 px-3 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700"
                  >
                    {phoneVerified ? t('auth.verificationComplete') : requestPhoneVerification.isPending ? t('auth.sending') : t('auth.sendVerificationCode')}
                  </Button>
                </div>
                {step1Errors.phone && (
                  <p className="text-sm text-red-500">{t(step1Errors.phone.message || '')}</p>
                )}
                {phoneVerified && (
                  <p className="text-sm text-green-600">✓ {t('auth.phoneVerified')}</p>
                )}
                {!phoneVerified && (
                  <button
                    type="button"
                    onClick={() => { setVerificationMode('email'); setError(null); setPhoneVerificationInput(''); setPhoneVerificationError(null); setShowPhoneVerificationModal(false); }}
                    className="text-sm text-[#4A2C1A] underline"
                  >
                    {t('auth.switchToEmailVerification')}
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <Label>{t('auth.email')} {t('auth.sendVerificationCode')}</Label>
                <div className="relative">
                  <Input
                    type="email"
                    value={step1Email || ''}
                    disabled
                    className="pr-32 bg-gray-50"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleRequestEmailVerification}
                    disabled={requestEmailVerification.isPending || emailVerified || !step1Email || !!step1Errors.email || !!emailError}
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-8 px-3 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700"
                  >
                    {emailVerified ? t('auth.verificationComplete') : requestEmailVerification.isPending ? t('auth.sending') : t('auth.sendEmailVerificationCode')}
                  </Button>
                </div>
                {emailVerified && (
                  <p className="text-sm text-green-600">✓ {t('auth.emailVerified')}</p>
                )}
                {!emailVerified && (
                  <button
                    type="button"
                    onClick={() => { setVerificationMode('phone'); setError(null); setEmailVerificationInput(''); setEmailVerificationError(null); setShowEmailVerificationModal(false); }}
                    className="text-sm text-[#4A2C1A] underline"
                  >
                    {t('auth.switchToPhoneVerification')}
                  </button>
                )}
              </div>
            )}

            <Button
              type="submit"
              className="w-full bg-[#4A2C1A] hover:bg-[#3A2010] text-white"
              disabled={!isStep1Valid}
            >
              {t('common.next')}
            </Button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={step2Form.handleSubmit(onStep2Submit)} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="nickname">{t('auth.nickname')}</Label>
              <div className="relative">
                <Input
                  id="nickname"
                  type="text"
                  {...step2Form.register('nickname')}
                  placeholder={t('auth.enterNickname')}
                  className={`pr-10 bg-gray-100 ${
                    nicknameError.length > 0 ? 'border-red-500' : ''
                  }`}
                  onKeyDown={(e) => handleEnterKey(e, 'name')}
                />
                {step2Nickname && 
                 nicknameError.length === 0 && 
                 !step2Errors.nickname && 
                 nicknameCheck.data?.available && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <CheckCircle2 className="w-5 h-5 text-[#4A2C1A]" />
                  </div>
                )}
              </div>
              {nicknameError.length > 0 && (
                <div className="space-y-1">
                  {nicknameError.map((err, index) => (
                    <p key={index} className="text-sm text-red-500">
                      {err}
                    </p>
                  ))}
                </div>
              )}
              {step2Errors.nickname && nicknameError.length === 0 && (
                <p className="text-sm text-red-500">{t(step2Errors.nickname.message || '')}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">{t('auth.name')}</Label>
              <Input
                id="name"
                type="text"
                {...step2Form.register('name')}
                placeholder={t('auth.enterName')}
                className="bg-gray-100"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    (e.target as HTMLInputElement).blur();
                    setShowCalendar(true);
                  }
                }}
              />
              {step2Errors.name && (
                <p className="text-sm text-red-500">{t(step2Errors.name.message || '')}</p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="dateOfBirth">{t('auth.dateOfBirth')}</Label>
                <button
                  ref={calendarButtonRef}
                  type="button"
                  onClick={() => setShowCalendar(!showCalendar)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <Calendar className="w-4 h-4" />
                </button>
              </div>
              <Input
                ref={dateInputRef}
                id="dateOfBirth"
                type="text"
                value={dateDisplayValue}
                readOnly
                inputMode="none"
                onFocus={(e) => { e.target.blur(); setShowCalendar(true); }}
                onClick={() => setShowCalendar(true)}
                placeholder="YYYY / MM / DD"
                className={`bg-gray-100 text-center cursor-pointer select-none ${step2Errors.dateOfBirth ? 'border-red-500' : ''}`}
                style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
              />
              {step2Errors.dateOfBirth && (
                <p className="text-sm text-red-500">{t(step2Errors.dateOfBirth.message || '')}</p>
              )}
            </div>

            {showCalendar && (
              <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center px-4" onClick={() => setShowCalendar(false)}>
                <div className="bg-white rounded-2xl w-full max-w-sm p-4 animate-modal-pop" onClick={(e) => e.stopPropagation()}>
                  <ScrollYearMonthPicker
                    selectedYear={step2DateOfBirth ? parseInt(step2DateOfBirth.split('-')[0]) : 2000}
                    selectedMonth={step2DateOfBirth ? parseInt(step2DateOfBirth.split('-')[1]) : 1}
                    selectedDay={step2DateOfBirth ? parseInt(step2DateOfBirth.split('-')[2]) : 1}
                    onSelect={() => {}}
                    onSelectDay={(year: number, month: number, day: number) => {
                      const m = String(month).padStart(2, '0');
                      const d = String(day).padStart(2, '0');
                      step2Form.setValue('dateOfBirth', `${year}-${m}-${d}`, { shouldValidate: true });
                      setDateDisplayValue(`${year} / ${m} / ${d}`);
                      setShowCalendar(false);
                    }}
                    onClose={() => setShowCalendar(false)}
                    mode="year-month-day"
                  />
                </div>
              </div>
            )}

            <Button
              type="submit"
              className="w-full bg-[#4A2C1A] hover:bg-[#3A2010] text-white"
              disabled={!isStep2Valid}
            >
              {t('common.next')}
            </Button>
          </form>
        )}

        {step === 3 && (
          <form onSubmit={step3Form.handleSubmit(onStep3Submit)} className="space-y-4">
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={handleAgreeAll}
                className="w-full flex items-center gap-3 px-4 py-4 bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <div
                  className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                    agreeAll ? 'bg-[#4A2C1A] border-[#4A2C1A]' : 'border-gray-300'
                  }`}
                >
                  {agreeAll && <CheckCircle2 className="w-4 h-4 text-white" />}
                </div>
                <span className="text-base font-semibold text-gray-900">{t('auth.agreeAll')}</span>
              </button>

              <div className="divide-y divide-gray-100">
                {(['service', 'payment', 'refund'] as const).map((type) => {
                  const key = `terms${type.charAt(0).toUpperCase() + type.slice(1)}` as keyof Step3FormData;
                  const label = t(`auth.terms${type.charAt(0).toUpperCase() + type.slice(1)}` as any);
                  const checked = step3Form.watch(key);

                  return (
                    <label
                      key={type}
                      className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={!!checked}
                        onChange={(e) => step3Form.setValue(key, e.target.checked)}
                        className="sr-only"
                      />
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                          checked ? 'bg-[#4A2C1A] border-[#4A2C1A]' : 'border-gray-300'
                        }`}
                      >
                        {checked && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                      </div>
                      <div className="flex-1 flex items-center justify-between">
                        <span className="text-sm text-gray-700">
                          {t('auth.required')} {label}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            setShowTermsModal(type);
                          }}
                          className="text-xs text-gray-400 hover:text-gray-600"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            <Button
              type="submit"
              className="w-full bg-[#4A2C1A] hover:bg-[#3A2010] text-white"
              disabled={!isStep3Valid || signupMutation.isPending}
            >
              {signupMutation.isPending ? t('auth.signingUp') : t('auth.signupAction')}
            </Button>
          </form>
        )}
      </div>

      {showPhoneVerificationModal && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center animate-overlay-fade px-4"
          onClick={() => setShowPhoneVerificationModal(false)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4 animate-modal-pop"
            onClick={(e) => e.stopPropagation()}
            style={{
              transform: verifyKbHeight > 0 ? `translateY(-${verifyKbHeight / 2}px)` : 'none',
              transition: 'transform 0.2s ease-out',
            }}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{t('auth.verificationCode')}</h2>
              <button
                onClick={() => setShowPhoneVerificationModal(false)}
                className="p-2 rounded-full hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-2">
              <Label htmlFor="verificationCode">{t('auth.verificationCode')}</Label>
              <Input
                id="verificationCode"
                type="text"
                value={phoneVerificationInput}
                onChange={(e) => {
                  setPhoneVerificationInput(e.target.value.replace(/\D/g, '').slice(0, 6));
                  setPhoneVerificationError(null);
                }}
                placeholder={t('auth.enterVerificationCode')}
                maxLength={6}
                className={`text-center text-lg tracking-widest ${phoneVerificationError ? 'border-red-500' : ''}`}
              />
              {phoneVerificationError && (
                <p className="text-sm text-red-500">{phoneVerificationError}</p>
              )}
            </div>
            <Button
              onClick={handleConfirmPhoneVerification}
              className="w-full bg-[#4A2C1A] hover:bg-[#3A2010] text-white"
              disabled={
                phoneVerificationInput.length !== 6 || confirmPhoneVerification.isPending
              }
            >
              {confirmPhoneVerification.isPending ? t('auth.verifying') : t('common.confirm')}
            </Button>
          </div>
        </div>
      )}

      {showEmailVerificationModal && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center animate-overlay-fade px-4"
          onClick={() => setShowEmailVerificationModal(false)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4 animate-modal-pop"
            onClick={(e) => e.stopPropagation()}
            style={{
              transform: verifyKbHeight > 0 ? `translateY(-${verifyKbHeight / 2}px)` : 'none',
              transition: 'transform 0.2s ease-out',
            }}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{t('auth.verificationCode')}</h2>
              <button
                onClick={() => setShowEmailVerificationModal(false)}
                className="p-2 rounded-full hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-gray-500">{t('auth.emailVerificationSent')}</p>
            <div className="space-y-2">
              <Label>{t('auth.verificationCode')}</Label>
              <Input
                type="text"
                value={emailVerificationInput}
                onChange={(e) => {
                  setEmailVerificationInput(e.target.value.replace(/\D/g, '').slice(0, 6));
                  setEmailVerificationError(null);
                }}
                placeholder={t('auth.enterVerificationCode')}
                maxLength={6}
                className={`text-center text-lg tracking-widest ${emailVerificationError ? 'border-red-500' : ''}`}
              />
              {emailVerificationError && (
                <p className="text-sm text-red-500">{emailVerificationError}</p>
              )}
            </div>
            <Button
              onClick={handleConfirmEmailVerification}
              className="w-full bg-[#4A2C1A] hover:bg-[#3A2010] text-white"
              disabled={
                emailVerificationInput.length !== 6 || confirmEmailVerification.isPending
              }
            >
              {confirmEmailVerification.isPending ? t('auth.verifying') : t('common.confirm')}
            </Button>
          </div>
        </div>
      )}

      {showTermsModal && (
        <TermsModal type={showTermsModal} onClose={() => setShowTermsModal(false)} />
      )}
    </div>
  );
}

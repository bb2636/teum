import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSignup } from '@/hooks/useAuth';
import { useNicknameCheck } from '@/hooks/useNicknameCheck';
import { useCheckEmailExists } from '@/hooks/useEmailVerification';
import { useRequestPhoneVerification, useConfirmPhoneVerification } from '@/hooks/usePhoneVerification';
import { ChevronLeft, Eye, EyeOff, X, Calendar, ChevronRight, CheckCircle2 } from 'lucide-react';
import { TermsModal } from '@/pages/my/TermsModal';
import { ScrollYearMonthPicker } from '@/components/ScrollYearMonthPicker';

const nicknameSchema = z
  .string()
  .min(2, '닉네임은 2~12자로 입력해 주세요.')
  .max(12, '닉네임은 2~12자로 입력해 주세요.')
  .refine((val) => !val.includes(' '), '닉네임에 공백은 사용할 수 없습니다.')
  .refine((val) => /^[a-zA-Z0-9가-힣_]+$/.test(val), '사용할 수 없는 문자가 포함되어 있습니다.');

const passwordSchema = z
  .string()
  .min(8, '비밀번호는 8자 이상, 영문/숫자를 포함해 주세요.')
  .refine((val) => /[a-zA-Z]/.test(val), '비밀번호는 8자 이상, 영문/숫자를 포함해 주세요.')
  .refine((val) => /[0-9]/.test(val), '비밀번호는 8자 이상, 영문/숫자를 포함해 주세요.');

const step1Schema = z.object({
  email: z.string().email('올바른 이메일을 입력해주세요'),
  password: passwordSchema,
  confirmPassword: z.string(),
  phone: z.string().min(10, '전화번호를 입력해주세요').max(15),
});

const step2Schema = z.object({
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
      if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return false;
      return true;
    }, '생년월일을 정확하게 입력해주세요.')
    .optional(),
});

const step3Schema = z.object({
  termsService: z.boolean().refine((val) => val === true, '서비스 이용약관에 동의해주세요'),
  termsPayment: z.boolean().refine((val) => val === true, '정기 결제 및 자동 갱신에 동의해주세요'),
  termsRefund: z.boolean().refine((val) => val === true, '환불/해지 정책을 확인해주세요'),
});

type Step1FormData = z.infer<typeof step1Schema>;
type Step2FormData = z.infer<typeof step2Schema>;
type Step3FormData = z.infer<typeof step3Schema>;

export function SignupPage() {
  const navigate = useNavigate();
  const signupMutation = useSignup();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [error, setError] = useState<string | null>(null);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [showPhoneVerificationModal, setShowPhoneVerificationModal] = useState(false);
  const [phoneVerificationCode, setPhoneVerificationCode] = useState<string | null>(null);
  const [phoneVerificationInput, setPhoneVerificationInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [nicknameError, setNicknameError] = useState<string[]>([]);
  const [formData, setFormData] = useState<{
    step1?: Step1FormData;
    step2?: Step2FormData;
    step3?: Step3FormData;
  }>({});

  const checkEmailExists = useCheckEmailExists();
  const requestPhoneVerification = useRequestPhoneVerification();
  const confirmPhoneVerification = useConfirmPhoneVerification();
  const [showTermsModal, setShowTermsModal] = useState<false | 'service' | 'payment' | 'refund'>(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const calendarButtonRef = useRef<HTMLButtonElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const [dateDisplayValue, setDateDisplayValue] = useState('');

  const step1Form = useForm<Step1FormData>({
    resolver: zodResolver(step1Schema),
    mode: 'onChange',
  });

  const step2Form = useForm<Step2FormData>({
    resolver: zodResolver(step2Schema),
    mode: 'onChange',
  });

  const step3Form = useForm<Step3FormData>({
    resolver: zodResolver(step3Schema),
    mode: 'onChange',
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
  const step3TermsService = step3Form.watch('termsService');
  const step3TermsPayment = step3Form.watch('termsPayment');
  const step3TermsRefund = step3Form.watch('termsRefund');

  const agreeAll = step3TermsService && step3TermsPayment && step3TermsRefund;

  const handleAgreeAll = () => {
    step3Form.setValue('termsService', !agreeAll);
    step3Form.setValue('termsPayment', !agreeAll);
    step3Form.setValue('termsRefund', !agreeAll);
  };

  const shouldCheckNickname = step2Nickname && step2Nickname.length >= 2 && step2Nickname.length <= 12 && !step2Nickname.includes(' ') && /^[a-zA-Z0-9가-힣_]+$/.test(step2Nickname);
  const nicknameCheck = useNicknameCheck(step2Nickname || '', shouldCheckNickname || false);

  const step1Errors = step1Form.formState.errors;
  const isStep1Valid =
    step1Email &&
    step1Password &&
    step1ConfirmPassword &&
    step1Phone &&
    !step1Errors.email &&
    !step1Errors.password &&
    step1Password === step1ConfirmPassword &&
    phoneVerified;

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
    !step2Errors.nickname &&
    !step2Errors.name &&
    !step2Errors.dateOfBirth &&
    nicknameError.length === 0 &&
    isValidDateOfBirth(step2DateOfBirth);

  const isStep3Valid = step3TermsService === true && step3TermsPayment === true && step3TermsRefund === true;

  useEffect(() => {
    if (step2Nickname && step2Nickname.length > 0) {
      const errors: string[] = [];
      if (step2Nickname.length < 2 || step2Nickname.length > 12) {
        errors.push('닉네임은 2~12자로 입력해 주세요.');
      }
      if (step2Nickname.includes(' ')) {
        errors.push('닉네임에 공백은 사용할 수 없습니다.');
      }
      if (!/^[a-zA-Z0-9가-힣_]+$/.test(step2Nickname)) {
        errors.push('사용할 수 없는 문자가 포함되어 있습니다.');
      }
      if (shouldCheckNickname && nicknameCheck.data && !nicknameCheck.data.available) {
        if (nicknameCheck.data.reason === 'duplicate') {
          errors.push('이미 사용 중인 닉네임입니다.');
        }
      }
      setNicknameError(errors);
      step2Form.trigger('nickname');
    } else {
      setNicknameError([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step2Nickname, nicknameCheck.data, shouldCheckNickname]);

  const handleRequestPhoneVerification = async () => {
    const phone = step1Form.getValues('phone');
    if (!phone || phone.length < 10) {
      setError('전화번호를 정확히 입력해주세요');
      return;
    }

    setError(null);

    try {
      const checkResult = await checkEmailExists.mutateAsync(step1Email);
      if (checkResult.exists) {
        setError('이미 존재하는 이메일입니다. 다른 이메일을 입력해주세요.');
        return;
      }
    } catch (err) {
      console.error('Email check error:', err);
    }

    try {
      const result = await requestPhoneVerification.mutateAsync(phone);
      setShowPhoneVerificationModal(true);
      if (result.code) {
        setPhoneVerificationCode(result.code);
        console.log('SMS 인증번호:', result.code);
      }
    } catch (err) {
      const error = err as Error;
      setError(error.message || '인증번호 발송에 실패했습니다');
    }
  };

  const handleConfirmPhoneVerification = async () => {
    const phone = step1Form.getValues('phone');
    if (!phone || !phoneVerificationInput) {
      setError('인증번호를 입력해주세요');
      return;
    }

    if (phoneVerificationInput.length !== 6) {
      setError('인증번호는 6자리입니다');
      return;
    }

    setError(null);

    try {
      await confirmPhoneVerification.mutateAsync({
        phone,
        code: phoneVerificationInput,
      });
      setPhoneVerified(true);
      setShowPhoneVerificationModal(false);
      setPhoneVerificationInput('');
    } catch (err) {
      const error = err as Error;
      setError(error.message || '인증번호가 올바르지 않습니다');
    }
  };

  const onStep1Submit = async (data: Step1FormData) => {
    if (!phoneVerified) {
      setError('전화번호 인증을 완료해주세요');
      return;
    }

    if (data.password !== data.confirmPassword) {
      setError('비밀번호가 일치하지 않습니다');
      return;
    }

    setFormData((prev) => ({ ...prev, step1: data }));
    setStep(2);
    setError(null);
  };

  const onStep2Submit = async (data: Step2FormData) => {
    if (nicknameError.length > 0) {
      setError('닉네임을 올바르게 입력해주세요');
      return;
    }

    setFormData((prev) => ({ ...prev, step2: data }));
    setStep(3);
    setError(null);
  };

  const onStep3Submit = async (data: Step3FormData) => {
    if (!formData.step1 || !formData.step2) {
      setError('이전 단계 정보가 없습니다');
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

  return (
    <div className="min-h-screen flex flex-col px-4 py-8 bg-white">
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
            <h1 className="text-2xl font-bold">회원가입</h1>
            <p className="text-sm text-muted-foreground">
              {step === 1 && '사용하실 계정 정보를 입력해주세요.'}
              {step === 2 && '회원 정보를 입력해주세요.'}
              {step === 3 && '약관에 동의해주세요.'}
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
              <Label htmlFor="email">이메일</Label>
              <Input
                id="email"
                type="email"
                {...step1Form.register('email')}
                placeholder="이메일을 입력해주세요"
                className={step1Errors.email ? 'border-red-500' : ''}
              />
              {step1Errors.email && (
                <p className="text-sm text-red-500">{step1Errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">비밀번호</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  {...step1Form.register('password')}
                  placeholder="비밀번호를 입력해주세요"
                  className={step1Errors.password ? 'border-red-500' : ''}
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
                <p className="text-sm text-red-500">{step1Errors.password.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">비밀번호 확인</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  {...step1Form.register('confirmPassword')}
                  placeholder="비밀번호를 입력해주세요"
                  className={
                    step1Password && step1ConfirmPassword !== step1Password
                      ? 'border-red-500'
                      : ''
                  }
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
              {step1Password && step1ConfirmPassword !== step1Password && (
                <p className="text-sm text-red-500">비밀번호가 일치하지 않습니다.</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">전화번호</Label>
              <div className="relative">
                <Input
                  id="phone"
                  type="tel"
                  {...step1Form.register('phone')}
                  placeholder="전화번호를 입력해주세요"
                  className={`pr-32 ${step1Errors.phone ? 'border-red-500' : ''}`}
                  disabled={phoneVerified}
                />
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleRequestPhoneVerification}
                  disabled={requestPhoneVerification.isPending || phoneVerified || !step1Phone || step1Phone.length < 10 || !step1Email || !!step1Errors.email}
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-8 px-3 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700"
                >
                  {phoneVerified ? '인증완료' : requestPhoneVerification.isPending ? '전송 중...' : '인증번호 보내기'}
                </Button>
              </div>
              {step1Errors.phone && (
                <p className="text-sm text-red-500">{step1Errors.phone.message}</p>
              )}
              {phoneVerified && (
                <p className="text-sm text-green-600">✓ 전화번호 인증이 완료되었습니다</p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full bg-[#665146] hover:bg-[#5A453A] text-white"
              disabled={!isStep1Valid}
            >
              다음
            </Button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={step2Form.handleSubmit(onStep2Submit)} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="nickname">닉네임</Label>
              <div className="relative">
                <Input
                  id="nickname"
                  type="text"
                  {...step2Form.register('nickname')}
                  placeholder="닉네임을 입력하세요"
                  className={`pr-10 bg-gray-100 ${
                    step2Errors.nickname || nicknameError.length > 0 ? 'border-red-500' : ''
                  }`}
                />
                {step2Nickname && 
                 nicknameError.length === 0 && 
                 !step2Errors.nickname && 
                 nicknameCheck.data?.available && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <CheckCircle2 className="w-5 h-5 text-[#665146]" />
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
                <p className="text-sm text-red-500">{step2Errors.nickname.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">이름</Label>
              <Input
                id="name"
                type="text"
                {...step2Form.register('name')}
                placeholder="이름을 입력하세요"
                className={`bg-gray-100 ${step2Errors.name ? 'border-red-500' : ''}`}
              />
              {step2Errors.name && (
                <p className="text-sm text-red-500">{step2Errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="dateOfBirth">생년월일</Label>
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
                onChange={(e) => {
                  let value = e.target.value.replace(/[^0-9/\s]/g, '');
                  setDateDisplayValue(value);
                  const cleaned = value.replace(/[\s/]/g, '');
                  if (cleaned.length === 8) {
                    const year = cleaned.substring(0, 4);
                    const month = cleaned.substring(4, 6);
                    const day = cleaned.substring(6, 8);
                    step2Form.setValue('dateOfBirth', `${year}-${month}-${day}`, { shouldValidate: true });
                  } else {
                    step2Form.setValue('dateOfBirth', '', { shouldValidate: true });
                  }
                }}
                placeholder="YYYY / MM / DD"
                className={`bg-gray-100 ${step2Errors.dateOfBirth ? 'border-red-500' : ''}`}
                maxLength={14}
              />
              {step2Errors.dateOfBirth && (
                <p className="text-sm text-red-500">{step2Errors.dateOfBirth.message}</p>
              )}
            </div>

            {showCalendar && (
              <div className="fixed inset-0 z-50 bg-black/50 flex items-end" onClick={() => setShowCalendar(false)}>
                <div className="bg-white rounded-t-2xl w-full p-4 animate-modal-sheet" onClick={(e) => e.stopPropagation()}>
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
              className="w-full bg-[#665146] hover:bg-[#5A453A] text-white"
              disabled={!isStep2Valid}
            >
              다음
            </Button>
          </form>
        )}

        {step === 3 && (
          <>
            <form onSubmit={step3Form.handleSubmit(onStep3Submit)} className="space-y-4">
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
                  <label className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors">
                    <input
                      type="checkbox"
                      checked={step3TermsService || false}
                      onChange={(e) => step3Form.setValue('termsService', e.target.checked)}
                      className="sr-only"
                    />
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${step3TermsService ? 'bg-[#665146] border-[#665146]' : 'border-gray-300'}`}>
                      {step3TermsService && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                    </div>
                    <div className="flex-1 flex items-center justify-between">
                      <span className="text-sm text-gray-700">(필수) 서비스 이용약관</span>
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); setShowTermsModal('service'); }}
                        className="text-xs text-gray-400 hover:text-gray-600"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors">
                    <input
                      type="checkbox"
                      checked={step3TermsPayment || false}
                      onChange={(e) => step3Form.setValue('termsPayment', e.target.checked)}
                      className="sr-only"
                    />
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${step3TermsPayment ? 'bg-[#665146] border-[#665146]' : 'border-gray-300'}`}>
                      {step3TermsPayment && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                    </div>
                    <div className="flex-1 flex items-center justify-between">
                      <span className="text-sm text-gray-700">(필수) 정기 결제 및 자동 갱신</span>
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); setShowTermsModal('payment'); }}
                        className="text-xs text-gray-400 hover:text-gray-600"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors">
                    <input
                      type="checkbox"
                      checked={step3TermsRefund || false}
                      onChange={(e) => step3Form.setValue('termsRefund', e.target.checked)}
                      className="sr-only"
                    />
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${step3TermsRefund ? 'bg-[#665146] border-[#665146]' : 'border-gray-300'}`}>
                      {step3TermsRefund && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                    </div>
                    <div className="flex-1 flex items-center justify-between">
                      <span className="text-sm text-gray-700">(필수) 환불/해지 정책</span>
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); setShowTermsModal('refund'); }}
                        className="text-xs text-gray-400 hover:text-gray-600"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </label>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full bg-[#665146] hover:bg-[#5A453A] text-white"
                disabled={!isStep3Valid || signupMutation.isPending}
              >
                {signupMutation.isPending ? '가입 중...' : '가입하기'}
              </Button>
            </form>
          </>
        )}

        <div className="text-center text-sm">
          <Link to="/login" className="text-primary hover:underline">
            이미 계정이 있으신가요? 로그인
          </Link>
        </div>
      </div>

      {showPhoneVerificationModal && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-end animate-overlay-fade"
          onClick={() => {
            if (phoneVerified) {
              setShowPhoneVerificationModal(false);
            }
          }}
        >
          <div
            className="bg-white rounded-t-2xl w-full max-w-md p-6 space-y-4 animate-modal-sheet"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">인증번호 입력</h2>
              <button
                onClick={() => {
                  setShowPhoneVerificationModal(false);
                }}
                className="p-2 rounded-full hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-2">
              <Label htmlFor="verificationCode">인증번호</Label>
              <Input
                id="verificationCode"
                type="text"
                value={phoneVerificationInput}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                  setPhoneVerificationInput(value);
                }}
                placeholder="인증번호 입력"
                maxLength={6}
                className="text-center text-lg tracking-widest"
                disabled={phoneVerified}
              />
              {phoneVerificationCode && (
                <p className="text-xs text-gray-500 text-center">
                  개발 모드: 인증번호는 콘솔에 표시되었습니다 ({phoneVerificationCode})
                </p>
              )}
            </div>
            <Button
              onClick={handleConfirmPhoneVerification}
              className="w-full bg-[#665146] hover:bg-[#5A453A] text-white"
              disabled={phoneVerificationInput.length !== 6 || phoneVerified || confirmPhoneVerification.isPending}
            >
              {confirmPhoneVerification.isPending ? '확인 중...' : '확인'}
            </Button>
          </div>
        </div>
      )}

      {showTermsModal && (
        <TermsModal
          type={showTermsModal}
          onClose={() => setShowTermsModal(false)}
        />
      )}

    </div>
  );
}

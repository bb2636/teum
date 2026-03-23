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
import { useCheckEmailExists, useRequestEmailVerification, useConfirmEmailVerification } from '@/hooks/useEmailVerification';
import { ChevronLeft, Eye, EyeOff, X, Calendar, ChevronRight, CheckCircle2 } from 'lucide-react';
import { TermsModal } from '@/pages/my/TermsModal';
import { ScrollYearMonthPicker } from '@/components/ScrollYearMonthPicker';

// 닉네임 유효성 검사: 2~12자, 공백 불가, 특수문자 제한
const nicknameSchema = z
  .string()
  .min(2, '닉네임은 2~12자로 입력해 주세요.')
  .max(12, '닉네임은 2~12자로 입력해 주세요.')
  .refine((val) => !val.includes(' '), '닉네임에 공백은 사용할 수 없습니다.')
  .refine((val) => /^[a-zA-Z0-9가-힣_]+$/.test(val), '사용할 수 없는 문자가 포함되어 있습니다.');

// 비밀번호 유효성 검사: 8자 이상, 영문/숫자 포함
const passwordSchema = z
  .string()
  .min(8, '비밀번호는 8자 이상, 영문/숫자를 포함해 주세요.')
  .refine((val) => /[a-zA-Z]/.test(val), '비밀번호는 8자 이상, 영문/숫자를 포함해 주세요.')
  .refine((val) => /[0-9]/.test(val), '비밀번호는 8자 이상, 영문/숫자를 포함해 주세요.');

// Step 1: Account info schema
const step1Schema = z.object({
  email: z.string().email('올바른 이메일을 입력해주세요'),
  password: passwordSchema,
  confirmPassword: z.string(),
});

// Step 2: Profile info schema
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
      
      // 년도 검증 (1900 ~ 현재년도)
      const currentYear = new Date().getFullYear();
      if (isNaN(year) || year < 1900 || year > currentYear) {
        return false;
      }
      
      // 월 검증 (1 ~ 12)
      if (isNaN(month) || month < 1 || month > 12) {
        return false;
      }
      
      // 일 검증 (1 ~ 31, 실제로는 월에 따라 다르지만 기본 검증)
      if (isNaN(day) || day < 1 || day > 31) {
        return false;
      }
      
      // 실제 날짜 유효성 검증 (예: 2월 30일 같은 경우)
      const date = new Date(year, month - 1, day);
      if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
        return false;
      }
      
      return true;
    }, '생년월일을 정확하게 입력해주세요.')
    .optional(),
});

// Step 3: Terms schema
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
  const [emailVerified, setEmailVerified] = useState(false);
  const [showEmailVerificationModal, setShowEmailVerificationModal] = useState(false);
  const [emailVerificationCode, setEmailVerificationCode] = useState<string | null>(null);
  const [emailVerificationInput, setEmailVerificationInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [nicknameError, setNicknameError] = useState<string[]>([]);
  const [formData, setFormData] = useState<{
    step1?: Step1FormData;
    step2?: Step2FormData;
    step3?: Step3FormData;
  }>({});

  const checkEmailExists = useCheckEmailExists();
  const requestEmailVerification = useRequestEmailVerification();
  const confirmEmailVerification = useConfirmEmailVerification();
  const [showTermsModal, setShowTermsModal] = useState<false | 'service' | 'payment' | 'refund'>(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const calendarButtonRef = useRef<HTMLButtonElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const [dateDisplayValue, setDateDisplayValue] = useState('');

  // Step 1 form
  const step1Form = useForm<Step1FormData>({
    resolver: zodResolver(step1Schema),
    mode: 'onChange',
  });

  // Step 2 form
  const step2Form = useForm<Step2FormData>({
    resolver: zodResolver(step2Schema),
    mode: 'onChange',
  });

  // Step 3 form
  const step3Form = useForm<Step3FormData>({
    resolver: zodResolver(step3Schema),
    mode: 'onChange',
  });

  const step1Email = step1Form.watch('email');
  const step1Password = step1Form.watch('password');
  const step1ConfirmPassword = step1Form.watch('confirmPassword');
  const step2Nickname = step2Form.watch('nickname');
  const step2Name = step2Form.watch('name');
  const step2DateOfBirth = step2Form.watch('dateOfBirth');

  // 생년월일 표시값 동기화 (달력에서 선택한 경우에만)
  useEffect(() => {
    // onChange 핸들러에서 직접 업데이트하는 경우는 제외
    // 달력에서 날짜를 선택한 경우에만 동기화
    if (step2DateOfBirth && step2DateOfBirth.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const [year, month, day] = step2DateOfBirth.split('-');
      setDateDisplayValue(`${year} / ${month} / ${day}`);
    }
  }, [step2DateOfBirth]);
  const step3TermsService = step3Form.watch('termsService');
  const step3TermsPayment = step3Form.watch('termsPayment');
  const step3TermsRefund = step3Form.watch('termsRefund');
  
  // 전체 동의 상태
  const agreeAll = step3TermsService && step3TermsPayment && step3TermsRefund;
  
  // 전체 동의 핸들러
  const handleAgreeAll = () => {
    step3Form.setValue('termsService', !agreeAll);
    step3Form.setValue('termsPayment', !agreeAll);
    step3Form.setValue('termsRefund', !agreeAll);
  };

  // Check nickname availability
  const shouldCheckNickname = step2Nickname && step2Nickname.length >= 2 && step2Nickname.length <= 12 && !step2Nickname.includes(' ') && /^[a-zA-Z0-9가-힣_]+$/.test(step2Nickname);
  const nicknameCheck = useNicknameCheck(step2Nickname || '', shouldCheckNickname || false);

  // Step 1 validation
  const step1Errors = step1Form.formState.errors;
  const isStep1Valid =
    step1Email &&
    step1Password &&
    step1ConfirmPassword &&
    !step1Errors.email &&
    !step1Errors.password &&
    step1Password === step1ConfirmPassword &&
    emailVerified;

  // Step 2 validation
  const step2Errors = step2Form.formState.errors;
  
  // 생년월일 형식 검증 함수
  const isValidDateOfBirth = (dateStr: string | undefined): boolean => {
    if (!dateStr) return false;
    const parts = dateStr.split('-');
    if (parts.length !== 3) return false;
    
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const day = parseInt(parts[2], 10);
    
    // 년도 검증 (1900 ~ 현재년도)
    const currentYear = new Date().getFullYear();
    if (isNaN(year) || year < 1900 || year > currentYear) {
      return false;
    }
    
    // 월 검증 (1 ~ 12)
    if (isNaN(month) || month < 1 || month > 12) {
      return false;
    }
    
    // 일 검증 (1 ~ 31)
    if (isNaN(day) || day < 1 || day > 31) {
      return false;
    }
    
    // 실제 날짜 유효성 검증 (예: 2월 30일 같은 경우)
    const date = new Date(year, month - 1, day);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
      return false;
    }
    
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

  // Step 3 validation
  const step3Errors = step3Form.formState.errors;
  const isStep3Valid = step3TermsService === true && step3TermsPayment === true && step3TermsRefund === true;

  // 닉네임 실시간 유효성 검사
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
      
      // Server-side duplicate check
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

  // Handle email verification request
  const handleRequestEmailVerification = async () => {
    if (!step1Email) {
      setError('이메일을 입력해주세요');
      return;
    }

    const isValid = await step1Form.trigger('email');
    if (!isValid) {
      return;
    }

    setError(null);

    // Check if email exists
    try {
      const checkResult = await checkEmailExists.mutateAsync(step1Email);
      if (checkResult.exists) {
        setError('이미 존재하는 이메일입니다. 다른 이메일을 입력해주세요.');
        return;
      }
    } catch (err) {
      console.error('Email check error:', err);
    }

    // Request verification code
    try {
      const result = await requestEmailVerification.mutateAsync(step1Email);
      setShowEmailVerificationModal(true);
      if (result.code) {
        setEmailVerificationCode(result.code);
        console.log('이메일 인증번호:', result.code);
      }
    } catch (err) {
      const error = err as Error & { response?: { data?: { error?: { message?: string } } } };
      const message = error.response?.data?.error?.message || error.message || '인증번호 발송에 실패했습니다';
      setError(message);
    }
  };

  // Handle email verification confirm
  const handleConfirmEmailVerification = async () => {
    if (!step1Email || !emailVerificationInput) {
      setError('인증번호를 입력해주세요');
      return;
    }

    if (emailVerificationInput.length !== 6) {
      setError('인증번호는 6자리입니다');
      return;
    }

    setError(null);

    try {
      await confirmEmailVerification.mutateAsync({
        email: step1Email,
        code: emailVerificationInput,
      });
      setEmailVerified(true);
      setShowEmailVerificationModal(false);
      setEmailVerificationInput('');
    } catch (err) {
      const error = err as Error;
      setError(error.message || '인증번호가 올바르지 않습니다');
    }
  };

  // Step 1 submit
  const onStep1Submit = async (data: Step1FormData) => {
    if (!emailVerified) {
      setError('이메일 인증을 완료해주세요');
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

  // Step 2 submit
  const onStep2Submit = async (data: Step2FormData) => {
    if (nicknameError.length > 0) {
      setError('닉네임을 올바르게 입력해주세요');
      return;
    }

    setFormData((prev) => ({ ...prev, step2: data }));
    setStep(3);
    setError(null);
  };

  // Step 3 submit (final signup)
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
        {/* Header */}
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

        {/* Step 1: Account Info */}
        {step === 1 && (
          <form onSubmit={step1Form.handleSubmit(onStep1Submit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">이메일</Label>
              <div className="relative">
                <Input
                  id="email"
                  type="email"
                  {...step1Form.register('email')}
                  placeholder="이메일을 입력해주세요"
                  className={`pr-32 ${step1Errors.email ? 'border-red-500' : ''}`}
                  disabled={emailVerified}
                />
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleRequestEmailVerification}
                  disabled={requestEmailVerification.isPending || emailVerified}
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-8 px-3 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700"
                >
                  {emailVerified ? '인증완료' : '인증번호 보내기'}
                </Button>
              </div>
              {step1Errors.email && (
                <p className="text-sm text-red-500">{step1Errors.email.message}</p>
              )}
              {emailVerified && (
                <p className="text-sm text-green-600">✓ 이메일 인증이 완료되었습니다</p>
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

            <Button
              type="submit"
              className="w-full bg-[#665146] hover:bg-[#5A453A] text-white"
              disabled={!isStep1Valid}
            >
              다음
            </Button>
          </form>
        )}

        {/* Step 2: Profile Info */}
        {step === 2 && (
          <form onSubmit={step2Form.handleSubmit(onStep2Submit)} className="space-y-6">
            {/* 닉네임 */}
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

            {/* 이름 */}
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

            {/* 생년월일 */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="dateOfBirth">생년월일</Label>
                <button
                  ref={calendarButtonRef}
                  type="button"
                  onClick={() => setShowCalendar(!showCalendar)}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <Calendar className="w-4 h-4 text-[#4A2C1A]" />
                </button>
              </div>
              
              {showCalendar && (() => {
                const isValidDate = step2DateOfBirth && /^\d{4}-\d{2}-\d{2}$/.test(step2DateOfBirth);
                const selectedDate = isValidDate ? new Date(step2DateOfBirth) : new Date();
                return (
                  <ScrollYearMonthPicker
                    selectedYear={selectedDate.getFullYear()}
                    selectedMonth={selectedDate.getMonth() + 1}
                    selectedDay={isValidDate ? selectedDate.getDate() : undefined}
                    onSelect={() => {}}
                    onClose={() => setShowCalendar(false)}
                    mode="year-month-day"
                    onSelectDay={(year, month, day) => {
                      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                      step2Form.setValue('dateOfBirth', dateStr);
                      step2Form.trigger('dateOfBirth');
                    }}
                    onDelete={() => {
                      step2Form.setValue('dateOfBirth', undefined);
                    }}
                  />
                );
              })()}
              
              <Input
                ref={dateInputRef}
                id="dateOfBirth"
                type="text"
                placeholder="2000 / 00 / 00"
                value={dateDisplayValue}
                onChange={(e) => {
                  const input = e.target;
                  const oldValue = dateDisplayValue;
                  const newValue = e.target.value;
                  const cursorPosition = input.selectionStart || 0;
                  
                  // 이전 숫자 개수 계산
                  const oldNumbers = oldValue.replace(/[^\d]/g, '');
                  // 새 숫자만 추출
                  const newNumbers = newValue.replace(/[^\d]/g, '');
                  
                  // 숫자가 변경되지 않았으면 포맷팅만 수행
                  if (oldNumbers === newNumbers && newValue !== oldValue) {
                    // 포맷팅만 변경된 경우 (슬래시 추가/제거 등)
                    return;
                  }
                  
                  // 한 번에 하나의 숫자만 추가되도록 제한
                  const numbersDiff = newNumbers.length - oldNumbers.length;
                  if (numbersDiff > 1) {
                    // 여러 숫자가 한 번에 입력된 경우, 마지막 숫자만 허용
                    const lastNumber = newNumbers.slice(-1);
                    const limitedNumbers = oldNumbers + lastNumber;
                    
                    // 제한된 숫자로 다시 처리
                    const year = limitedNumbers.slice(0, 4);
                    const month = limitedNumbers.slice(4, 6);
                    const day = limitedNumbers.slice(6, 8);
                    
                    let displayValue = '';
                    if (year.length > 0) {
                      displayValue = year;
                      if (month.length > 0) {
                        displayValue += ` / ${month}`;
                        if (day.length > 0) {
                          displayValue += ` / ${day}`;
                        }
                      } else if (year.length === 4) {
                        // 년도 4자리 입력 후 자동으로 " / " 추가
                        displayValue = year + ' / ';
                      }
                    }
                    
                    setDateDisplayValue(displayValue);
                    
                    // 폼에 저장할 값 업데이트
                    if (year.length === 4 && month.length === 2 && day.length === 2) {
                      const dateValue = `${year}-${month}-${day}`;
                      step2Form.setValue('dateOfBirth', dateValue);
                      // 완전한 날짜가 입력되었을 때 유효성 검사 트리거
                      step2Form.trigger('dateOfBirth');
                    } else if (year.length === 4 && month.length === 2) {
                      step2Form.setValue('dateOfBirth', `${year}-${month}-`);
                    } else if (year.length === 4) {
                      step2Form.setValue('dateOfBirth', `${year}--`);
                    } else if (year.length > 0) {
                      step2Form.setValue('dateOfBirth', `${year}-`);
                    } else {
                      step2Form.setValue('dateOfBirth', undefined);
                    }
                    
                    // 커서 위치 조정
                    requestAnimationFrame(() => {
                      if (!dateInputRef.current) return;
                      let newPos = 0;
                      if (limitedNumbers.length <= 4) {
                        newPos = limitedNumbers.length;
                        if (limitedNumbers.length === 4) {
                          newPos = 7; // "2000 / " = 7자리
                        }
                      } else if (limitedNumbers.length <= 6) {
                        newPos = limitedNumbers.length + 3;
                        if (limitedNumbers.length === 6) {
                          newPos = 10; // "2000 / 12 / " = 10자리
                        }
                      } else {
                        newPos = limitedNumbers.length + 6;
                      }
                      newPos = Math.min(newPos, displayValue.length);
                      dateInputRef.current.setSelectionRange(newPos, newPos);
                    });
                    
                    return;
                  }
                  
                  // 년(4자리), 월(2자리), 일(2자리)로 분리
                  const year = newNumbers.slice(0, 4);
                  const month = newNumbers.slice(4, 6);
                  const day = newNumbers.slice(6, 8);
                  
                  // 표시값 생성 - 실제 입력된 값만 표시
                  let displayValue = '';
                  if (year.length > 0) {
                    displayValue = year;
                    // 월 부분은 실제로 입력된 경우에만 추가
                    if (month.length > 0) {
                      displayValue += ` / ${month}`;
                      // 일 부분은 실제로 입력된 경우에만 추가
                      if (day.length > 0) {
                        displayValue += ` / ${day}`;
                      }
                    } else if (year.length === 4) {
                      // 년도 4자리 입력 후 자동으로 " / " 추가
                      displayValue = year + ' / ';
                    }
                  }
                  
                  setDateDisplayValue(displayValue);
                  
                  // 폼에 저장할 값 (ISO 형식: YYYY-MM-DD)
                  if (year.length === 4 && month.length === 2 && day.length === 2) {
                    const dateValue = `${year}-${month}-${day}`;
                    step2Form.setValue('dateOfBirth', dateValue);
                    // 완전한 날짜가 입력되었을 때 유효성 검사 트리거
                    step2Form.trigger('dateOfBirth');
                  } else if (year.length === 4 && month.length === 2) {
                    step2Form.setValue('dateOfBirth', `${year}-${month}-`);
                  } else if (year.length === 4) {
                    step2Form.setValue('dateOfBirth', `${year}--`);
                  } else if (year.length > 0) {
                    step2Form.setValue('dateOfBirth', `${year}-`);
                  } else {
                    step2Form.setValue('dateOfBirth', undefined);
                  }
                  
                  // 커서 위치 계산 및 복원
                  requestAnimationFrame(() => {
                    if (!dateInputRef.current) return;
                    
                    // 숫자 입력 위치에 따라 커서 위치 조정
                    let newCursorPos = cursorPosition;
                    const oldNumbersCount = oldNumbers.length;
                    const newNumbersCount = newNumbers.length;
                    
                    // 숫자가 추가된 경우
                    if (newNumbersCount > oldNumbersCount) {
                      // 년도 입력 중
                      if (newNumbersCount <= 4) {
                        newCursorPos = newNumbersCount;
                        // 년도 4자리 입력 완료 시 " / " 뒤로 커서 이동
                        if (newNumbersCount === 4) {
                          newCursorPos = 7; // "2000 / " = 7자리
                        }
                      }
                      // 월 입력 중
                      else if (newNumbersCount <= 6) {
                        newCursorPos = newNumbersCount + 3; // "YYYY / " = 7자리, 그 다음 숫자 위치
                        // 월 2자리 입력 완료 시 " / " 뒤로 커서 이동
                        if (newNumbersCount === 6) {
                          newCursorPos = 10; // "2000 / 12 / " = 10자리
                        }
                      }
                      // 일 입력 중
                      else {
                        newCursorPos = newNumbersCount + 6; // "YYYY / MM / " = 10자리, 그 다음 숫자 위치
                      }
                    }
                    // 숫자가 삭제된 경우
                    else if (newNumbersCount < oldNumbersCount) {
                      // 년도 삭제 중
                      if (newNumbersCount <= 4) {
                        newCursorPos = newNumbersCount;
                      }
                      // 월 삭제 중
                      else if (newNumbersCount <= 6) {
                        newCursorPos = newNumbersCount + 3;
                      }
                      // 일 삭제 중
                      else {
                        newCursorPos = newNumbersCount + 6;
                      }
                    }
                    
                    newCursorPos = Math.min(newCursorPos, displayValue.length);
                    dateInputRef.current.setSelectionRange(newCursorPos, newCursorPos);
                  });
                }}
                onKeyDown={(e) => {
                  // 백스페이스 처리: 슬래시나 공백을 건너뛰기
                  if (e.key === 'Backspace' && dateInputRef.current) {
                    const input = dateInputRef.current;
                    const cursorPos = input.selectionStart || 0;
                    const value = input.value;
                    
                    // 커서가 슬래시나 공백 바로 뒤에 있으면 한 칸 더 뒤로
                    if (cursorPos > 0 && (value[cursorPos - 1] === '/' || value[cursorPos - 1] === ' ')) {
                      e.preventDefault();
                      const numbers = value.replace(/[^\d]/g, '');
                      const newNumbers = numbers.slice(0, Math.max(0, numbers.length - 1));
                      
                      const year = newNumbers.slice(0, 4);
                      const month = newNumbers.slice(4, 6);
                      const day = newNumbers.slice(6, 8);
                      
                      let displayValue = '';
                      if (year.length > 0) {
                        displayValue = year;
                        // 월 부분은 실제로 입력된 경우에만 추가
                        if (month.length > 0) {
                          displayValue += ` / ${month}`;
                          // 일 부분은 실제로 입력된 경우에만 추가
                          if (day.length > 0) {
                            displayValue += ` / ${day}`;
                          }
                        }
                      }
                      
                      setDateDisplayValue(displayValue);
                      
                      if (year.length === 4 && month.length === 2 && day.length === 2) {
                        const dateValue = `${year}-${month}-${day}`;
                        step2Form.setValue('dateOfBirth', dateValue);
                        // 완전한 날짜가 입력되었을 때 유효성 검사 트리거
                        step2Form.trigger('dateOfBirth');
                      } else if (year.length === 4 && month.length === 2) {
                        step2Form.setValue('dateOfBirth', `${year}-${month}-`);
                      } else if (year.length === 4) {
                        step2Form.setValue('dateOfBirth', `${year}--`);
                      } else if (year.length > 0) {
                        step2Form.setValue('dateOfBirth', `${year}-`);
                      } else {
                        step2Form.setValue('dateOfBirth', undefined);
                      }
                      
                      requestAnimationFrame(() => {
                        if (!dateInputRef.current) return;
                        let newPos = 0;
                        if (newNumbers.length <= 4) {
                          newPos = newNumbers.length;
                        } else if (newNumbers.length <= 6) {
                          newPos = newNumbers.length + 3;
                        } else {
                          newPos = newNumbers.length + 6;
                        }
                        newPos = Math.max(0, Math.min(newPos, displayValue.length));
                        dateInputRef.current.setSelectionRange(newPos, newPos);
                      });
                    }
                  }
                }}
                className={`bg-gray-100 text-center ${step2Errors.dateOfBirth ? 'border-red-500' : ''}`}
              />
              {step2Errors.dateOfBirth && (
                <p className="text-sm text-red-500">{step2Errors.dateOfBirth.message}</p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full bg-[#665146] hover:bg-[#5A453A] text-white"
              disabled={!isStep2Valid}
            >
              다음
            </Button>
          </form>
        )}

        {/* Step 3: Terms */}
        {step === 3 && (
          <>
            {/* 약관 동의 모달 */}
            <div className="fixed inset-0 z-50 bg-black/50 flex items-end animate-overlay-fade">
              <div className="bg-white rounded-t-2xl w-full max-w-md mx-auto p-6 space-y-4 max-h-[80vh] overflow-y-auto animate-modal-sheet">
                <h2 className="text-lg font-semibold text-center">이용약관에 동의해주세요</h2>
                
                {/* 전체 동의 */}
                <div className="bg-gray-100 rounded-lg p-4">
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={agreeAll}
                      onChange={handleAgreeAll}
                      className="w-5 h-5 rounded border-gray-300 accent-[#665146] focus:ring-[#665146]"
                      style={{ 
                        accentColor: '#665146',
                        backgroundColor: agreeAll ? '#665146' : 'white',
                        borderColor: agreeAll ? '#665146' : '#d1d5db'
                      }}
                    />
                    <span className="text-sm font-medium">전체 동의</span>
                  </label>
                </div>
                
                {/* 개별 약관 */}
                <div className="space-y-1">
                  {/* 서비스 이용약관 */}
                  <label className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 cursor-pointer">
                    <div className="flex items-center space-x-3 flex-1">
                      <input
                        type="checkbox"
                        {...step3Form.register('termsService')}
                        className="w-5 h-5 rounded border-gray-300 accent-[#665146] focus:ring-[#665146]"
                        style={{ 
                          accentColor: '#665146',
                          backgroundColor: step3TermsService ? '#665146' : 'white',
                          borderColor: step3TermsService ? '#665146' : '#d1d5db'
                        }}
                      />
                      <span className="text-sm">
                        <span className="text-red-500">[필수]</span> 서비스 이용약관에 동의합니다.
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowTermsModal('service')}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </label>
                  {step3Errors.termsService && (
                    <p className="text-sm text-red-500 ml-8">{step3Errors.termsService.message}</p>
                  )}
                  
                  {/* 정기 결제 및 자동 갱신 */}
                  <label className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 cursor-pointer">
                    <div className="flex items-center space-x-3 flex-1">
                      <input
                        type="checkbox"
                        {...step3Form.register('termsPayment')}
                        className="w-5 h-5 rounded border-gray-300 accent-[#665146] focus:ring-[#665146]"
                        style={{ 
                          accentColor: '#665146',
                          backgroundColor: step3TermsPayment ? '#665146' : 'white',
                          borderColor: step3TermsPayment ? '#665146' : '#d1d5db'
                        }}
                      />
                      <span className="text-sm">
                        <span className="text-red-500">[필수]</span> 정기 결제 및 자동 갱신에 동의합니다.
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowTermsModal('payment')}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </label>
                  {step3Errors.termsPayment && (
                    <p className="text-sm text-red-500 ml-8">{step3Errors.termsPayment.message}</p>
                  )}
                  
                  {/* 환불/해지 정책 */}
                  <label className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 cursor-pointer">
                    <div className="flex items-center space-x-3 flex-1">
                      <input
                        type="checkbox"
                        {...step3Form.register('termsRefund')}
                        className="w-5 h-5 rounded border-gray-300 accent-[#665146] focus:ring-[#665146]"
                        style={{ 
                          accentColor: '#665146',
                          backgroundColor: step3TermsRefund ? '#665146' : 'white',
                          borderColor: step3TermsRefund ? '#665146' : '#d1d5db'
                        }}
                      />
                      <span className="text-sm">
                        <span className="text-red-500">[필수]</span> 환불/해지 정책을 확인했습니다.
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowTermsModal('refund')}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </label>
                  {step3Errors.termsRefund && (
                    <p className="text-sm text-red-500 ml-8">{step3Errors.termsRefund.message}</p>
                  )}
                </div>
                
                {/* 동의하기 버튼 */}
                <form onSubmit={step3Form.handleSubmit(onStep3Submit)}>
                  <Button
                    type="submit"
                    className="w-full bg-[#665146] hover:bg-[#5A453A] text-white rounded-full py-3"
                    disabled={!isStep3Valid || signupMutation.isPending}
                  >
                    {signupMutation.isPending ? '가입 중...' : '동의하기'}
                  </Button>
                </form>
              </div>
            </div>
          </>
        )}

        <div className="text-center text-sm">
          <Link to="/login" className="text-primary hover:underline">
            이미 계정이 있으신가요? 로그인
          </Link>
        </div>
      </div>

      {/* Email Verification Modal */}
      {showEmailVerificationModal && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-end animate-overlay-fade"
          onClick={() => {
            if (emailVerified) {
              setShowEmailVerificationModal(false);
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
                  if (emailVerified) {
                    setShowEmailVerificationModal(false);
                  }
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
                value={emailVerificationInput}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                  setEmailVerificationInput(value);
                }}
                placeholder="인증번호 입력"
                maxLength={6}
                className="text-center text-lg tracking-widest"
                disabled={emailVerified}
              />
              {emailVerificationCode && (
                <p className="text-xs text-gray-500 text-center">
                  개발 모드: 인증번호는 콘솔에 표시되었습니다 ({emailVerificationCode})
                </p>
              )}
            </div>
            <Button
              onClick={handleConfirmEmailVerification}
              className="w-full bg-[#665146] hover:bg-[#5A453A] text-white"
              disabled={emailVerificationInput.length !== 6 || emailVerified || confirmEmailVerification.isPending}
            >
              {confirmEmailVerification.isPending ? '확인 중...' : '확인'}
            </Button>
          </div>
        </div>
      )}

      {/* Terms Modal */}
      {showTermsModal && (
        <TermsModal
          type={showTermsModal}
          onClose={() => setShowTermsModal(false)}
        />
      )}

    </div>
  );
}

import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSignup } from '@/hooks/useAuth';
import { useNicknameCheck } from '@/hooks/useNicknameCheck';
import { useCheckEmailExists, useRequestEmailVerification, useConfirmEmailVerification } from '@/hooks/useEmailVerification';
import { useUploadImage } from '@/hooks/useUpload';
import { ChevronLeft, Eye, EyeOff, X, User, Pencil, Calendar, ChevronUp, ChevronDown } from 'lucide-react';
import { TermsModal } from '@/pages/my/TermsModal';
import { StorageImage } from '@/components/StorageImage';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, getDate, startOfWeek, endOfWeek } from 'date-fns';
import { ko } from 'date-fns/locale';

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
      const [year, month, day] = val.split('-').map(Number);
      return year && month && day && month >= 1 && month <= 12 && day >= 1 && day <= 31;
    }, '생년월일을 입력해주세요.')
    .optional(),
  profileImageUrl: z.string().optional(),
});

// Step 3: Terms schema
const step3Schema = z.object({
  termsService: z.boolean().refine((val) => val === true, '서비스 이용약관에 동의해주세요'),
  termsPrivacy: z.boolean().refine((val) => val === true, '개인정보 처리방침에 동의해주세요'),
});

type Step1FormData = z.infer<typeof step1Schema>;
type Step2FormData = z.infer<typeof step2Schema>;
type Step3FormData = z.infer<typeof step3Schema>;

export function SignupPage() {
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
  const uploadImage = useUploadImage();
  const [profileImageUrl, setProfileImageUrl] = useState<string | undefined>(undefined);
  const [showTermsModal, setShowTermsModal] = useState<false | 'service' | 'privacy'>(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const calendarRef = useRef<HTMLDivElement>(null);
  const calendarButtonRef = useRef<HTMLButtonElement>(null);
  const [calendarDate, setCalendarDate] = useState(new Date());

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
  const step3TermsService = step3Form.watch('termsService');
  const step3TermsPrivacy = step3Form.watch('termsPrivacy');

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
  const isStep2Valid =
    step2Nickname &&
    step2Name &&
    step2DateOfBirth &&
    !step2Errors.nickname &&
    !step2Errors.name &&
    !step2Errors.dateOfBirth &&
    nicknameError.length === 0;

  // Step 3 validation
  const step3Errors = step3Form.formState.errors;
  const isStep3Valid = step3TermsService === true && step3TermsPrivacy === true;

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

  // Handle profile image upload
  const handleProfileImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('이미지 파일만 업로드 가능합니다');
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('이미지 크기는 5MB 이하여야 합니다');
      return;
    }

    try {
      const uploadedUrl = await uploadImage.mutateAsync(file);
      setProfileImageUrl(uploadedUrl);
      step2Form.setValue('profileImageUrl', uploadedUrl);
    } catch (err) {
      setError('이미지 업로드에 실패했습니다');
    }

    // Reset input
    e.target.value = '';
  };

  // Step 2 submit
  const onStep2Submit = async (data: Step2FormData) => {
    if (nicknameError.length > 0) {
      setError('닉네임을 올바르게 입력해주세요');
      return;
    }

    setFormData((prev) => ({ ...prev, step2: { ...data, profileImageUrl } }));
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
        profileImageUrl: formData.step2.profileImageUrl,
        termsConsents: [
          { termsType: 'service', consented: data.termsService },
          { termsType: 'privacy', consented: data.termsPrivacy },
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
    <div className="min-h-screen flex flex-col px-4 py-8 bg-beige-50">
      <div className="w-full max-w-sm mx-auto space-y-6">
        {/* Header */}
        <div className="relative">
          {step > 1 && (
            <button
              onClick={() => setStep((prev) => (prev === 2 ? 1 : 2) as 1 | 2 | 3)}
              className="absolute left-0 top-0 p-2 rounded-full hover:bg-gray-100 -ml-2"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          <div className="text-center space-y-4">
            <h1 className="text-2xl font-bold">회원가입</h1>
            <p className="text-sm text-muted-foreground">
              {step === 1 && '사용하실 계정 정보를 입력해주세요.'}
              {step === 2 && '회원 정보를 입력해주세요.'}
              {step === 3 && '약관에 동의해주세요.'}
            </p>
          </div>
        </div>

        {/* Progress indicator */}
        <div className="flex items-center justify-center gap-2">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-2 w-8 rounded-full ${
                s <= step ? 'bg-brown-600' : 'bg-gray-200'
              }`}
            />
          ))}
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
              <div className="flex gap-2">
                <Input
                  id="email"
                  type="email"
                  {...step1Form.register('email')}
                  placeholder="이메일을 입력해주세요"
                  className={step1Errors.email ? 'border-red-500' : ''}
                  disabled={emailVerified}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleRequestEmailVerification}
                  disabled={requestEmailVerification.isPending || emailVerified}
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
              className="w-full bg-brown-600 hover:bg-brown-700 text-white"
              disabled={!isStep1Valid}
            >
              다음
            </Button>
          </form>
        )}

        {/* Step 2: Profile Info */}
        {step === 2 && (
          <form onSubmit={step2Form.handleSubmit(onStep2Submit)} className="space-y-4">
            <div className="space-y-2">
              <Label>프로필 사진</Label>
              <div className="flex items-center">
                <div className="relative shrink-0">
                  <div className="w-16 h-16 rounded-full bg-brown-200 flex items-center justify-center overflow-hidden">
                    {profileImageUrl ? (
                      <StorageImage
                        url={profileImageUrl}
                        alt="Profile"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User className="w-8 h-8 text-brown-600" />
                    )}
                  </div>
                  <label className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-brown-600 flex items-center justify-center cursor-pointer hover:bg-brown-700">
                    <Pencil className="w-3 h-3 text-white" />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleProfileImageSelect}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="nickname">닉네임</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="nickname"
                  type="text"
                  {...step2Form.register('nickname')}
                  placeholder="닉네임을 입력하세요"
                  className={
                    step2Errors.nickname || nicknameError.length > 0 ? 'border-red-500' : ''
                  }
                />
                {step2Nickname && nicknameError.length === 0 && !step2Errors.nickname && (
                  <div className="w-6 h-6 rounded-full bg-brown-600 flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-xs">✓</span>
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
                className={step2Errors.name ? 'border-red-500' : ''}
              />
              {step2Errors.name && (
                <p className="text-sm text-red-500">{step2Errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 relative">
                <Label htmlFor="dateOfBirth">생년월일</Label>
                <button
                  ref={calendarButtonRef}
                  type="button"
                  onClick={() => {
                    if (step2DateOfBirth) {
                      const [year, month, day] = step2DateOfBirth.split('-');
                      if (year && month && day) {
                        setCalendarDate(new Date(parseInt(year), parseInt(month) - 1, parseInt(day)));
                      }
                    }
                    setShowCalendar(!showCalendar);
                  }}
                  className="p-1 hover:bg-gray-100 rounded relative"
                >
                  <Calendar className="w-4 h-4 text-brown-600" />
                </button>
                
                {/* 커스텀 달력 - 달력 아이콘 바로 아래에 표시 */}
                {showCalendar && (
                  <>
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setShowCalendar(false)}
                    />
                    <div
                      ref={calendarRef}
                      className="absolute left-0 top-full z-50 bg-gray-800 rounded-lg p-4 shadow-xl mt-2"
                      style={{
                        minWidth: '280px',
                      }}
                    >
                    {/* 달력 헤더 */}
                    <div className="flex items-center justify-between mb-4 text-white">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">
                          {format(calendarDate, 'yyyy년 MM월', { locale: ko })}
                        </span>
                        <ChevronDown className="w-4 h-4" />
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setCalendarDate(subMonths(calendarDate, 1))}
                          className="p-1 hover:bg-gray-700 rounded"
                        >
                          <ChevronUp className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setCalendarDate(addMonths(calendarDate, 1))}
                          className="p-1 hover:bg-gray-700 rounded"
                        >
                          <ChevronDown className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    
                    {/* 요일 헤더 */}
                    <div className="grid grid-cols-7 gap-1 mb-2">
                      {['일', '월', '화', '수', '목', '금', '토'].map((day) => (
                        <div key={day} className="text-center text-xs text-gray-400 py-1">
                          {day}
                        </div>
                      ))}
                    </div>
                    
                    {/* 달력 그리드 */}
                    <div className="grid grid-cols-7 gap-1">
                      {(() => {
                        const monthStart = startOfMonth(calendarDate);
                        const monthEnd = endOfMonth(calendarDate);
                        const startDate = startOfWeek(monthStart, { weekStartsOn: 0 });
                        const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });
                        const days = eachDayOfInterval({ start: startDate, end: endDate });
                        const selectedDate = step2DateOfBirth ? new Date(step2DateOfBirth) : null;
                        
                        return days.map((day) => {
                          const isCurrentMonth = isSameMonth(day, calendarDate);
                          const isSelected = selectedDate && isSameDay(day, selectedDate);
                          const isToday = isSameDay(day, new Date());
                          
                          return (
                            <button
                              key={day.toISOString()}
                              type="button"
                              onClick={() => {
                                const dateStr = format(day, 'yyyy-MM-dd');
                                step2Form.setValue('dateOfBirth', dateStr);
                                setShowCalendar(false);
                              }}
                              className={`
                                w-8 h-8 rounded text-xs
                                ${!isCurrentMonth ? 'text-gray-600' : 'text-white'}
                                ${isSelected ? 'bg-blue-500 text-white border border-white' : ''}
                                ${!isSelected && isCurrentMonth ? 'hover:bg-gray-700' : ''}
                                ${isToday && !isSelected ? 'border border-gray-500' : ''}
                              `}
                            >
                              {getDate(day)}
                            </button>
                          );
                        });
                      })()}
                    </div>
                    
                    {/* 하단 버튼 */}
                    <div className="flex justify-between mt-4 pt-4 border-t border-gray-700">
                      <button
                        type="button"
                        onClick={() => {
                          step2Form.setValue('dateOfBirth', undefined);
                          setShowCalendar(false);
                        }}
                        className="text-blue-400 text-sm"
                      >
                        삭제
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const today = format(new Date(), 'yyyy-MM-dd');
                          step2Form.setValue('dateOfBirth', today);
                          setCalendarDate(new Date());
                          setShowCalendar(false);
                        }}
                        className="text-blue-400 text-sm"
                      >
                        오늘
                      </button>
                    </div>
                  </div>
                </>
                )}
              </div>
              
              <Input
                id="dateOfBirth"
                type="text"
                placeholder="2000 / 00 / 00"
                value={
                  step2DateOfBirth
                    ? step2DateOfBirth
                        .split('-')
                        .map((part, idx) => {
                          if (idx === 0) return part;
                          return part.padStart(2, '0');
                        })
                        .join(' / ')
                    : ''
                }
                onChange={(e) => {
                  // 숫자와 공백, 슬래시만 허용
                  let value = e.target.value.replace(/[^\d\s\/]/g, '');
                  
                  // 슬래시와 공백을 제거하고 숫자만 추출
                  const numbers = value.replace(/[^\d]/g, '');
                  
                  // 년(4자리), 월(2자리), 일(2자리)로 분리
                  let year = numbers.slice(0, 4);
                  let month = numbers.slice(4, 6);
                  let day = numbers.slice(6, 8);
                  
                  // 폼에 저장할 값 (ISO 형식: YYYY-MM-DD)
                  if (year.length === 4 && month.length === 2 && day.length === 2) {
                    const dateValue = `${year}-${month}-${day}`;
                    step2Form.setValue('dateOfBirth', dateValue);
                  } else if (year.length === 4 && month.length === 2) {
                    step2Form.setValue('dateOfBirth', `${year}-${month.padStart(2, '0')}-`);
                  } else if (year.length === 4) {
                    step2Form.setValue('dateOfBirth', `${year}--`);
                  } else if (year.length > 0) {
                    step2Form.setValue('dateOfBirth', `${year}-`);
                  } else {
                    step2Form.setValue('dateOfBirth', undefined);
                  }
                }}
                className={step2Errors.dateOfBirth ? 'border-red-500' : ''}
              />
              {step2Errors.dateOfBirth && (
                <p className="text-sm text-red-500">{step2Errors.dateOfBirth.message}</p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full bg-brown-600 hover:bg-brown-700 text-white"
              disabled={!isStep2Valid}
            >
              다음
            </Button>
          </form>
        )}

        {/* Step 3: Terms */}
        {step === 3 && (
          <form onSubmit={step3Form.handleSubmit(onStep3Submit)} className="space-y-4">
            <div className="space-y-2">
              <label className="flex items-start space-x-2">
                <input
                  type="checkbox"
                  {...step3Form.register('termsService')}
                  className="mt-1"
                />
                <span className="text-sm">
                  서비스 이용약관에 동의합니다{' '}
                  <button
                    type="button"
                    onClick={() => setShowTermsModal('service')}
                    className="text-brown-600 underline"
                  >
                    보기
                  </button>
                </span>
              </label>
              {step3Errors.termsService && (
                <p className="text-sm text-red-500">{step3Errors.termsService.message}</p>
              )}
              <label className="flex items-start space-x-2">
                <input
                  type="checkbox"
                  {...step3Form.register('termsPrivacy')}
                  className="mt-1"
                />
                <span className="text-sm">
                  개인정보 처리방침에 동의합니다{' '}
                  <button
                    type="button"
                    onClick={() => setShowTermsModal('privacy')}
                    className="text-brown-600 underline"
                  >
                    보기
                  </button>
                </span>
              </label>
              {step3Errors.termsPrivacy && (
                <p className="text-sm text-red-500">{step3Errors.termsPrivacy.message}</p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full bg-brown-600 hover:bg-brown-700 text-white"
              disabled={!isStep3Valid || signupMutation.isPending}
            >
              {signupMutation.isPending ? '가입 중...' : '가입하기'}
            </Button>
          </form>
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
          className="fixed inset-0 z-50 bg-black/50 flex items-end"
          onClick={() => {
            if (emailVerified) {
              setShowEmailVerificationModal(false);
            }
          }}
        >
          <div
            className="bg-white rounded-t-2xl w-full max-w-md p-6 space-y-4"
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
              className="w-full bg-brown-600 hover:bg-brown-700 text-white"
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

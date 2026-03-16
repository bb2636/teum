import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSignup } from '@/hooks/useAuth';
import { useRequestPhoneVerification, useConfirmPhoneVerification } from '@/hooks/usePhoneVerification';
import { useNicknameCheck } from '@/hooks/useNicknameCheck';
import { Logo } from '@/components/Logo';

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

const signupSchema = z.object({
  email: z.string().email('올바른 이메일을 입력해주세요'),
  password: passwordSchema,
  confirmPassword: z.string(),
  nickname: nicknameSchema,
  name: z.string().min(1, '이름을 입력해주세요.').max(100),
  phone: z.string().optional(),
  verificationCode: z.string().optional(),
  dateOfBirth: z
    .string()
    .refine((val) => {
      if (!val) return false;
      const [year, month, day] = val.split('-').map(Number);
      return year && month && day && month >= 1 && month <= 12 && day >= 1 && day <= 31;
    }, '생년월일을 입력해주세요.')
    .optional(),
  country: z.string().optional(),
  termsService: z.boolean().refine((val) => val === true, '서비스 이용약관에 동의해주세요'),
  termsPrivacy: z.boolean().refine((val) => val === true, '개인정보 처리방침에 동의해주세요'),
});

type SignupFormData = z.infer<typeof signupSchema>;

export function SignupPage() {
  const signupMutation = useSignup();
  const requestVerification = useRequestPhoneVerification();
  const confirmVerification = useConfirmPhoneVerification();
  const [error, setError] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState<string | null>(null);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [showVerificationCode, setShowVerificationCode] = useState(false);
  const [nicknameError, setNicknameError] = useState<string[]>([]);
  
  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    trigger,
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    mode: 'onChange', // 실시간 유효성 검사
  });

  const email = watch('email');
  const password = watch('password');
  const confirmPassword = watch('confirmPassword');
  const nickname = watch('nickname');
  const name = watch('name');
  const termsService = watch('termsService');
  const termsPrivacy = watch('termsPrivacy');
  const phone = watch('phone');
  
  // Check nickname availability
  const shouldCheckNickname = nickname && nickname.length >= 2 && nickname.length <= 12 && !nickname.includes(' ') && /^[a-zA-Z0-9가-힣_]+$/.test(nickname);
  const nicknameCheck = useNicknameCheck(nickname || '', shouldCheckNickname || false);
  
  // 버튼 활성화 조건: 모든 필수 필드가 입력되고 유효성 검사를 통과해야 함
  const isFormValid = 
    email && 
    password && 
    confirmPassword && 
    nickname && 
    name && 
    termsService === true && 
    termsPrivacy === true &&
    !errors.email &&
    !errors.password &&
    !errors.confirmPassword &&
    !errors.nickname &&
    !errors.name &&
    !errors.termsService &&
    !errors.termsPrivacy &&
    nicknameError.length === 0 &&
    password === confirmPassword;

  // 닉네임 실시간 유효성 검사
  useEffect(() => {
    if (nickname && nickname.length > 0) {
      const errors: string[] = [];
      
      if (nickname.length < 2 || nickname.length > 12) {
        errors.push('닉네임은 2~12자로 입력해 주세요.');
      }
      
      if (nickname.includes(' ')) {
        errors.push('닉네임에 공백은 사용할 수 없습니다.');
      }
      
      if (!/^[a-zA-Z0-9가-힣_]+$/.test(nickname)) {
        errors.push('사용할 수 없는 문자가 포함되어 있습니다.');
      }
      
      // Server-side duplicate check
      if (shouldCheckNickname && nicknameCheck.data && !nicknameCheck.data.available) {
        if (nicknameCheck.data.reason === 'duplicate') {
          errors.push('이미 사용 중인 닉네임입니다.');
        }
      }
      
      setNicknameError(errors);
      trigger('nickname');
    } else {
      setNicknameError([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nickname, nicknameCheck.data, shouldCheckNickname]);

  // Request verification code
  const handleRequestVerification = async () => {
    if (!phone || phone.length < 10) {
      setError('올바른 전화번호를 입력해주세요');
      return;
    }

    setError(null);
    requestVerification.mutate(phone, {
      onSuccess: (data) => {
        setShowVerificationCode(true);
        if (data.code) {
          setVerificationCode(data.code);
        }
      },
      onError: (err) => {
        setError(err instanceof Error ? err.message : '인증번호 발송에 실패했습니다');
      },
    });
  };

  // Confirm verification code
  const handleConfirmVerification = async (code: string) => {
    if (!phone || !code) {
      setError('전화번호와 인증번호를 입력해주세요');
      return;
    }

    setError(null);
    confirmVerification.mutate(
      { phone, code },
      {
        onSuccess: () => {
          setPhoneVerified(true);
          setError(null);
        },
        onError: (err) => {
          setError(err instanceof Error ? err.message : '인증번호가 올바르지 않습니다');
          setPhoneVerified(false);
        },
      }
    );
  };

  // Watch verification code input
  const verificationCodeInput = watch('verificationCode');
  
  useEffect(() => {
    if (verificationCodeInput && verificationCodeInput.length === 6 && phone && !phoneVerified) {
      handleConfirmVerification(verificationCodeInput);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verificationCodeInput]);

  const onSubmit = async (data: SignupFormData) => {
    if (data.password !== data.confirmPassword) {
      setError('비밀번호가 일치하지 않습니다');
      return;
    }

    if (nicknameError.length > 0) {
      setError('닉네임을 올바르게 입력해주세요');
      return;
    }

    setError(null);
    signupMutation.mutate(
      {
        email: data.email,
        password: data.password,
        nickname: data.nickname,
        name: data.name,
        phone: data.phone || undefined,
        dateOfBirth: data.dateOfBirth || undefined,
        country: data.country || undefined,
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
    <div className="min-h-screen flex flex-col px-4 py-8">
      <div className="w-full max-w-sm mx-auto space-y-6">
        <div className="text-center space-y-4">
          <Logo size="sm" showText={false} />
          <h1 className="text-2xl font-bold">회원가입</h1>
          <p className="text-sm text-muted-foreground">
            사용하실 계정 정보를 입력해주세요.
          </p>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">이메일</Label>
            <div className="flex gap-2">
              <Input
                id="email"
                type="email"
                {...register('email')}
                placeholder="이메일을 입력해주세요"
                className={errors.email ? 'border-red-500 placeholder:text-red-500' : ''}
              />
              <Button
                type="button"
                variant="outline"
                onClick={async () => {
                  const isValid = await trigger('email');
                  if (isValid) {
                    // TODO: 이메일 인증번호 발송
                    console.log('이메일 인증번호 발송');
                  }
                }}
              >
                인증번호 보내기
              </Button>
            </div>
            {errors.email && (
              <p className="text-sm text-red-500">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">비밀번호</Label>
            <Input
              id="password"
              type="password"
              {...register('password')}
              placeholder="비밀번호를 입력해주세요"
              className={errors.password ? 'border-red-500 placeholder:text-red-500' : ''}
            />
            {errors.password && (
              <p className="text-sm text-red-500">{errors.password.message}</p>
            )}
            {!errors.password && password && (
              <p className="text-xs text-red-500">
                비밀번호는 8자 이상, 영문/숫자를 포함해 주세요.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">비밀번호 확인</Label>
            <Input
              id="confirmPassword"
              type="password"
              {...register('confirmPassword')}
              placeholder="비밀번호를 입력해주세요"
              className={password && watch('confirmPassword') !== password ? 'border-red-500 placeholder:text-red-500' : ''}
            />
            {password && watch('confirmPassword') !== password && (
              <p className="text-sm text-red-500">비밀번호가 일치하지 않습니다.</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="nickname">닉네임</Label>
            <div className="flex items-center gap-2">
              <Input
                id="nickname"
                type="text"
                {...register('nickname')}
                placeholder="닉네임을 입력하세요"
                className={errors.nickname || nicknameError.length > 0 ? 'border-red-500 placeholder:text-red-500' : ''}
              />
              {nickname && nicknameError.length === 0 && !errors.nickname && (
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
            {errors.nickname && nicknameError.length === 0 && (
              <p className="text-sm text-red-500">{errors.nickname.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">이름</Label>
            <Input
              id="name"
              type="text"
              {...register('name')}
              placeholder="이름을 입력하세요"
              className={errors.name ? 'border-red-500 placeholder:text-red-500' : ''}
            />
            {errors.name && (
              <p className="text-sm text-red-500">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="dateOfBirth">생년월일</Label>
            <Input
              id="dateOfBirth"
              type="date"
              {...register('dateOfBirth')}
              className={errors.dateOfBirth ? 'border-red-500' : ''}
            />
            {errors.dateOfBirth && (
              <p className="text-sm text-red-500">{errors.dateOfBirth.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">전화번호 (선택)</Label>
            <div className="flex gap-2">
              <Input
                id="phone"
                type="tel"
                {...register('phone')}
                placeholder="010-1234-5678"
                disabled={phoneVerified}
              />
              {!phoneVerified && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleRequestVerification}
                  disabled={requestVerification.isPending || !phone}
                >
                  {requestVerification.isPending ? '발송 중...' : '인증번호 받기'}
                </Button>
              )}
              {phoneVerified && (
                <span className="flex items-center text-sm text-green-600">
                  ✓ 인증완료
                </span>
              )}
            </div>
            {showVerificationCode && !phoneVerified && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-700 font-medium mb-1">
                  인증번호가 발송되었습니다
                </p>
                {verificationCode ? (
                  <div className="mt-2 p-2 bg-white border border-blue-300 rounded">
                    <p className="text-xs text-blue-600 mb-1">인증번호:</p>
                    <p className="text-lg font-mono font-bold text-blue-800 tracking-widest text-center">
                      {verificationCode}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-blue-600">
                    개발 모드: 서버 콘솔을 확인하여 6자리 인증번호를 확인하세요.
                  </p>
                )}
              </div>
            )}
            {showVerificationCode && !phoneVerified && (
              <div className="space-y-2">
                <Label htmlFor="verificationCode">인증번호</Label>
                <Input
                  id="verificationCode"
                  type="text"
                  {...register('verificationCode')}
                  placeholder="6자리 인증번호"
                  maxLength={6}
                  className="text-center text-lg tracking-widest"
                />
                {errors.verificationCode && (
                  <p className="text-sm text-red-500">{errors.verificationCode.message}</p>
                )}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="country">국가 (선택)</Label>
            <Input
              id="country"
              type="text"
              {...register('country')}
              placeholder="대한민국"
            />
          </div>

          <div className="space-y-2">
            <label className="flex items-start space-x-2">
              <input
                type="checkbox"
                {...register('termsService')}
                className="mt-1"
              />
              <span className="text-sm">서비스 이용약관에 동의합니다</span>
            </label>
            {errors.termsService && (
              <p className="text-sm text-red-500">{errors.termsService.message}</p>
            )}
            <label className="flex items-start space-x-2">
              <input
                type="checkbox"
                {...register('termsPrivacy')}
                className="mt-1"
              />
              <span className="text-sm">개인정보 처리방침에 동의합니다</span>
            </label>
            {errors.termsPrivacy && (
              <p className="text-sm text-red-500">{errors.termsPrivacy.message}</p>
            )}
          </div>

          <Button 
            className={`w-full ${isFormValid ? 'bg-[#8B4513] text-white hover:bg-[#A0522D]' : 'bg-gray-500 text-white cursor-not-allowed'}`}
            size="lg" 
            type="submit" 
            disabled={signupMutation.isPending || !isFormValid}
          >
            {signupMutation.isPending ? '가입 중...' : '다음'}
          </Button>
        </form>

        <div className="text-center text-sm">
          <Link to="/login" className="text-primary hover:underline">
            이미 계정이 있으신가요? 로그인
          </Link>
        </div>
      </div>
    </div>
  );
}

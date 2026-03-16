import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRequestPasswordReset, useResetPassword } from '@/hooks/usePasswordReset';

// 비밀번호 유효성 검사: 8자 이상, 영문/숫자 포함
const passwordSchema = z
  .string()
  .min(8, '비밀번호는 8자 이상, 영문/숫자를 포함해 주세요.')
  .refine((val) => /[a-zA-Z]/.test(val), '비밀번호는 8자 이상, 영문/숫자를 포함해 주세요.')
  .refine((val) => /[0-9]/.test(val), '비밀번호는 8자 이상, 영문/숫자를 포함해 주세요.');

const forgotPasswordSchema = z.object({
  email: z.string().min(1, '이메일을 입력해주세요').email('올바른 이메일을 입력해주세요'),
});

const resetPasswordSchema = z.object({
  token: z.string().optional(),
  password: passwordSchema,
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: '비밀번호가 일치하지 않습니다.',
  path: ['confirmPassword'],
});

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;
type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const requestPasswordReset = useRequestPasswordReset();
  const resetPassword = useResetPassword();

  const [step, setStep] = useState<'email' | 'reset'>(token ? 'reset' : 'email');
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [resetToken, setResetToken] = useState<string | null>(token);

  const emailForm = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    mode: 'onChange',
  });

  const passwordForm = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    mode: 'onChange',
    defaultValues: {
      token: resetToken || token || '',
    },
  });
  
  const emailFormWatch = emailForm.watch('email');
  const passwordFormWatchPassword = passwordForm.watch('password');
  const passwordFormWatchConfirmPassword = passwordForm.watch('confirmPassword');
  
  // 이메일 단계 버튼 활성화 조건
  const isEmailFormValid = emailFormWatch && emailFormWatch.length > 0 && !emailForm.formState.errors.email;
  
  // 비밀번호 재설정 단계 버튼 활성화 조건
  const isPasswordFormValid = 
    passwordFormWatchPassword && 
    passwordFormWatchConfirmPassword && 
    passwordFormWatchPassword === passwordFormWatchConfirmPassword &&
    !passwordForm.formState.errors.password &&
    !passwordForm.formState.errors.confirmPassword;

  // Update form when token changes
  useEffect(() => {
    if (resetToken) {
      passwordForm.setValue('token', resetToken);
    }
  }, [resetToken]);

  const onEmailSubmit = async (data: ForgotPasswordFormData) => {
    setError(null);
    try {
      const response = await requestPasswordReset.mutateAsync(data.email);
      // If token is returned (development mode), show it and go to reset step
      if (response.token) {
        setResetToken(response.token);
        setStep('reset');
        // Update URL with token
        navigate(`/forgot-password?token=${response.token}`, { replace: true });
      } else {
        alert('비밀번호 재설정 이메일이 발송되었습니다. 이메일을 확인해주세요.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '이메일 발송에 실패했습니다');
    }
  };

  const onPasswordSubmit = async (data: ResetPasswordFormData) => {
    setError(null);
    try {
      const tokenToUse = resetToken || token || data.token || '';
      if (!tokenToUse) {
        setError('재설정 토큰이 필요합니다');
        return;
      }

      await resetPassword.mutateAsync({
        token: tokenToUse,
        password: data.password,
      });

      alert('비밀번호가 성공적으로 변경되었습니다.');
      navigate('/login');
    } catch (err) {
      setError(err instanceof Error ? err.message : '비밀번호 재설정에 실패했습니다');
    }
  };

  if (step === 'reset') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm space-y-8">
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold">새 비밀번호를 입력해주세요</h1>
          </div>

          {/* Show token in development mode */}
          {resetToken && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-xs font-medium text-blue-900 mb-1">재설정 토큰 (개발 모드):</p>
              <p className="text-xs text-blue-700 break-all font-mono">{resetToken}</p>
              <p className="text-xs text-blue-600 mt-2">
                또는 링크로 접속: <a href={`/forgot-password?token=${resetToken}`} className="underline">{`/forgot-password?token=${resetToken.substring(0, 20)}...`}</a>
              </p>
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">비밀번호</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  {...passwordForm.register('password')}
                  placeholder="비밀번호를 입력해주세요"
                  className={passwordForm.formState.errors.password ? 'border-red-500 placeholder:text-red-500 pr-10' : 'pr-10'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.29 3.29m0 0L12 12m-5.71-5.71L12 12" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
              {passwordForm.formState.errors.password && (
                <p className="text-sm text-red-500">
                  {passwordForm.formState.errors.password.message}
                </p>
              )}
              {!passwordForm.formState.errors.password && passwordForm.watch('password') && (
                <p className="text-xs text-red-500">
                  비밀번호는 8자 이상, 영문/숫자를 포함해 주세요.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">비밀번호 확인</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  {...passwordForm.register('confirmPassword')}
                  placeholder="비밀번호를 입력해주세요"
                  className={passwordForm.formState.errors.confirmPassword ? 'border-red-500 placeholder:text-red-500 pr-10' : 'pr-10'}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showConfirmPassword ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.29 3.29m0 0L12 12m-5.71-5.71L12 12" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
              {passwordForm.formState.errors.confirmPassword && (
                <p className="text-sm text-red-500">
                  {passwordForm.formState.errors.confirmPassword.message}
                </p>
              )}
              {passwordForm.watch('password') && 
               passwordForm.watch('confirmPassword') && 
               passwordForm.watch('password') !== passwordForm.watch('confirmPassword') && (
                <p className="text-sm text-red-500">비밀번호가 일치하지 않습니다.</p>
              )}
            </div>

            <Button 
              className={`w-full ${isPasswordFormValid ? 'bg-[#8B4513] text-white hover:bg-[#A0522D]' : 'bg-gray-500 text-white cursor-not-allowed'}`}
              size="lg" 
              type="submit"
              disabled={resetPassword.isPending || !isPasswordFormValid}
            >
              {resetPassword.isPending ? '변경 중...' : '비밀번호 변경'}
            </Button>
          </form>

          <div className="text-center text-sm">
            <Link to="/login" className="text-primary hover:underline">
              로그인으로 돌아가기
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">비밀번호 찾기</h1>
          <p className="text-sm text-muted-foreground">
            가입하신 이메일을 입력해주세요.
          </p>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={emailForm.handleSubmit(onEmailSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">이메일</Label>
            <Input
              id="email"
              type="email"
              {...emailForm.register('email')}
              placeholder="이메일을 입력해주세요"
              className={emailForm.formState.errors.email ? 'border-red-500 placeholder:text-red-500' : ''}
            />
            {emailForm.formState.errors.email && (
              <p className="text-sm text-red-500">
                {emailForm.formState.errors.email.message}
              </p>
            )}
          </div>

          <Button 
            className={`w-full ${isEmailFormValid ? 'bg-[#8B4513] text-white hover:bg-[#A0522D]' : 'bg-gray-500 text-white cursor-not-allowed'}`}
            size="lg" 
            type="submit"
            disabled={requestPasswordReset.isPending || !isEmailFormValid}
          >
            {requestPasswordReset.isPending ? '전송 중...' : '인증번호 보내기'}
          </Button>
        </form>

        <div className="text-center text-sm">
          <Link to="/login" className="text-primary hover:underline">
            로그인으로 돌아가기
          </Link>
        </div>
      </div>
    </div>
  );
}

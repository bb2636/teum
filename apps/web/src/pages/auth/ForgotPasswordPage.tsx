import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRequestPasswordResetByPhone, useResetPassword } from '@/hooks/usePasswordReset';
import { useRequestPhoneVerification, useConfirmPhoneVerification } from '@/hooks/usePhoneVerification';
import { X, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { Toast } from '@/components/Toast';

const passwordSchema = z
  .string()
  .min(8, '비밀번호는 8자 이상, 영문/숫자를 포함해 주세요.')
  .refine((val) => /[a-zA-Z]/.test(val), '비밀번호는 8자 이상, 영문/숫자를 포함해 주세요.')
  .refine((val) => /[0-9]/.test(val), '비밀번호는 8자 이상, 영문/숫자를 포함해 주세요.');

const forgotPasswordSchema = z.object({
  email: z.string().min(1, '이메일을 입력해주세요').email('올바른 이메일을 입력해주세요'),
  phone: z.string().min(10, '전화번호를 입력해주세요').max(15),
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
  const requestPasswordResetByPhone = useRequestPasswordResetByPhone();
  const resetPassword = useResetPassword();
  const requestPhoneVerification = useRequestPhoneVerification();
  const confirmPhoneVerification = useConfirmPhoneVerification();

  const [step, setStep] = useState<'info' | 'reset'>(token ? 'reset' : 'info');
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [resetToken, setResetToken] = useState<string | null>(token);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [showPhoneVerificationModal, setShowPhoneVerificationModal] = useState(false);
  const [phoneVerificationCode, setPhoneVerificationCode] = useState<string | null>(null);
  const [phoneVerificationInput, setPhoneVerificationInput] = useState('');
  const [showToast, setShowToast] = useState(false);

  const infoForm = useForm<ForgotPasswordFormData>({
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

  const infoFormEmail = infoForm.watch('email');
  const infoFormPhone = infoForm.watch('phone');
  const passwordFormWatchPassword = passwordForm.watch('password');
  const passwordFormWatchConfirmPassword = passwordForm.watch('confirmPassword');

  const isInfoFormValid = infoFormEmail && infoFormPhone && infoFormPhone.length >= 10 && !infoForm.formState.errors.email && !infoForm.formState.errors.phone;

  const isPasswordFormValid = 
    passwordFormWatchPassword && 
    passwordFormWatchConfirmPassword && 
    passwordFormWatchPassword === passwordFormWatchConfirmPassword &&
    !passwordForm.formState.errors.password &&
    !passwordForm.formState.errors.confirmPassword;

  useEffect(() => {
    if (resetToken) {
      passwordForm.setValue('token', resetToken);
    }
  }, [resetToken]);

  const handleRequestPhoneVerification = async () => {
    const phone = infoForm.getValues('phone');
    if (!phone || phone.length < 10) {
      setError('전화번호를 정확히 입력해주세요');
      return;
    }

    setError(null);

    try {
      const result = await requestPhoneVerification.mutateAsync(phone);
      setPhoneVerificationCode(result.code || null);
      setShowPhoneVerificationModal(true);
      setPhoneVerified(false);
      setPhoneVerificationInput('');
    } catch (err: any) {
      setError(err?.message || '인증번호 발송에 실패했습니다');
    }
  };

  const handleConfirmPhoneVerification = async () => {
    const phone = infoForm.getValues('phone');
    if (!phone) return;

    try {
      const response = await confirmPhoneVerification.mutateAsync({
        phone,
        code: phoneVerificationInput,
      });

      if (response.verified) {
        setPhoneVerified(true);
        setShowPhoneVerificationModal(false);
        const email = infoForm.getValues('email');
        try {
          const resetResponse = await requestPasswordResetByPhone.mutateAsync({ email, phone });
          if (resetResponse.token) {
            setResetToken(resetResponse.token);
            setStep('reset');
            setError(null);
          } else {
            setError('비밀번호 재설정 토큰을 생성할 수 없습니다.');
          }
        } catch (resetErr: any) {
          const errorMessage = resetErr?.message || '이메일과 전화번호가 일치하는 계정을 찾을 수 없습니다.';
          setError(errorMessage);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '인증번호 확인에 실패했습니다');
    }
  };

  const onInfoSubmit = async (_data: ForgotPasswordFormData) => {
    setError(null);
    await handleRequestPhoneVerification();
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

      setShowToast(true);

      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : '비밀번호 재설정에 실패했습니다');
    }
  };

  if (step === 'reset') {
    return (
      <div className="min-h-screen flex flex-col bg-white px-4 py-6 pb-24">
        <div className="flex items-center mb-8">
          <button
            onClick={() => {
              setStep('info');
              setResetToken(null);
              setPhoneVerified(false);
            }}
            className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm mr-3"
          >
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <h1 className="text-xl font-bold text-gray-900">비밀번호 찾기</h1>
        </div>

        <div className="w-full max-w-sm mx-auto space-y-6 flex-1 overflow-y-auto">
          <div className="space-y-2">
            <h2 className="text-base font-bold text-gray-900">새 비밀번호를 입력해주세요.</h2>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password" className="text-gray-900">비밀번호</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  {...passwordForm.register('password')}
                  placeholder="비밀번호를 입력해주세요"
                  className={`bg-gray-100 rounded-lg pr-10 ${
                    passwordForm.formState.errors.password ? 'border-red-500 placeholder:text-red-500' : 'border-gray-200'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {passwordForm.formState.errors.password && (
                <p className="text-sm text-red-500">
                  {passwordForm.formState.errors.password.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-gray-900">비밀번호 확인</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  {...passwordForm.register('confirmPassword')}
                  placeholder="비밀번호를 입력해주세요"
                  className={`bg-gray-100 rounded-lg pr-10 ${
                    passwordForm.formState.errors.confirmPassword ? 'border-red-500 placeholder:text-red-500' : 'border-gray-200'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {passwordForm.formState.errors.confirmPassword && (
                <p className="text-sm text-red-500">
                  {passwordForm.formState.errors.confirmPassword.message}
                </p>
              )}
            </div>
          </form>

          <Toast
            message="비밀번호가 변경되었습니다."
            isVisible={showToast}
            onClose={() => setShowToast(false)}
            duration={3000}
          />
        </div>

        <div className="fixed bottom-0 left-0 right-0 bg-white px-4 py-4 border-t border-gray-200 z-40">
          <div className="max-w-sm mx-auto">
            <Button 
              className={`w-full rounded-lg ${
                isPasswordFormValid 
                  ? 'bg-[#665146] text-white hover:bg-[#5A453A]' 
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
              size="lg" 
              type="button"
              onClick={passwordForm.handleSubmit(onPasswordSubmit)}
              disabled={resetPassword.isPending || !isPasswordFormValid}
            >
              {resetPassword.isPending ? '변경 중...' : '비밀번호 변경'}
            </Button>
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
            가입하신 이메일과 전화번호를 입력해주세요.
          </p>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={infoForm.handleSubmit(onInfoSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">이메일</Label>
            <Input
              id="email"
              type="email"
              {...infoForm.register('email')}
              placeholder="이메일을 입력해주세요"
              className={infoForm.formState.errors.email ? 'border-red-500 placeholder:text-red-500' : ''}
            />
            {infoForm.formState.errors.email && (
              <p className="text-sm text-red-500">
                {infoForm.formState.errors.email.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">전화번호</Label>
            <Input
              id="phone"
              type="tel"
              {...infoForm.register('phone')}
              placeholder="전화번호를 입력해주세요"
              className={infoForm.formState.errors.phone ? 'border-red-500 placeholder:text-red-500' : ''}
            />
            {infoForm.formState.errors.phone && (
              <p className="text-sm text-red-500">
                {infoForm.formState.errors.phone.message}
              </p>
            )}
          </div>

          <Button 
            className={`w-full ${isInfoFormValid ? 'bg-[#665146] text-white hover:bg-[#5A453A]' : 'bg-gray-500 text-white cursor-not-allowed'}`}
            size="lg" 
            type="submit"
            disabled={requestPhoneVerification.isPending || !isInfoFormValid}
          >
            {requestPhoneVerification.isPending ? '전송 중...' : '인증번호 보내기'}
          </Button>
        </form>

        <div className="text-center text-sm">
          <Link to="/login" className="text-primary hover:underline">
            로그인으로 돌아가기
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
    </div>
  );
}

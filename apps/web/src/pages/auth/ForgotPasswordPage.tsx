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
import { useT } from '@/hooks/useTranslation';

function getForgotPasswordSchema(t: (key: string) => string) {
  const passwordSchema = z
    .string()
    .min(8, t('auth.passwordRule'))
    .refine((val) => /[a-zA-Z]/.test(val), t('auth.passwordRule'))
    .refine((val) => /[0-9]/.test(val), t('auth.passwordRule'));

  const forgotPasswordSchema = z.object({
    email: z.string().min(1, t('auth.enterEmail')).email(t('auth.enterValidEmail')),
    phone: z.string().min(10, t('auth.enterPhone')).max(15),
  });

  const resetPasswordSchema = z.object({
    token: z.string().optional(),
    password: passwordSchema,
    confirmPassword: z.string(),
  }).refine((data) => data.password === data.confirmPassword, {
    message: t('auth.passwordMismatch'),
    path: ['confirmPassword'],
  });

  return { forgotPasswordSchema, resetPasswordSchema };
}

type ForgotPasswordFormData = { email: string; phone: string };
type ResetPasswordFormData = { token?: string; password: string; confirmPassword: string };

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const t = useT();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const requestPasswordResetByPhone = useRequestPasswordResetByPhone();
  const resetPassword = useResetPassword();
  const requestPhoneVerification = useRequestPhoneVerification();
  const confirmPhoneVerification = useConfirmPhoneVerification();

  const { forgotPasswordSchema, resetPasswordSchema } = getForgotPasswordSchema(t);

  const [step, setStep] = useState<'info' | 'reset'>(token ? 'reset' : 'info');
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [resetToken, setResetToken] = useState<string | null>(token);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [showPhoneVerificationModal, setShowPhoneVerificationModal] = useState(false);
  const [phoneVerificationInput, setPhoneVerificationInput] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [verifyKbHeight, setVerifyKbHeight] = useState(0);

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

  const handleRequestPhoneVerification = async () => {
    const phone = infoForm.getValues('phone');
    if (!phone || phone.length < 10) {
      setError(t('auth.enterPhoneCorrectly'));
      return;
    }

    setError(null);

    try {
      await requestPhoneVerification.mutateAsync(phone);
      setShowPhoneVerificationModal(true);
      setPhoneVerified(false);
      setPhoneVerificationInput('');
    } catch (err: any) {
      setError(err?.message || t('auth.verificationSendFailed'));
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
            setError(t('auth.resetTokenFailed'));
          }
        } catch (resetErr: any) {
          const errorMessage = resetErr?.message || t('auth.accountNotFound');
          setError(errorMessage);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.verificationConfirmFailed'));
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
        setError(t('auth.resetTokenNeeded'));
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
      setError(err instanceof Error ? err.message : t('auth.resetFailed'));
    }
  };

  if (step === 'reset') {
    return (
      <div className="min-h-screen flex flex-col bg-white px-4 pb-24" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)' }}>
        <div className="flex items-center mb-8 px-1">
          <button
            onClick={() => {
              setStep('info');
              setResetToken(null);
              setPhoneVerified(false);
            }}
            className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm mr-3 shrink-0"
          >
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <h1 className="text-xl font-bold text-gray-900">{t('auth.forgotPasswordTitle')}</h1>
        </div>

        <div className="w-full max-w-sm mx-auto space-y-6 flex-1 overflow-y-auto overflow-x-hidden">
          <div className="space-y-2">
            <h2 className="text-base font-bold text-gray-900">{t('auth.newPasswordPrompt')}</h2>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password" className="text-gray-900">{t('auth.password')}</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  {...passwordForm.register('password')}
                  placeholder={t('auth.passwordPlaceholder')}
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
              <Label htmlFor="confirmPassword" className="text-gray-900">{t('auth.confirmPassword')}</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  {...passwordForm.register('confirmPassword')}
                  placeholder={t('auth.passwordPlaceholder')}
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
            message={t('auth.passwordChanged')}
            isVisible={showToast}
            onClose={() => setShowToast(false)}
            duration={3000}
          />
        </div>

        <div className="fixed bottom-0 left-0 right-0 bg-white px-4 py-4 border-t border-gray-200 z-40 pb-safe-fixed">
          <div className="max-w-sm mx-auto">
            <Button 
              className={`w-full rounded-lg ${
                isPasswordFormValid 
                  ? 'bg-[#4A2C1A] text-white hover:bg-[#3A2010]' 
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
              size="lg" 
              type="button"
              onClick={passwordForm.handleSubmit(onPasswordSubmit)}
              disabled={resetPassword.isPending || !isPasswordFormValid}
            >
              {resetPassword.isPending ? t('auth.changingPassword') : t('auth.changePassword')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)' }}>
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">{t('auth.forgotPasswordTitle')}</h1>
          <p className="text-sm text-muted-foreground">
            {t('auth.forgotPasswordDesc')}
          </p>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={infoForm.handleSubmit(onInfoSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">{t('auth.email')}</Label>
            <Input
              id="email"
              type="email"
              {...infoForm.register('email')}
              placeholder={t('auth.emailPlaceholder')}
              className={infoForm.formState.errors.email ? 'border-red-500 placeholder:text-red-500' : ''}
            />
            {infoForm.formState.errors.email && (
              <p className="text-sm text-red-500">
                {infoForm.formState.errors.email.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">{t('auth.phone')}</Label>
            <Input
              id="phone"
              type="tel"
              {...infoForm.register('phone')}
              placeholder={t('auth.phonePlaceholder')}
              className={infoForm.formState.errors.phone ? 'border-red-500 placeholder:text-red-500' : ''}
            />
            {infoForm.formState.errors.phone && (
              <p className="text-sm text-red-500">
                {infoForm.formState.errors.phone.message}
              </p>
            )}
          </div>

          <Button 
            className={`w-full ${isInfoFormValid ? 'bg-[#4A2C1A] text-white hover:bg-[#3A2010]' : 'bg-gray-500 text-white cursor-not-allowed'}`}
            size="lg" 
            type="submit"
            disabled={requestPhoneVerification.isPending || !isInfoFormValid}
          >
            {requestPhoneVerification.isPending ? t('auth.sendingVerification') : t('auth.sendVerification')}
          </Button>
        </form>

        <div className="text-center text-sm">
          <Link to="/login" className="text-primary hover:underline">
            {t('auth.backToLogin')}
          </Link>
        </div>
      </div>

      {showPhoneVerificationModal && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center animate-overlay-fade px-4"
          onClick={() => {
            if (phoneVerified) {
              setShowPhoneVerificationModal(false);
            }
          }}
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
              <h2 className="text-lg font-semibold">{t('auth.verificationModalTitle')}</h2>
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
              <Label htmlFor="verificationCode">{t('auth.verificationCodeLabel')}</Label>
              <Input
                id="verificationCode"
                type="text"
                value={phoneVerificationInput}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                  setPhoneVerificationInput(value);
                }}
                placeholder={t('auth.enterVerificationCode')}
                maxLength={6}
                className="text-center text-lg tracking-widest focus:placeholder-transparent"
                disabled={phoneVerified}
              />
            </div>
            <Button
              onClick={handleConfirmPhoneVerification}
              className="w-full bg-[#4A2C1A] hover:bg-[#3A2010] text-white"
              disabled={phoneVerificationInput.length !== 6 || phoneVerified || confirmPhoneVerification.isPending}
            >
              {confirmPhoneVerification.isPending ? t('auth.confirmingVerification') : t('auth.confirm')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

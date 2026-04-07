import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLogin } from '@/hooks/useAuth';
import { Logo } from '@/components/Logo';
import { useMe } from '@/hooks/useProfile';
import { useT } from '@/hooks/useTranslation';

const loginSchema = z.object({
  email: z.string().min(1, 'required').email('invalid'),
  password: z.string().min(1, 'required'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export function LoginPage() {
  const navigate = useNavigate();
  const loginMutation = useLogin();
  const t = useT();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [skipAutoRedirect] = useState(() => {
    return !!sessionStorage.getItem('teum_logged_out');
  });
  const { data: user, isLoading: isCheckingAuth } = useMe();

  useEffect(() => {
    if (skipAutoRedirect) return;
    if (isCheckingAuth) return;
    if (user) {
      if (user.role === 'admin') {
        navigate('/admin', { replace: true });
      } else {
        navigate('/home', { replace: true });
      }
    }
  }, [user, isCheckingAuth, navigate, skipAutoRedirect]);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    mode: 'onSubmit',
  });

  const email = watch('email');
  const password = watch('password');
  
  const isFormValid = email && email.length > 0 && password && password.length > 0;

  const onSubmit = async (data: LoginFormData) => {
    setError(null);
    loginMutation.mutate(data, {
      onError: (err) => {
        console.error('Login error:', err);
        const errorMessage = err instanceof Error 
          ? err.message 
          : t('auth.loginFailed');
        setError(errorMessage);
      },
    });
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8 bg-gray-50 relative" style={{ paddingTop: 'max(32px, env(safe-area-inset-top, 32px))' }}>
      <button
        onClick={() => navigate('/splash')}
        className="absolute top-4 left-4 w-10 h-10 rounded-full bg-white flex items-center justify-center hover:bg-gray-100 transition-colors shadow-sm"
        aria-label="Back"
      >
        <ChevronLeft className="w-5 h-5 text-gray-700" />
      </button>
      
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-1">
          <Logo size="md" />
          <p className="text-muted-foreground text-sm">
            {t('app.tagline')}
          </p>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">{t('auth.email')}</Label>
            <Input
              id="email"
              type="email"
              {...register('email')}
              placeholder={t('auth.emailPlaceholder')}
              className={errors.email ? 'border-red-500 placeholder:text-red-500' : ''}
            />
            {errors.email && (
              <p className="text-sm text-red-500">{errors.email.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">{t('auth.password')}</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                {...register('password')}
                placeholder={t('auth.passwordPlaceholder')}
                className={errors.password ? 'border-red-500 placeholder:text-red-500 pr-10' : 'pr-10'}
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
            {errors.password && (
              <p className="text-sm text-red-500">{errors.password.message}</p>
            )}
          </div>
          <Button 
            className={`w-full ${isFormValid ? 'bg-[#4A2C1A] text-white hover:bg-[#3A2010]' : 'bg-gray-500 text-white cursor-not-allowed'}`}
            size="lg" 
            type="submit" 
            disabled={loginMutation.isPending || !isFormValid}
          >
            {loginMutation.isPending ? t('auth.loggingIn') : t('auth.loginAction')}
          </Button>
        </form>

        <div className="text-center text-sm">
          <Link to="/signup" className="text-primary hover:underline">
            {t('auth.signup')}
          </Link>
          {' · '}
          <Link to="/forgot-password" className="text-primary hover:underline">
            {t('auth.forgotPassword')}
          </Link>
        </div>
      </div>
    </div>
  );
}

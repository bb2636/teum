import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ChevronLeft, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLogin } from '@/hooks/useAuth';

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
        setError(t('auth.loginFailed'));
      },
    });
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8 bg-gray-50 relative overflow-y-auto" style={{ paddingTop: 'max(32px, env(safe-area-inset-top, 32px))', paddingBottom: 'max(60px, env(safe-area-inset-bottom, 60px))' }}>
      <button
        onClick={() => navigate('/splash')}
        className="absolute top-4 left-4 w-10 h-10 rounded-full bg-white flex items-center justify-center hover:bg-gray-100 transition-colors shadow-sm"
        style={{ top: 'max(16px, env(safe-area-inset-top, 16px))' }}
        aria-label="Back"
      >
        <ChevronLeft className="w-5 h-5 text-gray-700" />
      </button>
      
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-1">
          <img src="/logo.png" alt="TEUM logo" className="h-24 w-auto object-contain mx-auto" />
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
              onFocus={(e) => setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300)}
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
                onFocus={(e) => setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300)}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
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

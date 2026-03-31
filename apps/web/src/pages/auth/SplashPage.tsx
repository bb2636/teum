import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { useGoogleLogin } from '@/hooks/useSocialAuth';
import { useMe } from '@/hooks/useProfile';
import { useT } from '@/hooks/useTranslation';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: any) => void;
          prompt: (callback?: (notification: any) => void) => void;
          renderButton: (element: HTMLElement, config: any) => void;
          disableAutoSelect: () => void;
          revoke: (hint: string, callback?: () => void) => void;
        };
      };
    };
  }
}

export function SplashPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const googleLogin = useGoogleLogin();
  const t = useT();
  const gsiInitialized = useRef(false);
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

  useEffect(() => {
    if (gsiInitialized.current) return;

    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) return;

    const initGsi = () => {
      if (gsiInitialized.current) return;
      if (!window.google) return;

      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async (response: any) => {
          try {
            const result = await googleLogin.mutateAsync(response.credential);
            if (result.isNewUser && result.socialProfile) {
              navigate('/social-onboarding', { state: { socialProfile: result.socialProfile, onboardingToken: result.onboardingToken } });
            } else if (result.user) {
              sessionStorage.removeItem('teum_logged_out');
              queryClient.cancelQueries();
              queryClient.clear();
              if (result.user.role === 'admin') {
                window.location.href = '/admin';
              } else {
                window.location.href = '/home';
              }
            }
          } catch (err) {
            console.error('Google login error:', err);
          }
        },
        auto_select: false,
      });
      gsiInitialized.current = true;
    };

    if (window.google) {
      initGsi();
    } else {
      const existingScript = document.querySelector('script[src*="accounts.google.com/gsi/client"]');
      if (existingScript) {
        existingScript.addEventListener('load', initGsi);
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = initGsi;
      document.head.appendChild(script);
    }
  }, []);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
  }, []);

  const handleGoogleLogin = () => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) {
      console.error('Google Client ID is not configured');
      return;
    }

    openGoogleOAuthRedirect(clientId);
  };

  const openGoogleOAuthRedirect = (clientId: string) => {
    const redirectUri = `${window.location.origin}/api/auth/google/callback`;
    const scope = 'openid email profile';
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}&prompt=select_account`;
    window.location.href = authUrl;
  };

  const handleAppleLogin = () => {
    const clientId = import.meta.env.VITE_APPLE_CLIENT_ID;
    if (!clientId) {
      console.error('Apple Client ID is not configured');
      return;
    }

    const redirectUri = `${window.location.origin}/api/auth/apple/callback`;
    const scope = 'name email';
    const authUrl = `https://appleid.apple.com/auth/authorize?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}&response_mode=form_post`;
    window.location.href = authUrl;
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#665146]">
      <div className="w-full h-screen bg-[#665146] relative overflow-hidden flex flex-col items-center justify-center px-4">
        <div className="w-full flex flex-col items-center justify-center space-y-6">
          <div className="flex flex-col justify-center items-center text-center space-y-2">
            <div>
              <Logo size="md" />
            </div>
            <p className="text-[#221813] text-sm" style={{ opacity: 0.6 }}>
              {t('app.tagline')}
            </p>
          </div>

          <div className="w-full space-y-4">
            <Button
              className="w-full rounded-xl py-4 text-base font-medium border"
              style={{
                backgroundColor: 'rgba(253, 253, 253, 0.2)',
                borderColor: 'rgba(253, 253, 253, 0.6)',
                color: '#fdfdfd',
              }}
              size="lg"
              onClick={() => navigate('/login')}
            >
              {t('auth.login')}
            </Button>

            <div className="relative flex items-center justify-center my-3">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t" style={{ borderColor: 'rgba(253, 253, 253, 0.8)' }}></div>
              </div>
              <div className="relative bg-[#665146] px-4">
                <span className="text-sm" style={{ color: 'rgba(253, 253, 253, 0.8)' }}>{t('common.or')}</span>
              </div>
            </div>

            <div className="flex justify-center items-center gap-6">
              <button
                type="button"
                onClick={handleGoogleLogin}
                className="w-14 h-14 rounded-full bg-white flex items-center justify-center hover:bg-gray-100 transition-colors shadow-md"
                aria-label="Google로 로그인"
                disabled={googleLogin.isPending}
              >
                <svg className="w-8 h-8" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
              </button>

              <button
                type="button"
                onClick={handleAppleLogin}
                className="w-14 h-14 rounded-full bg-black flex items-center justify-center hover:bg-gray-800 transition-colors shadow-md"
                aria-label="Apple로 로그인"
              >
                <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

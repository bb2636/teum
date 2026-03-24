import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { useGoogleLogin, useAppleLogin } from '@/hooks/useSocialAuth';
import { useMe } from '@/hooks/useProfile';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: any) => void;
          prompt: (callback?: (notification: any) => void) => void;
          renderButton: (element: HTMLElement, config: any) => void;
        };
      };
    };
    AppleID?: {
      auth: {
        init: (config: any) => void;
        signIn: () => Promise<any>;
      };
    };
  }
}

export function SplashPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const googleLogin = useGoogleLogin();
  const appleLogin = useAppleLogin();
  const [skipAutoRedirect] = useState(() => {
    const flag = sessionStorage.getItem('teum_logging_out');
    if (flag) {
      sessionStorage.removeItem('teum_logging_out');
      return true;
    }
    return false;
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

  const handleGoogleCredentialResponse = useCallback(
    async (response: any) => {
      try {
        const result = await googleLogin.mutateAsync(response.credential);
        if (result.isNewUser && result.socialProfile) {
          navigate('/social-onboarding', { state: { socialProfile: result.socialProfile, onboardingToken: result.onboardingToken } });
        } else if (result.user) {
          queryClient.clear();
          if (result.user.role === 'admin') {
            navigate('/admin');
          } else {
            navigate('/home');
          }
        }
      } catch (err) {
        console.error('Google login error:', err);
      }
    },
    [googleLogin, navigate, queryClient]
  );

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
      if (clientId && window.google) {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: handleGoogleCredentialResponse,
        });
      }
    };
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
    };
  }, [handleGoogleCredentialResponse]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.body.style.height = '100%';
    document.documentElement.style.overflow = 'hidden';
    document.documentElement.style.position = 'fixed';
    document.documentElement.style.width = '100%';
    document.documentElement.style.height = '100%';

    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.height = '';
      document.documentElement.style.overflow = '';
      document.documentElement.style.position = '';
      document.documentElement.style.width = '';
      document.documentElement.style.height = '';
    };
  }, []);

  const handleGoogleLogin = () => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) {
      console.error('Google Client ID is not configured');
      return;
    }
    if (window.google) {
      window.google.accounts.id.prompt();
    }
  };

  const handleAppleLogin = async () => {
    try {
      const clientId = import.meta.env.VITE_APPLE_CLIENT_ID;
      const redirectUri = import.meta.env.VITE_APPLE_REDIRECT_URI || `${window.location.origin}/api/auth/apple/callback`;

      if (!clientId) {
        console.error('Apple Client ID is not configured');
        return;
      }

      if (!window.AppleID) {
        const script = document.createElement('script');
        script.src = 'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js';
        script.async = true;
        await new Promise<void>((resolve) => {
          script.onload = () => resolve();
          document.head.appendChild(script);
        });
      }

      window.AppleID!.auth.init({
        clientId,
        scope: 'name email',
        redirectURI: redirectUri,
        usePopup: true,
      });

      const appleResponse = await window.AppleID!.auth.signIn();

      const result = await appleLogin.mutateAsync({
        idToken: appleResponse.authorization.id_token,
        authorizationCode: appleResponse.authorization.code,
        user: appleResponse.user,
      });

      if (result.isNewUser && result.socialProfile) {
        navigate('/social-onboarding', { state: { socialProfile: result.socialProfile, onboardingToken: result.onboardingToken } });
      } else if (result.user) {
        queryClient.clear();
        if (result.user.role === 'admin') {
          navigate('/admin');
        } else {
          navigate('/home');
        }
      }
    } catch (err: any) {
      if (err?.error !== 'popup_closed_by_user') {
        console.error('Apple login error:', err);
      }
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#665146]">
      <div className="w-full h-screen bg-[#665146] relative overflow-hidden flex flex-col items-center justify-center px-4" style={{ touchAction: 'none' }}>
        <div className="w-full flex flex-col items-center justify-center space-y-6">
          <div className="flex flex-col justify-center items-center text-center space-y-2">
            <div className="[&_h1]:text-[#221813]">
              <Logo size="md" showText={true} />
            </div>
            <p className="text-[#221813] text-sm" style={{ opacity: 0.6 }}>
              기록이 곧, 당신만의 트랙이 됩니다.
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
              이메일로 로그인
            </Button>

            <div className="relative flex items-center justify-center my-3">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t" style={{ borderColor: 'rgba(253, 253, 253, 0.8)' }}></div>
              </div>
              <div className="relative bg-[#665146] px-4">
                <span className="text-sm" style={{ color: 'rgba(253, 253, 253, 0.8)' }}>또는</span>
              </div>
            </div>

            <div className="flex justify-center items-center gap-6">
              <button
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
                onClick={handleAppleLogin}
                className="w-14 h-14 rounded-full bg-black flex items-center justify-center hover:bg-gray-800 transition-colors shadow-md"
                aria-label="Apple로 로그인"
                disabled={appleLogin.isPending}
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

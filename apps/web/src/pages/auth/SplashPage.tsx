import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGoogleLogin } from '@/hooks/useSocialAuth';
import { useMe } from '@/hooks/useProfile';
import { useT } from '@/hooks/useTranslation';
import { forceFullCacheClear } from '@/lib/queryClient';
import { apiRequest } from '@/lib/api';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: Record<string, unknown>) => void;
          prompt: (callback?: (notification: Record<string, unknown>) => void) => void;
          renderButton: (element: HTMLElement, config: Record<string, unknown>) => void;
          disableAutoSelect: () => void;
          revoke: (hint: string, callback?: () => void) => void;
        };
      };
    };
  }
}

function getCapacitorPlatform(): { isNative: boolean; platform: string } {
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string } }).Capacitor;
  if (cap?.isNativePlatform?.()) {
    return { isNative: true, platform: cap.getPlatform?.() || 'android' };
  }
  const ua = navigator.userAgent || '';
  if (/; wv\)/.test(ua)) {
    const platform = /iPhone|iPad|iPod/.test(ua) ? 'ios' : 'android';
    return { isNative: true, platform };
  }
  if (/iPhone|iPad|iPod/.test(ua) && !/Safari\//.test(ua)) {
    return { isNative: true, platform: 'ios' };
  }
  return { isNative: false, platform: 'web' };
}

const OAUTH_NONCE_KEY = 'teum_oauth_nonce';
const OAUTH_PENDING_KEY = 'teum_oauth_pending_ts';

function getOAuthState(): { nonce: string | null; pendingTs: number | null } {
  try {
    const nonce = localStorage.getItem(OAUTH_NONCE_KEY);
    const ts = localStorage.getItem(OAUTH_PENDING_KEY);
    return { nonce, pendingTs: ts ? parseInt(ts, 10) : null };
  } catch {
    return { nonce: null, pendingTs: null };
  }
}

function clearOAuthState() {
  try {
    localStorage.removeItem(OAUTH_NONCE_KEY);
    localStorage.removeItem(OAUTH_PENDING_KEY);
  } catch {
  }
}

export function SplashPage() {
  const navigate = useNavigate();
  const googleLogin = useGoogleLogin();
  const t = useT();
  const exchangingRef = useRef(false);
  const { data: user, isLoading: isCheckingAuth } = useMe();
  const [skipAutoRedirect] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.has('error') || sessionStorage.getItem('teum_logged_out') === '1';
  });

  useEffect(() => {
    if (isCheckingAuth || skipAutoRedirect) return;
    if (user) {
      if (user.role === 'admin') {
        navigate('/admin', { replace: true });
      } else {
        navigate('/home', { replace: true });
      }
    }
  }, [user, isCheckingAuth, navigate, skipAutoRedirect]);

  const exchangeToken = useCallback(async () => {
    if (exchangingRef.current) return;

    const { nonce, pendingTs } = getOAuthState();
    if (!nonce || !pendingTs) return;
    if (Date.now() - pendingTs > 5 * 60 * 1000) {
      clearOAuthState();
      return;
    }

    exchangingRef.current = true;

    try {
      const apiBase = import.meta.env.VITE_API_URL || '/api';
      const res = await fetch(`${apiBase}/auth/exchange-mobile-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ token: nonce }),
      });

      if (res.status === 404) {
        exchangingRef.current = false;
        return;
      }

      if (!res.ok) {
        exchangingRef.current = false;
        return;
      }

      const data = await res.json();

      if (data?.data?.onboardingData) {
        clearOAuthState();
        const d = data.data.onboardingData;
        forceFullCacheClear();
        navigate('/social-onboarding', {
          state: {
            socialProfile: {
              provider: d.provider || '',
              email: d.email || '',
              name: d.name || '',
              picture: d.picture || '',
              providerAccountId: d.providerAccountId || '',
              isEmailHidden: d.isEmailHidden === 'true',
            },
            onboardingToken: d.onboardingToken || '',
          },
        });
        return;
      }

      if (data?.data?.role) {
        clearOAuthState();
        sessionStorage.removeItem('teum_logged_out');
        forceFullCacheClear();
        if (data.data.role === 'admin') {
          window.location.href = '/admin';
        } else {
          window.location.href = '/home';
        }
        return;
      }

      exchangingRef.current = false;
    } catch {
      exchangingRef.current = false;
    }
  }, [navigate]);

  useEffect(() => {
    const { isNative } = getCapacitorPlatform();
    if (!isNative) return;

    let unmounted = false;
    const handles: { remove: () => void }[] = [];

    const handleDeepLink = async (url: string) => {
      if (unmounted) return;
      if (!url.startsWith('com.teum.app://auth-callback')) return;

      try {
        const { Browser } = await import('@capacitor/browser');
        await Browser.close();
      } catch {
      }

      const params = new URL(url.replace('com.teum.app://', 'https://placeholder/')).searchParams;

      const error = params.get('error');
      if (error) {
        if (!unmounted) alert(t('auth.loginFailed'));
        return;
      }

      const token = params.get('token');
      const isNewUser = params.get('isNewUser');

      if (isNewUser === 'true') {
        if (!unmounted) {
          forceFullCacheClear();
          navigate('/social-onboarding', {
            state: {
              socialProfile: {
                provider: params.get('provider') || '',
                email: params.get('email') || '',
                name: params.get('name') || '',
                picture: params.get('picture') || '',
                providerAccountId: params.get('providerAccountId') || '',
                isEmailHidden: params.get('isEmailHidden') === 'true',
              },
              onboardingToken: params.get('onboardingToken') || '',
            },
          });
        }
        return;
      }

      if (token) {
        clearOAuthState();
        try {
          forceFullCacheClear();
          const result = await apiRequest<{ success: boolean; data: { role: string } }>('/auth/exchange-mobile-token', {
            method: 'POST',
            body: JSON.stringify({ token }),
          });
          if (unmounted) return;
          sessionStorage.removeItem('teum_logged_out');
          forceFullCacheClear();
          if (result.data.role === 'admin') {
            window.location.href = '/admin';
          } else {
            window.location.href = '/home';
          }
        } catch {
          if (!unmounted) alert(t('auth.loginFailed'));
        }
        return;
      }

      if (params.get('success') === 'true') {
        exchangeToken();
      }
    };

    (async () => {
      try {
        const { App } = await import('@capacitor/app');
        if (unmounted) return;

        const launchUrl = await App.getLaunchUrl();
        if (launchUrl?.url) {
          const processedKey = 'teum_processed_launch_url';
          const lastProcessed = sessionStorage.getItem(processedKey);
          if (lastProcessed !== launchUrl.url) {
            sessionStorage.setItem(processedKey, launchUrl.url);
            handleDeepLink(launchUrl.url);
          }
        }

        const handle = await App.addListener('appUrlOpen', (event) => {
          if (!unmounted) handleDeepLink(event.url);
        });
        if (unmounted) { handle.remove(); } else { handles.push(handle); }

        const stateHandle = await App.addListener('appStateChange', (state) => {
          if (!unmounted && state.isActive) {
            exchangingRef.current = false;
            exchangeToken();
          }
        });
        if (unmounted) { stateHandle.remove(); } else { handles.push(stateHandle); }
      } catch {
      }

      try {
        const { Browser } = await import('@capacitor/browser');
        if (unmounted) return;
        const browserHandle = await Browser.addListener('browserFinished', () => {
          exchangingRef.current = false;
          exchangeToken();
        });
        if (unmounted) { browserHandle.remove(); } else { handles.push(browserHandle); }
      } catch {
      }
    })();

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        exchangingRef.current = false;
        exchangeToken();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    const onFocus = () => {
      exchangingRef.current = false;
      exchangeToken();
    };
    window.addEventListener('focus', onFocus);

    let pollCount = 0;
    const pollInterval = setInterval(() => {
      if (unmounted) { clearInterval(pollInterval); return; }
      const { nonce } = getOAuthState();
      if (!nonce) { pollCount = 0; return; }
      pollCount++;
      if (pollCount > 90) {
        clearOAuthState();
        clearInterval(pollInterval);
        return;
      }
      exchangingRef.current = false;
      exchangeToken();
    }, 2000);

    return () => {
      unmounted = true;
      handles.forEach(h => h.remove());
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', onFocus);
      clearInterval(pollInterval);
    };
  }, [navigate, t, exchangeToken]);


  useEffect(() => {
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
  }, []);

  const handleGoogleLogin = async () => {
    const { isNative } = getCapacitorPlatform();
    const nonce = crypto.randomUUID();
    if (isNative) {
      const state = `nonce=${nonce}&platform=mobile`;
      try {
        localStorage.setItem(OAUTH_NONCE_KEY, nonce);
        localStorage.setItem(OAUTH_PENDING_KEY, String(Date.now()));
      } catch {
      }
      try {
        const { Browser } = await import('@capacitor/browser');
        const apiBase = import.meta.env.VITE_API_URL || '/api';
        const baseUrl = apiBase.startsWith('http') ? apiBase : `${window.location.origin}${apiBase}`;
        await Browser.open({
          url: `${baseUrl}/auth/google/init?state=${encodeURIComponent(state)}`,
          presentationStyle: 'fullscreen',
        });
      } catch {
        window.location.href = `/api/auth/google/init?state=${encodeURIComponent(state)}`;
      }
    } else {
      const state = `nonce=${nonce}`;
      window.location.href = `/api/auth/google/init?state=${encodeURIComponent(state)}`;
    }
  };

  const handleAppleLogin = async () => {
    const { isNative } = getCapacitorPlatform();
    const nonce = crypto.randomUUID();
    const state = isNative ? `nonce=${nonce}&platform=mobile` : `nonce=${nonce}`;
    try {
      localStorage.setItem(OAUTH_NONCE_KEY, nonce);
      localStorage.setItem(OAUTH_PENDING_KEY, String(Date.now()));
    } catch {
    }
    if (isNative) {
      try {
        const { Browser } = await import('@capacitor/browser');
        const apiBase = import.meta.env.VITE_API_URL || '/api';
        const baseUrl = apiBase.startsWith('http') ? apiBase : `${window.location.origin}${apiBase}`;
        await Browser.open({
          url: `${baseUrl}/auth/apple/init?state=${encodeURIComponent(state)}`,
          presentationStyle: 'fullscreen',
        });
      } catch {
        window.location.href = `/api/auth/apple/init?state=${encodeURIComponent(state)}`;
      }
    } else {
      window.location.href = `/api/auth/apple/init?state=${encodeURIComponent(state)}`;
    }
  };

  return (
    <div
      className="w-full bg-white flex flex-col"
      style={{
        height: '100dvh',
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <div className="flex-1 flex flex-col items-center px-6 max-w-md mx-auto w-full">

        <div className="flex-[3]" />

        <div className="flex flex-col items-center text-center">
          <img
            src="/logo.png"
            alt="teum"
            className="w-12 h-12 object-contain"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        </div>

        <div className="flex-[3]" />

        <div className="flex flex-col items-center text-center mb-6">
          <p
            className="text-sm leading-relaxed"
            style={{ color: 'rgba(34, 24, 19, 0.5)' }}
          >
            {t('app.tagline')}
          </p>
        </div>

        <div className="w-full pb-8 space-y-3">
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="w-full h-[50px] rounded-full flex items-center justify-center text-sm font-medium text-white transition-colors"
            style={{ backgroundColor: '#4A2C1A' }}
          >
            {t('auth.login')}
          </button>

          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={googleLogin.isPending}
            className="w-full h-[50px] rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center gap-3 text-sm font-medium text-gray-800 transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            {t('auth.continueGoogle')}
          </button>

          <button
            type="button"
            onClick={handleAppleLogin}
            className="w-full h-[50px] rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center gap-3 text-sm font-medium text-gray-800 transition-colors"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
            </svg>
            {t('auth.continueApple')}
          </button>
        </div>

      </div>
    </div>
  );
}

import { ReactNode, useEffect, useRef } from 'react';
import { BottomTabBar } from '../components/navigation/BottomTabBar';
import { DiaryTypeModal } from '../components/DiaryTypeModal';
import { useLocation, useNavigate } from 'react-router-dom';
import { useHideTabBar } from '../contexts/HideTabBarContext';

const AUTH_ROUTES = ['/splash', '/login', '/signup', '/forgot-password', '/social-onboarding', '/mobile-login-complete', '/login-redirect'];
const HIDE_TAB_BAR_ROUTES = ['/diaries/new', '/folders/new', '/admin', '/my/profile-edit', '/my/payment-history', '/my/support/inquiry', '/payment', '/payment/success', '/music/create', '/music/jobs', '/music/list'];
const TAB_ROUTES = new Set(['/home', '/calendar', '/music']);

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { hideTabBar } = useHideTabBar();
  const prevPathRef = useRef(location.pathname);

  const isTabSwitch =
    TAB_ROUTES.has(location.pathname) && TAB_ROUTES.has(prevPathRef.current);

  useEffect(() => {
    if (!isTabSwitch) {
      window.scrollTo(0, 0);
    }
    prevPathRef.current = location.pathname;
  }, [location.pathname, isTabSwitch]);

  const lastBackPressRef = useRef<number>(0);
  const locationRef = useRef(location.pathname);
  useEffect(() => { locationRef.current = location.pathname; }, [location.pathname]);

  useEffect(() => {
    let unmounted = false;
    let backHandle: { remove: () => void } | null = null;

    (async () => {
      try {
        const { Capacitor } = await import('@capacitor/core');
        if (!Capacitor.isNativePlatform()) return;
        const { App } = await import('@capacitor/app');
        if (unmounted) return;

        const handle = await App.addListener('backButton', async () => {
          const path = locationRef.current;

          const HAS_OWN_HANDLER = ['/diaries/new'];
          if (
            HAS_OWN_HANDLER.includes(path) ||
            /^\/diaries\/[^/]+\/edit$/.test(path) ||
            path.startsWith('/payment')
          ) {
            return;
          }

          const EXIT_ROUTES = new Set([
            '/home', '/splash', '/login', '/signup', '/forgot-password',
          ]);

          if (EXIT_ROUTES.has(path)) {
            const now = Date.now();
            if (now - lastBackPressRef.current < 2000) {
              try { await App.exitApp(); } catch {}
            } else {
              lastBackPressRef.current = now;
              try {
                const { Toast } = await import('@capacitor/toast');
                await Toast.show({ text: '한 번 더 누르면 앱이 종료됩니다', duration: 'short' });
              } catch {}
            }
            return;
          }

          navigate('/home');
        });
        if (unmounted) handle.remove(); else backHandle = handle;
      } catch {}
    })();

    return () => {
      unmounted = true;
      if (backHandle) backHandle.remove();
    };
  }, [navigate]);

  useEffect(() => {
    let unmounted = false;
    let appHandle: { remove: () => void } | null = null;

    const handlePaymentResult = async (rawUrl: string) => {
      try {
        if (!rawUrl.startsWith('com.teum.app://payment-result')) return;
        const u = new URL(rawUrl);
        const status = u.searchParams.get('status') || 'success';
        const message = u.searchParams.get('message') || '';
        try {
          const { Browser } = await import('@capacitor/browser');
          await Browser.close().catch(() => {});
        } catch {}
        if (status === 'success') {
          navigate('/payment/success', { replace: true });
        } else {
          navigate(`/payment/fail?message=${encodeURIComponent(message)}`, { replace: true });
        }
      } catch {
      }
    };

    (async () => {
      try {
        const { Capacitor } = await import('@capacitor/core');
        if (!Capacitor.isNativePlatform()) return;
        const { App } = await import('@capacitor/app');
        if (unmounted) return;
        const handle = await App.addListener('appUrlOpen', (event) => {
          if (!unmounted) handlePaymentResult(event.url);
        });
        if (unmounted) handle.remove(); else appHandle = handle;
      } catch {}
    })();

    return () => {
      unmounted = true;
      if (appHandle) appHandle.remove();
    };
  }, [navigate]);
  
  const isEditRoute = location.pathname.match(/^\/diaries\/[^/]+\/edit$/);
  const isDetailRoute = location.pathname.match(/^\/diaries\/[^/]+$/);
  const shouldHideTabBar =
    hideTabBar ||
    AUTH_ROUTES.includes(location.pathname) ||
    HIDE_TAB_BAR_ROUTES.some((route) => location.pathname.startsWith(route)) ||
    isEditRoute ||
    isDetailRoute;
  
  const showTabBar = !shouldHideTabBar;

  return (
    <div className="min-h-screen bg-white">
      <main className={`${showTabBar ? 'pb-20' : ''} ${isTabSwitch ? '' : 'animate-page-in'}`}>{children}</main>
      {showTabBar && <BottomTabBar />}
      <DiaryTypeModal />
    </div>
  );
}

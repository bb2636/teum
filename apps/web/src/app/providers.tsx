import { ReactNode, useEffect, useRef } from 'react';
import { BottomTabBar } from '../components/navigation/BottomTabBar';
import { DiaryTypeModal } from '../components/DiaryTypeModal';
import { useLocation } from 'react-router-dom';
import { useHideTabBar } from '../contexts/HideTabBarContext';

const AUTH_ROUTES = ['/splash', '/login', '/signup', '/forgot-password', '/social-onboarding', '/mobile-login-complete', '/login-redirect'];
const HIDE_TAB_BAR_ROUTES = ['/diaries/new', '/folders/new', '/admin', '/my/profile-edit', '/my/payment-history', '/my/support/inquiry', '/payment', '/payment/success', '/music/create', '/music/jobs', '/music/list'];
const TAB_ROUTES = new Set(['/home', '/calendar', '/music']);

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
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

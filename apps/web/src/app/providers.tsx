import { ReactNode, useEffect } from 'react';
import { BottomTabBar } from '../components/navigation/BottomTabBar';
import { DiaryTypeModal } from '../components/DiaryTypeModal';
import { useLocation } from 'react-router-dom';
import { useHideTabBar } from '../contexts/HideTabBarContext';
import { usePushNotifications } from '../hooks/usePushNotifications';

const AUTH_ROUTES = ['/splash', '/login', '/signup', '/forgot-password', '/social-onboarding'];
const HIDE_TAB_BAR_ROUTES = ['/diaries/new', '/folders/new', '/admin', '/my/profile-edit', '/my/payment-history', '/my/support/inquiry', '/payment', '/payment/success', '/music/create', '/music/jobs', '/music/list'];

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const { hideTabBar } = useHideTabBar();
  usePushNotifications();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);
  
  // Check if current route should hide tab bar
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
      <main key={location.pathname} className={`${showTabBar ? 'pb-20' : ''} animate-page-in`}>{children}</main>
      {showTabBar && <BottomTabBar />}
      <DiaryTypeModal />
    </div>
  );
}

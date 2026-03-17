import { ReactNode } from 'react';
import { BottomTabBar } from '../components/navigation/BottomTabBar';
import { useLocation } from 'react-router-dom';
import { useHideTabBar } from '../contexts/HideTabBarContext';

const AUTH_ROUTES = ['/splash', '/login', '/signup', '/forgot-password'];
const HIDE_TAB_BAR_ROUTES = ['/diaries/new', '/folders/new', '/admin', '/my/profile-edit'];

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const { hideTabBar } = useHideTabBar();
  const showTabBar =
    !hideTabBar &&
    !AUTH_ROUTES.includes(location.pathname) &&
    !HIDE_TAB_BAR_ROUTES.some((route) => location.pathname.startsWith(route));

  return (
    <div className="min-h-screen bg-background">
      <main className={showTabBar ? 'pb-20' : ''}>{children}</main>
      {showTabBar && <BottomTabBar />}
    </div>
  );
}

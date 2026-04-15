import { Link, useLocation } from 'react-router-dom';
import { Home, Calendar, Music, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRef, useEffect, useCallback } from 'react';
import { useT } from '@/hooks/useTranslation';
import { useTheme } from '@/contexts/ThemeContext';
import { queryClient } from '@/lib/queryClient';
import { apiRequest } from '@/lib/api';

const mainTabs = [
  { path: '/home', labelKey: 'tab.home', icon: Home },
  { path: '/calendar', labelKey: 'tab.calendar', icon: Calendar },
  { path: '/music', labelKey: 'tab.music', icon: Music },
];

const prefetchMap: Record<string, () => void> = {
  '/home': () => {
    queryClient.prefetchQuery({
      queryKey: ['diaries', 'recent'],
      queryFn: () => apiRequest<{ data: unknown }>('/diaries?limit=10').then((r) => r.data),
      staleTime: 1000 * 60 * 5,
    });
  },
  '/calendar': () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    queryClient.prefetchQuery({
      queryKey: ['diaries', 'monthly', year, month],
      queryFn: () => apiRequest<{ data: unknown }>(`/diaries?year=${year}&month=${month}`).then((r) => r.data),
      staleTime: 1000 * 60 * 5,
    });
  },
  '/music': () => {
    queryClient.prefetchInfiniteQuery({
      queryKey: ['music', 'jobs'],
      queryFn: ({ pageParam }) =>
        apiRequest<{ data: { nextOffset?: number } }>(`/music/jobs?limit=20&offset=${pageParam}`).then((r) => r.data),
      initialPageParam: 0,
      getNextPageParam: (lastPage: { nextOffset?: number }) => lastPage?.nextOffset ?? undefined,
      staleTime: 1000 * 60 * 5,
      pages: 1,
    });
  },
};

export function BottomTabBar() {
  const t = useT();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const location = useLocation();
  const prevPathRef = useRef(location.pathname);
  const activeTabRef = useRef<HTMLDivElement | null>(null);

  const handleTabHover = useCallback((path: string) => {
    const prefetch = prefetchMap[path];
    if (prefetch) prefetch();
  }, []);

  useEffect(() => {
    if (prevPathRef.current !== location.pathname && activeTabRef.current) {
      activeTabRef.current.classList.remove('animate-tab-bounce');
      void activeTabRef.current.offsetWidth;
      activeTabRef.current.classList.add('animate-tab-bounce');
    }
    prevPathRef.current = location.pathname;
  }, [location.pathname]);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-transparent bottom-tab-bar" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <div className="max-w-md mx-auto px-4 pb-2 relative">
        <div className="flex items-end justify-center relative">
          {location.pathname !== '/music' && location.pathname !== '/my' && (
            <div className="absolute bottom-20 right-4 z-50">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  window.dispatchEvent(new CustomEvent('openDiaryTypeModal'));
                }}
                className="w-14 h-14 rounded-full bg-[#4A2C1A] hover:bg-[#3A2010] text-white shadow-lg flex items-center justify-center transition-colors"
              >
                <Plus className="w-6 h-6" />
              </button>
            </div>
          )}

          <div className="flex items-center justify-center relative h-16 w-full">
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background: isDark
                  ? 'linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 40%, rgba(255,255,255,0.08) 100%)'
                  : 'linear-gradient(180deg, rgba(0,0,0,0.08) 0%, rgba(0,0,0,0.03) 40%, rgba(0,0,0,0.08) 100%)',
                padding: '1.5px',
                boxShadow: isDark
                  ? '0 2px 12px rgba(0,0,0,0.4), 0 0 4px rgba(0,0,0,0.2)'
                  : '0 2px 12px rgba(0,0,0,0.08), 0 0 4px rgba(0,0,0,0.04)',
              }}
            >
              <div className="w-full h-full bg-white rounded-full" />
            </div>
            <div className="flex items-center justify-around w-full relative z-10 px-2">
              {mainTabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = location.pathname === tab.path;

                return (
                  <Link
                    key={tab.path}
                    to={tab.path}
                    onTouchStart={() => handleTabHover(tab.path)}
                    onMouseEnter={() => handleTabHover(tab.path)}
                    className={cn(
                      'flex flex-col items-center justify-center flex-1 transition-colors relative py-2 px-3 rounded-full'
                    )}
                  >
                    {isActive && (
                      <div className="absolute inset-0 bg-gray-200 rounded-full"></div>
                    )}
                    <div
                      ref={isActive ? activeTabRef : undefined}
                      className="relative z-10 flex flex-col items-center justify-center"
                    >
                      <Icon className={cn('w-6 h-6 mb-1', isActive ? 'text-[#4A2C1A]' : 'text-gray-400')} />
                      <span className={cn('text-xs font-medium', isActive ? 'text-[#4A2C1A]' : 'text-gray-400')}>
                        {t(tab.labelKey)}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}

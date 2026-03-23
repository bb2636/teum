import { Link, useLocation } from 'react-router-dom';
import { Home, Calendar, Music, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRef, useEffect } from 'react';

const mainTabs = [
  { path: '/home', label: '홈', icon: Home },
  { path: '/calendar', label: '캘린더', icon: Calendar },
  { path: '/music', label: '음악 생성', icon: Music },
];

export function BottomTabBar() {
  const location = useLocation();
  const prevPathRef = useRef(location.pathname);
  const activeTabRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (prevPathRef.current !== location.pathname && activeTabRef.current) {
      activeTabRef.current.classList.remove('animate-tab-bounce');
      void activeTabRef.current.offsetWidth;
      activeTabRef.current.classList.add('animate-tab-bounce');
    }
    prevPathRef.current = location.pathname;
  }, [location.pathname]);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 pb-safe bg-transparent">
      <div className="max-w-md mx-auto px-4 relative" style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom, 0px))' }}>
        <div className="flex items-end justify-center h-20 relative">
          {location.pathname !== '/music' && location.pathname !== '/my' && (
            <div className="absolute bottom-20 right-4 z-50">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  window.dispatchEvent(new CustomEvent('openDiaryTypeModal'));
                }}
                className="w-14 h-14 rounded-full bg-[#665146] hover:bg-[#5A453A] text-white shadow-lg flex items-center justify-center transition-colors"
              >
                <Plus className="w-6 h-6" />
              </button>
            </div>
          )}

          <div className="flex items-center justify-center relative h-16 w-full">
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background: 'linear-gradient(180deg, rgba(0,0,0,0.08) 0%, rgba(0,0,0,0.03) 40%, rgba(0,0,0,0.08) 100%)',
                padding: '1.5px',
                boxShadow: '0 2px 12px rgba(0,0,0,0.08), 0 0 4px rgba(0,0,0,0.04)',
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
                        {tab.label}
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

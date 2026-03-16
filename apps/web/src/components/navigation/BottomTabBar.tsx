import { Link, useLocation } from 'react-router-dom';
import { Home, Calendar, Music } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMe } from '@/hooks/useProfile';

const mainTabs = [
  { path: '/home', label: '홈', icon: Home },
  { path: '/calendar', label: '캘린더', icon: Calendar },
  { path: '/music', label: '음악 생성', icon: Music },
];

export function BottomTabBar() {
  const location = useLocation();
  const { data: user } = useMe();
  const profilePath = '/my';

  const isProfileActive = location.pathname === profilePath;

  // Get user initial for default avatar
  const getUserInitial = () => {
    if (user?.profile?.name) {
      return user.profile.name.charAt(0).toUpperCase();
    }
    if (user?.profile?.nickname) {
      return user.profile.nickname.charAt(0).toUpperCase();
    }
    if (user?.email) {
      return user.email.charAt(0).toUpperCase();
    }
    return 'U';
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 pb-safe">
      <div className="flex items-center justify-around h-16 max-w-md mx-auto px-4" style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom, 0px))' }}>
        {/* Main tabs grouped in oval with shadow */}
        <div className="flex items-center justify-center flex-[3] relative">
          <div className="absolute inset-0 bg-gray-100 rounded-full shadow-md"></div>
          <div className="flex items-center justify-around w-full relative z-10 px-2">
            {mainTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = location.pathname === tab.path;

              return (
                <Link
                  key={tab.path}
                  to={tab.path}
                  className={cn(
                    'flex flex-col items-center justify-center flex-1 transition-colors relative py-2 px-3'
                  )}
                >
                  {isActive && (
                    <div className="absolute inset-0 bg-gray-200 rounded-full"></div>
                  )}
                  <div className="relative z-10 flex flex-col items-center justify-center">
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

        {/* Profile tab (separate) */}
        <Link
          to={profilePath}
          className={cn(
            'flex flex-col items-center justify-center flex-1 transition-colors',
            isProfileActive ? 'text-[#4A2C1A]' : 'text-gray-400'
          )}
        >
          {user?.profile?.profileImageUrl ? (
            <img
              src={user.profile.profileImageUrl}
              alt="Profile"
              className="w-6 h-6 mb-1 rounded-full object-cover"
            />
          ) : (
            <div className="w-6 h-6 mb-1 rounded-full bg-[#4A2C1A] flex items-center justify-center">
              <span className="text-white text-xs font-medium">
                {getUserInitial()}
              </span>
            </div>
          )}
          <span className={cn('text-xs font-medium', isProfileActive ? 'text-[#4A2C1A]' : 'text-gray-400')}>
            프로필
          </span>
        </Link>
      </div>
    </nav>
  );
}

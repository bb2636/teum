import { Link } from 'react-router-dom';
import { useMe } from '@/hooks/useProfile';

export function ProfileButton() {
  const { data: user } = useMe();

  const getUserInitial = () => {
    if (user?.profile?.nickname) {
      return user.profile.nickname.charAt(0).toUpperCase();
    }
    if (user?.profile?.name) {
      return user.profile.name.charAt(0).toUpperCase();
    }
    if (user?.email) {
      return user.email.charAt(0).toUpperCase();
    }
    return 'U';
  };

  return (
    <Link
      to="/my"
      className="w-9 h-9 rounded-full bg-[#4A2C1A] flex items-center justify-center flex-shrink-0"
    >
      <span className="text-white text-sm font-medium">
        {getUserInitial()}
      </span>
    </Link>
  );
}

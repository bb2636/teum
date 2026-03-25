import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '@/lib/api';
import { setLanguageFromCountry } from '@/lib/i18n';

export interface User {
  id: string;
  email: string;
  role: string;
  profile?: {
    nickname?: string;
    name?: string;
    profileImageUrl?: string;
    country?: string;
  };
}

export function useLogin() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { email: string; password: string }) => {
      const response = await apiRequest<{ data: { user: User } }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return response.data.user;
    },
    onSuccess: (user) => {
      sessionStorage.removeItem('teum_logged_out');
      queryClient.clear();
      if (user.role === 'admin') {
        navigate('/admin');
      } else {
        navigate('/home');
      }
    },
  });
}

export function useSignup() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      email: string;
      password: string;
      nickname: string;
      name: string;
      phone?: string;
      dateOfBirth?: string;
      profileImageUrl?: string;
      termsConsents: Array<{ termsType: string; consented: boolean }>;
    }) => {
      const response = await apiRequest<{ data: { user: User } }>('/auth/signup', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return response.data.user;
    },
    onSuccess: (user) => {
      sessionStorage.removeItem('teum_logged_out');
      queryClient.clear();
      
      // 사용자 프로필의 국가 정보로 언어 설정
      if (user?.profile?.country) {
        setLanguageFromCountry(user.profile.country);
      }
      
      navigate('/home');
    },
  });
}

export function useLogout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      try {
        const { unregisterPushNotifications } = await import('@/lib/push-notifications');
        await unregisterPushNotifications();
      } catch {
        // ignore push unregister failure
      }
      try {
        await apiRequest('/auth/logout', {
          method: 'POST',
        });
      } catch {
        // ignore server logout failure
      }
    },
    onSettled: () => {
      sessionStorage.setItem('teum_logged_out', '1');
      queryClient.setQueryData(['user', 'me'], null);
      queryClient.removeQueries({ queryKey: ['user', 'me'] });
      queryClient.clear();
      navigate('/splash', { replace: true });
    },
  });
}
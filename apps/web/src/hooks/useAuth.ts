import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '@/lib/api';

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
    onMutate: () => {
      queryClient.getQueryCache().clear();
    },
    mutationFn: async (data: { email: string; password: string }) => {
      const response = await apiRequest<{ data: { user: User } }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return response.data.user;
    },
    onSuccess: (user) => {
      sessionStorage.removeItem('teum_logged_out');
      queryClient.getQueryCache().clear();
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
    onSuccess: () => {
      sessionStorage.removeItem('teum_logged_out');
      queryClient.getQueryCache().clear();
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
      try {
        if (window.google?.accounts?.id) {
          window.google.accounts.id.disableAutoSelect();
        }
      } catch {}
      sessionStorage.setItem('teum_logged_out', '1');
      queryClient.setQueryData(['user', 'me'], null);
      queryClient.removeQueries({ queryKey: ['user', 'me'] });
      queryClient.clear();
      navigate('/splash', { replace: true });
    },
  });
}
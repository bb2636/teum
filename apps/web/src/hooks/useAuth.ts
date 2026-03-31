import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';
import { forceFullCacheClear } from '@/lib/queryClient';

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
  const queryClient = useQueryClient();

  return useMutation({
    onMutate: () => {
      forceFullCacheClear();
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
      localStorage.clear();
      forceFullCacheClear();
      if (user.role === 'admin') {
        window.location.href = '/admin';
      } else {
        window.location.href = '/home';
      }
    },
  });
}

export function useSignup() {
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
      localStorage.clear();
      forceFullCacheClear();
      window.location.href = '/home';
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      try {
        const { unregisterPushNotifications } = await import('@/lib/push-notifications');
        await unregisterPushNotifications();
      } catch {
      }
      try {
        await apiRequest('/auth/logout', {
          method: 'POST',
        });
      } catch {
      }
    },
    onSettled: () => {
      try {
        if (window.google?.accounts?.id) {
          window.google.accounts.id.disableAutoSelect();
        }
      } catch {}
      sessionStorage.setItem('teum_logged_out', '1');
      localStorage.clear();
      forceFullCacheClear();
      window.location.href = '/splash';
    },
  });
}

import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';
import { forceFullCacheClear } from '@/lib/queryClient';
import type { User } from './useAuth';

export interface SocialProfile {
  provider: 'google' | 'apple';
  providerAccountId: string;
  email: string;
  name: string;
  picture?: string;
  isEmailHidden?: boolean;
}

export function useGoogleLogin() {
  return useMutation({
    onMutate: () => {
      forceFullCacheClear();
    },
    mutationFn: async (idToken: string) => {
      const response = await apiRequest<{
        data: {
          isNewUser: boolean;
          onboardingToken?: string;
          user?: User;
          socialProfile?: SocialProfile;
        };
      }>('/auth/google/login', {
        method: 'POST',
        body: JSON.stringify({ idToken }),
      });
      return response.data;
    },
    onSuccess: (data) => {
      localStorage.clear();
      forceFullCacheClear();
      if (!data.isNewUser) {
        sessionStorage.removeItem('teum_logged_out');
      }
    },
  });
}

export function useAppleLogin() {
  return useMutation({
    onMutate: () => {
      forceFullCacheClear();
    },
    mutationFn: async (data: {
      idToken: string;
      authorizationCode?: string;
      user?: {
        email?: string;
        name?: { firstName?: string; lastName?: string };
      };
    }) => {
      const response = await apiRequest<{
        data: {
          isNewUser: boolean;
          onboardingToken?: string;
          user?: User;
          socialProfile?: SocialProfile;
        };
      }>('/auth/apple/login', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return response.data;
    },
    onSuccess: (data) => {
      localStorage.clear();
      forceFullCacheClear();
      if (!data.isNewUser) {
        sessionStorage.removeItem('teum_logged_out');
      }
    },
  });
}

export function useSocialOnboarding() {
  return useMutation({
    mutationFn: async (data: {
      onboardingToken: string;
      email?: string;
      nickname: string;
      name: string;
      dateOfBirth?: string;
      phone?: string;
      termsConsents: Array<{ termsType: string; consented: boolean }>;
    }) => {
      const response = await apiRequest<{ data: { user: User } }>('/auth/social/onboarding', {
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

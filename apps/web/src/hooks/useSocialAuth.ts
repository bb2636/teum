import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '@/lib/api';
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
  });
}

export function useAppleLogin() {
  return useMutation({
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
  });
}

export function useSocialOnboarding() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

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
      queryClient.clear();
      navigate('/home');
    },
  });
}

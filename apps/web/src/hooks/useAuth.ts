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
    onSuccess: () => {
      // Clear all cache on login
      queryClient.clear();
      navigate('/home');
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
      country?: string;
      termsConsents: Array<{ termsType: string; consented: boolean }>;
    }) => {
      const response = await apiRequest<{ data: { user: User } }>('/auth/signup', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return response.data.user;
    },
    onSuccess: () => {
      // Clear all cache on signup
      queryClient.clear();
      navigate('/home');
    },
  });
}

export function useLogout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      await apiRequest('/auth/logout', {
        method: 'POST',
      });
    },
    onSuccess: () => {
      // Clear all cache and cookies
      queryClient.clear();
      navigate('/login');
    },
  });
}

export function useMe() {
  const queryClient = useQueryClient();

  return {
    refetch: async () => {
      try {
        const response = await apiRequest<{ data: { user: User } }>('/users/me');
        queryClient.setQueryData(['user', 'me'], response.data.user);
        return response.data.user;
      } catch (error) {
        queryClient.setQueryData(['user', 'me'], null);
        throw error;
      }
    },
  };
}

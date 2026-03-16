import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';

export function useRequestPasswordReset() {
  return useMutation({
    mutationFn: async (email: string) => {
      const response = await apiRequest<{
        success: boolean;
        message: string;
        token?: string;
        resetLink?: string;
      }>('/password-reset/request', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      return response;
    },
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: async (data: { token: string; password: string }) => {
      await apiRequest('/password-reset/reset', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
  });
}

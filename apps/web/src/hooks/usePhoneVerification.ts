import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';

export function useRequestPhoneVerification() {
  return useMutation({
    mutationFn: async (phone: string) => {
      const response = await apiRequest<{
        data: { message: string; expiresIn: number; code?: string };
      }>('/auth/phone/request', {
        method: 'POST',
        body: JSON.stringify({ phone }),
      });
      return { ...response.data, phone };
    },
  });
}

export function useConfirmPhoneVerification() {
  return useMutation({
    mutationFn: async (data: { phone: string; code: string }) => {
      const response = await apiRequest<{
        data: { message: string; verified: boolean };
      }>('/auth/phone/confirm', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return response.data;
    },
  });
}

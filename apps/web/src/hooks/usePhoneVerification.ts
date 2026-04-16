import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';

export function useRequestPhoneVerification() {
  return useMutation({
    mutationFn: async (data: { phone: string; countryCode?: string }) => {
      const response = await apiRequest<{
        data: { message: string; expiresIn: number; code?: string };
      }>('/auth/phone/request', {
        method: 'POST',
        body: JSON.stringify({ phone: data.phone, countryCode: data.countryCode }),
      });
      return { ...response.data, phone: data.phone };
    },
  });
}

export function useConfirmPhoneVerification() {
  return useMutation({
    mutationFn: async (data: { phone: string; code: string; countryCode?: string }) => {
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

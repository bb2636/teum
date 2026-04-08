import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';

export function useEmailCheck(email: string, enabled: boolean = false) {
  return useQuery({
    queryKey: ['email-check', email],
    queryFn: async () => {
      const response = await apiRequest<{ data: { available: boolean; reason?: string } }>(
        `/users/check-email?email=${encodeURIComponent(email)}`
      );
      return response.data;
    },
    enabled: enabled && email.length > 0,
    staleTime: 0,
  });
}

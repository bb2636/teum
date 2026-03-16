import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';

export function useNicknameCheck(nickname: string, enabled: boolean = false) {
  return useQuery({
    queryKey: ['nickname-check', nickname],
    queryFn: async () => {
      const response = await apiRequest<{ data: { available: boolean; reason?: string } }>(
        `/users/check-nickname?nickname=${encodeURIComponent(nickname)}`
      );
      return response.data;
    },
    enabled: enabled && nickname.length >= 2 && nickname.length <= 12,
    staleTime: 0, // Always check fresh
  });
}

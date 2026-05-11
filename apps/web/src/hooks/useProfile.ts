import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest, NETWORK_ERROR_CODE } from '@/lib/api';
import { onUserChanged } from '@/lib/queryClient';

export interface UserProfile {
  id: string;
  userId: string;
  nickname?: string;
  name?: string;
  phone?: string;
  phoneVerified: boolean;
  dateOfBirth?: string;
  profileImageUrl?: string;
  language?: string;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  email: string;
  role: string;
  profile?: UserProfile;
}

export interface UpdateProfileInput {
  nickname?: string;
  name?: string;
  phone?: string;
  dateOfBirth?: string;
  profileImageUrl?: string;
  language?: string;
}

export function useMe() {
  return useQuery<User | null>({
    queryKey: ['user', 'me'],
    queryFn: async () => {
      try {
        // 8초 타임아웃 — 네트워크/서버 지연 시 무한 로딩 방지
        const response = await apiRequest<{ data: { user: User } }>('/users/me', {
          timeoutMs: 8000,
        });
        const user = response.data.user;
        if (user) {
          onUserChanged(user.id);
        }
        return user;
      } catch (err) {
        // 네트워크 에러는 throw 하여 UI 에서 재시도 화면 표시
        if (err && typeof err === 'object' && 'code' in err && err.code === NETWORK_ERROR_CODE) {
          throw err;
        }
        // 인증 실패(401 등)는 비로그인 상태로 간주
        return null;
      }
    },
    // 네트워크 에러 한 번 더 자동 재시도 후 사용자에게 노출
    retry: (failureCount, error) => {
      const isNetwork =
        error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === NETWORK_ERROR_CODE;
      return isNetwork && failureCount < 1;
    },
    retryDelay: 1500,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
}

// Update profile
export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateProfileInput) => {
      const response = await apiRequest<{ data: { profile: UserProfile } }>(
        '/users/profile',
        {
          method: 'PUT',
          body: JSON.stringify(data),
        }
      );
      return response.data.profile;
    },
    onSuccess: async (updatedProfile) => {
      queryClient.setQueryData(['user', 'me'], (old: Record<string, unknown> | undefined) => {
        if (!old) return old;
        const oldProfile = (old.profile ?? {}) as Record<string, unknown>;
        return {
          ...old,
          profile: { ...oldProfile, ...updatedProfile },
        };
      });
      await queryClient.invalidateQueries({ queryKey: ['user', 'me'] });
    },
  });
}

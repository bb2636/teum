import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';

export interface UserProfile {
  id: string;
  userId: string;
  nickname?: string;
  name?: string;
  phone?: string;
  phoneVerified: boolean;
  dateOfBirth?: string;
  profileImageUrl?: string;
  country?: string;
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
  country?: string;
}

// Get current user with profile (공유 queryKey로 /users/me 한 번만 호출, 401 시 null 반환)
export function useMe() {
  return useQuery<User | null>({
    queryKey: ['user', 'me'],
    queryFn: async () => {
      try {
        const response = await apiRequest<{ data: { user: User } }>('/users/me');
        return response.data.user;
      } catch {
        return null;
      }
    },
    retry: false,
    staleTime: 1000 * 60 * 5, // 5 minutes
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user', 'me'] });
    },
  });
}

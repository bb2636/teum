import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';
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
  country?: string;
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
  country?: string;
  language?: string;
}

export function useMe() {
  return useQuery<User | null>({
    queryKey: ['user', 'me'],
    queryFn: async () => {
      try {
        const response = await apiRequest<{ data: { user: User } }>('/users/me');
        const user = response.data.user;
        if (user) {
          onUserChanged(user.id);
        }
        return user;
      } catch {
        return null;
      }
    },
    retry: false,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
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
      queryClient.setQueryData(['user', 'me'], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          profile: { ...old.profile, ...updatedProfile },
        };
      });
      await queryClient.invalidateQueries({ queryKey: ['user', 'me'] });
    },
  });
}

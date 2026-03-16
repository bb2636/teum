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

// Get current user with profile
export function useMe() {
  return useQuery<User>({
    queryKey: ['me'],
    queryFn: async () => {
      const response = await apiRequest<{ data: { user: User } }>('/users/me');
      return response.data.user;
    },
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
      queryClient.invalidateQueries({ queryKey: ['me'] });
    },
  });
}

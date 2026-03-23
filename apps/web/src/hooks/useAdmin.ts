import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';

export interface AdminUser {
  id: string;
  email: string;
  role: string;
  createdAt: string;
  deletedAt?: string | null;
  profile?: {
    nickname?: string;
    name?: string;
    dateOfBirth?: string;
    profileImageUrl?: string;
  };
  hasActiveSubscription: boolean;
  isActive: boolean;
  isWithdrawn: boolean;
  status: 'active' | 'suspended' | 'withdrawn';
}

export function useAllUsers() {
  return useQuery<AdminUser[]>({
    queryKey: ['admin', 'users'],
    queryFn: async () => {
      const response = await apiRequest<{ data: { users: AdminUser[] } }>('/users/all');
      return response.data.users;
    },
  });
}

export interface Payment {
  id: string;
  userId: string;
  subscriptionId?: string | null;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  amount: string;
  currency: string;
  paymentMethod?: string | null;
  transactionId?: string | null;
  paidAt?: string | null;
  createdAt: string;
  updatedAt: string;
  subscription?: {
    id: string;
    status: 'active' | 'cancelled' | 'expired' | 'pending';
    planName: string;
    startDate: string;
    endDate?: string | null;
    cancelledAt?: string | null;
  } | null;
}

export function useUserPayments(userId: string | null) {
  return useQuery<Payment[]>({
    queryKey: ['admin', 'user-payments', userId],
    queryFn: async () => {
      if (!userId) return [];
      const response = await apiRequest<{ data: { payments: Payment[] } }>(`/users/${userId}/payments`);
      return response.data.payments;
    },
    enabled: !!userId,
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (userId: string) => {
      await apiRequest(`/users/${userId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });
}

export function useUpdateUserStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, isActive }: { userId: string; isActive: boolean }) => {
      const response = await apiRequest<{ data: { user: { id: string; email: string; isActive: boolean } } }>(`/users/${userId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ isActive }),
      });
      return response.data.user;
    },
    onSuccess: (updatedUser) => {
      if (!updatedUser?.id) return;
      queryClient.setQueryData<AdminUser[]>(['admin', 'users'], (prev) => {
        if (!Array.isArray(prev)) return prev;
        return prev.map((u) =>
          u.id === updatedUser.id ? { ...u, isActive: Boolean(updatedUser.isActive) } : u
        );
      });
    },
  });
}

export interface AdminDiary {
  id: string;
  userId: string;
  type: 'free_form' | 'question_based';
  title?: string | null;
  content?: string | null;
  date: string;
  folderId?: string | null;
  folder?: {
    id: string;
    name: string;
  } | null;
  images?: Array<{
    id: string;
    imageUrl: string;
    order: number;
  }>;
  answers?: Array<{
    id: string;
    answer: string;
    question?: {
      id: string;
      question: string;
    } | null;
  }>;
  user?: {
    id: string;
    email: string;
    profile?: {
      nickname?: string;
      name?: string;
      profileImageUrl?: string;
    } | null;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export function useAllDiaries() {
  return useQuery<AdminDiary[]>({
    queryKey: ['admin', 'diaries'],
    queryFn: async () => {
      const response = await apiRequest<{ data: { diaries: AdminDiary[] } }>('/diaries/all');
      return response.data.diaries;
    },
  });
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';

export interface Payment {
  id: string;
  userId: string;
  subscriptionId?: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  amount: number;
  currency: string;
  paymentMethod?: string;
  transactionId?: string;
  paidAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Subscription {
  id: string;
  userId: string;
  status: 'active' | 'cancelled' | 'expired' | 'pending';
  planName: string;
  amount: number;
  currency: string;
  startDate: string;
  endDate?: string;
  cancelledAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProcessPaymentInput {
  amount: number;
  planName: string;
  paymentMethod: 'card' | 'easy_pay' | 'bank_transfer';
  cardCompany?: string;
  easyPayProvider?: 'toss' | 'npay' | 'apple';
}

export interface ProcessPaymentResponse {
  success: boolean;
  payment: Payment;
  subscription?: Subscription;
  message?: string;
}

// Process payment
export function useProcessPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: ProcessPaymentInput) => {
      const response = await apiRequest<{ data: ProcessPaymentResponse }>(
        '/payments/process',
        {
          method: 'POST',
          body: JSON.stringify(data),
        }
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['music', 'jobs'] });
      queryClient.invalidateQueries({ queryKey: ['me'] }); // 유저 정보도 업데이트
      queryClient.invalidateQueries({ queryKey: ['users'] }); // 관리자 화면 유저 목록도 업데이트
      // 즉시 refetch하여 구독 정보 반영
      queryClient.refetchQueries({ queryKey: ['subscriptions'] });
      queryClient.refetchQueries({ queryKey: ['music', 'jobs'] });
    },
  });
}

// Get user subscriptions
export function useSubscriptions() {
  return useQuery<Subscription[]>({
    queryKey: ['subscriptions'],
    queryFn: async () => {
      const response = await apiRequest<{ data: { subscriptions: Subscription[] } }>(
        '/payments/subscriptions'
      );
      return response.data.subscriptions;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnMount: 'always',
  });
}

// Get user payments
export function usePayments() {
  return useQuery<Payment[]>({
    queryKey: ['payments'],
    queryFn: async () => {
      const response = await apiRequest<{ data: { payments: Payment[] } }>(
        '/payments'
      );
      return response.data.payments;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

// Cancel subscription
export function useCancelSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (subscriptionId: string) => {
      const response = await apiRequest<{ data: { success: boolean; message: string } }>(
        '/payments/subscriptions/cancel',
        {
          method: 'POST',
          body: JSON.stringify({ subscriptionId }),
        }
      );
      return response.data;
    },
    onSuccess: (_data, subscriptionId) => {
      queryClient.setQueryData<Subscription[]>(['subscriptions'], (old) => {
        if (!old) return old;
        return old.map((s) =>
          s.id === subscriptionId
            ? { ...s, status: 'cancelled' as const, cancelledAt: new Date().toISOString() }
            : s
        );
      });
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['music', 'jobs'] });
      queryClient.invalidateQueries({ queryKey: ['me'] });
      queryClient.refetchQueries({ queryKey: ['music', 'jobs'] });
      queryClient.refetchQueries({ queryKey: ['subscriptions'] });
    },
  });
}

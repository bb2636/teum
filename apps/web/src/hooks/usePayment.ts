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
      // Invalidate subscriptions and payments queries
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
    },
  });
}

// Get user subscriptions
export function useSubscriptions() {
  return useQuery<Subscription[]>({
    queryKey: ['subscriptions'],
    queryFn: async () => {
      const response = await apiRequest<{ data: { subscriptions: Subscription[] } }>(
        '/subscriptions'
      );
      return response.data.subscriptions;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
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

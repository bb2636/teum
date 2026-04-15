import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';

export interface PlanPrice {
  usd: number;
  krw: number;
  rate: number;
}

export function usePlanPrice() {
  return useQuery<PlanPrice>({
    queryKey: ['plan-price'],
    queryFn: async () => {
      const res = await fetch('/api/payments/plan-price');
      const data = await res.json();
      if (!data.success) throw new Error('Failed to fetch plan price');
      return data.data;
    },
    staleTime: 6 * 60 * 60 * 1000,
  });
}

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
  paymentMethod: string;
  cardCompany?: string;
  cardCode?: string;
}

export interface ProcessPaymentResponse {
  success: boolean;
  payment: Payment;
  subscription?: Subscription;
  message?: string;
}

export interface InitPaymentInput {
  planName: string;
  paymentMethod: string;
}

export interface InitPaymentResponse {
  clientId: string;
  orderId: string;
  amount: number;
  goodsName: string;
  method: string;
  returnUrl: string;
  isTestMode: boolean;
}

export interface InitBillingKeyInput {
  planName: string;
  paymentMethod: string;
  identityVerified?: boolean;
}

export interface InitBillingKeyResponse {
  clientId: string;
  orderId: string;
  amount: number;
  method: string;
  returnUrl: string;
  isTestMode: boolean;
}

export function useInitPayment() {
  return useMutation({
    mutationFn: async (data: InitPaymentInput) => {
      const response = await apiRequest<{ data: InitPaymentResponse }>(
        '/payments/init',
        {
          method: 'POST',
          body: JSON.stringify(data),
        }
      );
      return response.data;
    },
  });
}

export function useInitBillingKey() {
  return useMutation({
    mutationFn: async (data: InitBillingKeyInput) => {
      const response = await apiRequest<{ data: InitBillingKeyResponse }>(
        '/payments/billing/init',
        {
          method: 'POST',
          body: JSON.stringify(data),
        }
      );
      return response.data;
    },
  });
}

export function useNeedsVerification() {
  return useQuery<boolean>({
    queryKey: ['needs-verification'],
    queryFn: async () => {
      const response = await apiRequest<{ data: { needsVerification: boolean } }>(
        '/payments/needs-verification'
      );
      return response.data.needsVerification;
    },
    staleTime: 1000 * 60 * 5,
  });
}

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
      queryClient.invalidateQueries({ queryKey: ['user', 'me'] });
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
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 60,
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
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 60,
  });
}

export function getEffectiveSubscription(subscriptions: Subscription[]): Subscription | undefined {
  const now = new Date();
  const active = subscriptions.find((s) => s.status === 'active');
  if (active) return active;
  return subscriptions.find(
    (s) => s.status === 'cancelled' && s.endDate && new Date(s.endDate) >= now
  );
}

export interface InitPayPalResponse {
  approveUrl: string;
  orderId: string;
  paypalSubscriptionId: string;
}

export function useInitPayPal() {
  return useMutation({
    mutationFn: async () => {
      const response = await apiRequest<{ data: InitPayPalResponse }>(
        '/payments/paypal/init',
        {
          method: 'POST',
        }
      );
      return response.data;
    },
  });
}

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
      queryClient.invalidateQueries({ queryKey: ['user', 'me'] });
      queryClient.refetchQueries({ queryKey: ['music', 'jobs'] });
      queryClient.refetchQueries({ queryKey: ['subscriptions'] });
    },
  });
}

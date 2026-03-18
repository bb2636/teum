import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';

export interface Terms {
  type: 'service' | 'privacy' | 'payment' | 'refund';
  title: string;
  content: string;
  version: string;
  updatedAt: string | null;
  createdAt: string | null;
}

// Admin: Get service terms
export function useServiceTerms() {
  return useQuery<Terms>({
    queryKey: ['terms', 'admin', 'service'],
    queryFn: async () => {
      try {
        const response = await apiRequest<{ data: Terms }>('/terms/admin/service');
        return response.data;
      } catch (error) {
        // Return default empty terms if API fails
        return {
          type: 'service',
          title: '서비스 이용약관',
          content: '',
          version: '1.0',
          updatedAt: null,
          createdAt: null,
        };
      }
    },
    staleTime: 1000 * 60 * 30, // 30 minutes - cache for longer
    gcTime: 1000 * 60 * 60, // 1 hour - keep in cache
    retry: 1, // Only retry once
    refetchOnWindowFocus: false, // Don't refetch on window focus
  });
}

// Admin: Get privacy policy
export function usePrivacyPolicy() {
  return useQuery<Terms>({
    queryKey: ['terms', 'admin', 'privacy'],
    queryFn: async () => {
      try {
        const response = await apiRequest<{ data: Terms }>('/terms/admin/privacy');
        return response.data;
      } catch (error) {
        // Return default empty terms if API fails
        return {
          type: 'privacy',
          title: '개인정보 처리방침',
          content: '',
          version: '1.0',
          updatedAt: null,
          createdAt: null,
        };
      }
    },
    staleTime: 1000 * 60 * 30, // 30 minutes - cache for longer
    gcTime: 1000 * 60 * 60, // 1 hour - keep in cache
    retry: 1, // Only retry once
    refetchOnWindowFocus: false, // Don't refetch on window focus
  });
}

// Admin: Update service terms
export function useUpdateServiceTerms() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ content, autoSave = false }: { content: string; autoSave?: boolean }) => {
      const url = autoSave 
        ? '/terms/admin/service?autoSave=true'
        : '/terms/admin/service';
      const response = await apiRequest<{ data: Terms }>(url, {
        method: 'PUT',
        body: JSON.stringify({ content }),
      });
      return response.data;
    },
    onSuccess: (data) => {
      // Update cache directly instead of invalidating
      queryClient.setQueryData(['terms', 'admin', 'service'], data);
      queryClient.invalidateQueries({ queryKey: ['terms', 'admin', 'service'] });
    },
  });
}

// Admin: Update privacy policy
export function useUpdatePrivacyPolicy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ content, autoSave = false }: { content: string; autoSave?: boolean }) => {
      const url = autoSave 
        ? '/terms/admin/privacy?autoSave=true'
        : '/terms/admin/privacy';
      const response = await apiRequest<{ data: Terms }>(url, {
        method: 'PUT',
        body: JSON.stringify({ content }),
      });
      return response.data;
    },
    onSuccess: (data) => {
      // Update cache directly instead of invalidating
      queryClient.setQueryData(['terms', 'admin', 'privacy'], data);
      queryClient.invalidateQueries({ queryKey: ['terms', 'admin', 'privacy'] });
    },
  });
}

// Admin: Get payment terms
export function usePaymentTerms() {
  return useQuery<Terms>({
    queryKey: ['terms', 'admin', 'payment'],
    queryFn: async () => {
      try {
        const response = await apiRequest<{ data: Terms }>('/terms/admin/payment');
        return response.data;
      } catch (error) {
        return {
          type: 'payment' as const,
          title: '정기결제/자동갱신',
          content: '',
          version: '1.0',
          updatedAt: null,
          createdAt: null,
        };
      }
    },
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60,
    retry: 1,
    refetchOnWindowFocus: false,
  });
}

// Admin: Get refund terms
export function useRefundTerms() {
  return useQuery<Terms>({
    queryKey: ['terms', 'admin', 'refund'],
    queryFn: async () => {
      try {
        const response = await apiRequest<{ data: Terms }>('/terms/admin/refund');
        return response.data;
      } catch (error) {
        return {
          type: 'refund' as const,
          title: '환불/취소 정책',
          content: '',
          version: '1.0',
          updatedAt: null,
          createdAt: null,
        };
      }
    },
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60,
    retry: 1,
    refetchOnWindowFocus: false,
  });
}

// Admin: Update payment terms
export function useUpdatePaymentTerms() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ content, autoSave = false }: { content: string; autoSave?: boolean }) => {
      const url = autoSave 
        ? '/terms/admin/payment?autoSave=true'
        : '/terms/admin/payment';
      const response = await apiRequest<{ data: Terms }>(url, {
        method: 'PUT',
        body: JSON.stringify({ content }),
      });
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['terms', 'admin', 'payment'], data);
      queryClient.invalidateQueries({ queryKey: ['terms', 'admin', 'payment'] });
    },
  });
}

// Admin: Update refund terms
export function useUpdateRefundTerms() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ content, autoSave = false }: { content: string; autoSave?: boolean }) => {
      const url = autoSave 
        ? '/terms/admin/refund?autoSave=true'
        : '/terms/admin/refund';
      const response = await apiRequest<{ data: Terms }>(url, {
        method: 'PUT',
        body: JSON.stringify({ content }),
      });
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['terms', 'admin', 'refund'], data);
      queryClient.invalidateQueries({ queryKey: ['terms', 'admin', 'refund'] });
    },
  });
}

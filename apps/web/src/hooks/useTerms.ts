import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';

export interface Terms {
  type: 'service' | 'privacy';
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

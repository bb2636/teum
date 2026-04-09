import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';

export interface SupportInquiry {
  id: string;
  userId: string;
  status: 'received' | 'in_progress' | 'answered';
  subject: string;
  message: string;
  answer?: string;
  answeredAt?: string;
  answeredBy?: string;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    email: string;
    profile?: {
      nickname?: string;
      name?: string;
      profileImageUrl?: string;
    } | null;
  } | null;
}

export interface CreateInquiryInput {
  subject: string;
  message: string;
}

// Create support inquiry
export function useCreateInquiry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateInquiryInput) => {
      const response = await apiRequest<{ data: { inquiry: SupportInquiry } }>(
        '/support',
        {
          method: 'POST',
          body: JSON.stringify(data),
        }
      );
      return response.data.inquiry;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['support', 'inquiries'] });
    },
  });
}

// Get support inquiries
export function useSupportInquiries() {
  return useQuery<SupportInquiry[]>({
    queryKey: ['support', 'inquiries'],
    queryFn: async () => {
      const response = await apiRequest<{ data: { inquiries: SupportInquiry[] } }>(
        '/support'
      );
      return response.data.inquiries;
    },
    staleTime: 1000 * 10,
    refetchOnMount: 'always',
  });
}

// Get single inquiry
export function useSupportInquiry(id: string) {
  return useQuery<SupportInquiry>({
    queryKey: ['support', 'inquiry', id],
    queryFn: async () => {
      const response = await apiRequest<{ data: { inquiry: SupportInquiry } }>(
        `/support/${id}`
      );
      return response.data.inquiry;
    },
    enabled: !!id,
  });
}

// Admin: Get all inquiries
export function useAllSupportInquiries() {
  return useQuery<SupportInquiry[]>({
    queryKey: ['support', 'admin', 'all'],
    queryFn: async () => {
      const response = await apiRequest<{ data: { inquiries: SupportInquiry[] } }>(
        '/support/admin/all'
      );
      return response.data.inquiries;
    },
    staleTime: 1000 * 10,
    refetchOnMount: 'always',
  });
}

// Admin: Get inquiry by ID
export function useAdminSupportInquiry(id: string) {
  return useQuery<SupportInquiry>({
    queryKey: ['support', 'admin', 'inquiry', id],
    queryFn: async () => {
      const response = await apiRequest<{ data: { inquiry: SupportInquiry } }>(
        `/support/admin/${id}`
      );
      return response.data.inquiry;
    },
    enabled: !!id,
  });
}

// Admin: Get unchecked inquiry count
export function useUncheckedInquiryCount() {
  return useQuery<number>({
    queryKey: ['support', 'admin', 'unchecked-count'],
    queryFn: async () => {
      const response = await apiRequest<{ data: { count: number } }>(
        '/support/admin/unchecked-count'
      );
      return response.data.count;
    },
    staleTime: 1000 * 30,
  });
}

// Admin: Mark inquiries as checked
export function useMarkInquiriesChecked() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      await apiRequest('/support/admin/mark-checked', { method: 'POST' });
    },
    onSuccess: () => {
      queryClient.setQueryData(['support', 'admin', 'unchecked-count'], 0);
    },
  });
}

// Admin: Update inquiry answer
export function useUpdateInquiryAnswer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, answer }: { id: string; answer: string }) => {
      const response = await apiRequest<{ data: { inquiry: SupportInquiry } }>(
        `/support/admin/${id}/answer`,
        {
          method: 'PUT',
          body: JSON.stringify({ answer }),
        }
      );
      return response.data.inquiry;
    },
    onSuccess: (updatedInquiry) => {
      if (!updatedInquiry) return;
      const id = updatedInquiry.id;
      queryClient.setQueryData<SupportInquiry>(['support', 'admin', 'inquiry', id], (old) =>
        old ? { ...old, ...updatedInquiry } : updatedInquiry
      );
      queryClient.setQueryData<SupportInquiry[]>(['support', 'admin', 'all'], (old) =>
        old
          ? old.map((inv) => (inv.id === id ? { ...inv, status: 'answered' as const, answer: updatedInquiry.answer, answeredAt: updatedInquiry.answeredAt, answeredBy: updatedInquiry.answeredBy } : inv))
          : old
      );
      queryClient.refetchQueries({ queryKey: ['support', 'admin', 'all'] });
      queryClient.invalidateQueries({ queryKey: ['support', 'inquiries'] });
    },
  });
}

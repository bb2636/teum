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
    staleTime: 1000 * 60 * 5, // 5 minutes
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

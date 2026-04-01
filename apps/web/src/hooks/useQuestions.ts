import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';
import { getCurrentLanguage } from '@/lib/i18n';

export interface Question {
  id: string;
  question: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export function useRandomQuestions(count: number = 3) {
  const lang = getCurrentLanguage();
  return useQuery<Question[]>({
    queryKey: ['questions', 'random', count, lang],
    queryFn: async () => {
      const response = await apiRequest<{ data: { questions: Question[] } }>(
        `/questions/random?count=${count}&lang=${lang}&_t=${Date.now()}`
      );
      return response.data.questions;
    },
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
  });
}

// Admin: Get all questions
export function useQuestions() {
  return useQuery<Question[]>({
    queryKey: ['questions', 'all'],
    queryFn: async () => {
      const response = await apiRequest<{ data: { questions: Question[] } }>('/questions');
      return response.data.questions;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

// Admin: Create question
export function useCreateQuestion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { question: string; isActive?: boolean }) => {
      const response = await apiRequest<{ data: { question: Question } }>('/questions', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return response.data.question;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questions'] });
    },
  });
}

// Admin: Update question
export function useUpdateQuestion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; question?: string; isActive?: boolean }) => {
      const response = await apiRequest<{ data: { question: Question } }>(`/questions/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
      return response.data.question;
    },
    onSuccess: (updatedQuestion) => {
      if (updatedQuestion) {
        queryClient.setQueryData<Question[]>(['questions', 'all'], (old) =>
          old?.map((q) => (q.id === updatedQuestion.id ? updatedQuestion : q)) ?? old ?? []
        );
        // invalidateQueries 미호출: refetch 시 이전 데이터로 덮어쓰는 현상 방지
      }
    },
  });
}

// Admin: Delete question
export function useDeleteQuestion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await apiRequest(`/questions/${id}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questions'] });
    },
  });
}

// Admin: Update question order
export function useUpdateQuestionOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (questionIds: string[]) => {
      const response = await apiRequest<{ data: { questions: Question[] } }>('/questions/order', {
        method: 'PUT',
        body: JSON.stringify({ questionIds }),
      });
      return response.data.questions;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questions'] });
    },
  });
}

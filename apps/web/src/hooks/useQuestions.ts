import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';

export interface Question {
  id: string;
  question: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Get random questions (excludes questions used in last 7 days)
export function useRandomQuestions(count: number = 3) {
  return useQuery<Question[]>({
    queryKey: ['questions', 'random', count],
    queryFn: async () => {
      const response = await apiRequest<{ data: { questions: Question[] } }>(
        `/questions/random?count=${count}`
      );
      return response.data.questions;
    },
    staleTime: 0, // Always fetch fresh random questions
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
        method: 'PUT',
        body: JSON.stringify(data),
      });
      return response.data.question;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questions'] });
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

import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';

export interface Question {
  id: string;
  questionSetId: string;
  question: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface QuestionSet {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  questions?: Question[];
}

// Get active question sets
export function useQuestionSets() {
  return useQuery<QuestionSet[]>({
    queryKey: ['question-sets'],
    queryFn: async () => {
      const response = await apiRequest<{ data: { questionSets: QuestionSet[] } }>(
        '/question-sets'
      );
      return response.data.questionSets;
    },
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
}

// Get question set by ID
export function useQuestionSet(id: string) {
  return useQuery<QuestionSet>({
    queryKey: ['question-set', id],
    queryFn: async () => {
      const response = await apiRequest<{ data: { questionSet: QuestionSet } }>(
        `/question-sets/${id}`
      );
      return response.data.questionSet;
    },
    enabled: !!id,
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
}

import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';

const DIARY_PAGE_SIZE = 20;

export interface Diary {
  id: string;
  userId: string;
  folderId?: string;
  folder?: { id: string; name: string; isDefault?: boolean };
  type: 'free_form' | 'question_based';
  title?: string;
  content?: string;
  textStyle?: string;
  questionSetId?: string;
  date: string;
  createdAt: string;
  updatedAt: string;
  images?: Array<{ id: string; imageUrl: string; sortOrder: number }>;
  answers?: Array<{
    id: string;
    questionId: string;
    answer: string;
    question?: { id: string; question: string };
  }>;
  aiMessage?: string;
  aiSummary?: string;
  aiFeedback?: { id: string; outputText: string; kind: string; createdAt: string };
}

interface DiaryPage {
  diaries: Diary[];
  hasMore: boolean;
  nextOffset: number | null;
}

export interface Folder {
  id: string;
  userId: string;
  name: string;
  coverImageUrl?: string;
  color?: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export function useFolders() {
  return useQuery<Folder[]>({
    queryKey: ['folders'],
    queryFn: async () => {
      const response = await apiRequest<{ data: { folders: Folder[] } }>('/folders');
      return response.data.folders;
    },
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 60,
  });
}

export function useDiaries(folderId?: string) {
  const query = useInfiniteQuery<DiaryPage, Error>({
    queryKey: ['diaries', folderId || '전체'],
    queryFn: async ({ pageParam }) => {
      const offset = pageParam as number;
      const params = new URLSearchParams();
      if (folderId) params.set('folderId', folderId);
      params.set('limit', String(DIARY_PAGE_SIZE));
      params.set('offset', String(offset));
      const qs = params.toString();
      const response = await apiRequest<{ data: DiaryPage }>(`/diaries?${qs}`);
      return response.data;
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage?.nextOffset ?? undefined,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 60,
    retry: (failureCount, error) => {
      if ((error as any)?.status === 401) return false;
      return failureCount < 1;
    },
  });

  const allDiaries = query.data?.pages.flatMap((p) => p.diaries) ?? [];
  const seen = new Set<string>();
  const data = allDiaries.filter((d) => {
    if (seen.has(d.id)) return false;
    seen.add(d.id);
    return true;
  });

  return {
    data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    hasNextPage: query.hasNextPage ?? false,
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: query.fetchNextPage,
    refetch: query.refetch,
  };
}

export function useAllDiaries() {
  return useQuery<Diary[]>({
    queryKey: ['diaries', 'all'],
    queryFn: async () => {
      const response = await apiRequest<{ data: { diaries: Diary[] } }>('/diaries?limit=9999&offset=0');
      return response.data.diaries ?? (response.data as any).items ?? [];
    },
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 60,
  });
}

// Single diary
export function useDiary(id: string) {
  return useQuery<Diary>({
    queryKey: ['diary', id],
    queryFn: async () => {
      const response = await apiRequest<{ data: { diary: Diary } }>(`/diaries/${id}`);
      return response.data.diary;
    },
    enabled: !!id,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 60,
  });
}

export function useCalendarDiaries(year: number, month: number) {
  return useQuery<Diary[]>({
    queryKey: ['diaries', 'calendar', year, month],
    queryFn: async () => {
      const response = await apiRequest<{ data: { diaries: Diary[] } }>(
        `/diaries/calendar?year=${year}&month=${month}`
      );
      return response.data.diaries;
    },
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 60,
  });
}

export function useDiaryCount() {
  return useQuery<number>({
    queryKey: ['diaries', 'count'],
    queryFn: async () => {
      const response = await apiRequest<{ data: { count: number } }>('/diaries/count');
      return response.data.count;
    },
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 60,
  });
}

export function useCreateDiary() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      folderId?: string;
      type: 'free_form' | 'question_based';
      title?: string;
      content?: string;
      textStyle?: string;
      questionSetId?: string;
      date: string;
      imageUrls?: string[];
      answers?: Array<{ questionId: string; answer: string }>;
    }) => {
      const response = await apiRequest<{ data: { diary: Diary } }>('/diaries', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return response.data.diary;
    },
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ['diaries', 'calendar'] });
      queryClient.invalidateQueries({ queryKey: ['diaries'] });
      queryClient.invalidateQueries({ queryKey: ['diaries', 'count'] });
      queryClient.invalidateQueries({ queryKey: ['folders'] });
    },
  });
}

export function useUpdateDiary() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...data
    }: {
      id: string;
      folderId?: string;
      title?: string;
      content?: string;
      textStyle?: string;
      date?: string;
      imageUrls?: string[];
    }) => {
      const response = await apiRequest<{ data: { diary: Diary } }>(`/diaries/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
      return response.data.diary;
    },
    onSuccess: (updatedDiary) => {
      queryClient.setQueryData<Diary>(['diary', updatedDiary.id], updatedDiary);
      queryClient.removeQueries({ queryKey: ['diaries', 'calendar'] });
      queryClient.invalidateQueries({ queryKey: ['diaries'] });
    },
  });
}

export function useDeleteDiary() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await apiRequest(`/diaries/${id}`, {
        method: 'DELETE',
      });
      return id;
    },
    onSuccess: (id) => {
      queryClient.removeQueries({ queryKey: ['diary', id] });
      queryClient.removeQueries({ queryKey: ['diaries', 'calendar'] });
      queryClient.invalidateQueries({ queryKey: ['diaries'] });
      queryClient.invalidateQueries({ queryKey: ['diaries', 'count'] });
      queryClient.invalidateQueries({ queryKey: ['folders'] });
    },
  });
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';

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
  aiMessage?: string; // Latest encouragement message from diaries table
  aiFeedback?: { id: string; outputText: string; kind: string; createdAt: string };
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

// Folders
export function useFolders() {
  return useQuery<Folder[]>({
    queryKey: ['folders'],
    queryFn: async () => {
      const response = await apiRequest<{ data: { folders: Folder[] } }>('/folders');
      return response.data.folders;
    },
    staleTime: 1000 * 60 * 10, // 10 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes
  });
}

// Diaries by folder with incremental updates
export function useDiaries(folderId?: string) {
  return useQuery<Diary[]>({
    queryKey: ['diaries', folderId || '전체'],
    queryFn: async () => {
      const params = folderId ? `?folderId=${folderId}` : '';
      const response = await apiRequest<{ data: { diaries: Diary[] } }>(
        `/diaries${params}`
      );
      return response.data.diaries;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes
    // Background refetch to get updates
    refetchInterval: 1000 * 60 * 2, // Every 2 minutes in background
    refetchIntervalInBackground: true,
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
    gcTime: 1000 * 60 * 30,
  });
}

// Calendar diaries
export function useCalendarDiaries(year: number, month: number) {
  return useQuery<Diary[]>({
    queryKey: ['diaries', 'calendar', year, month],
    queryFn: async () => {
      const response = await apiRequest<{ data: { diaries: Diary[] } }>(
        `/diaries/calendar?year=${year}&month=${month}`
      );
      return response.data.diaries;
    },
    staleTime: 1000 * 60 * 10, // 10 minutes
    gcTime: 1000 * 60 * 30,
  });
}

// Create diary mutation with optimistic update
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
    onMutate: async (newDiary) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['diaries'] });

      // Snapshot previous value
      const previousDiaries = queryClient.getQueryData<Diary[]>(['diaries', newDiary.folderId || '전체']);

      // Optimistically add temporary diary
      const tempDiary: Diary = {
        id: `temp-${Date.now()}`,
        userId: '',
        folderId: newDiary.folderId,
        type: newDiary.type,
        title: newDiary.title,
        content: newDiary.content,
        date: newDiary.date,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      queryClient.setQueryData<Diary[]>(['diaries', newDiary.folderId || '전체'], (old) => {
        if (!old) return [tempDiary];
        return [tempDiary, ...old];
      });

      return { previousDiaries };
    },
    onError: (_err, variables, context) => {
      // Rollback on error
      if (context?.previousDiaries) {
        queryClient.setQueryData<Diary[]>(['diaries', variables.folderId || '전체'], context.previousDiaries);
      }
    },
    onSuccess: (newDiary) => {
      const updateList = (key: string) => {
        queryClient.setQueryData<Diary[]>(['diaries', key], (old) => {
          if (!old) return [newDiary];
          return [newDiary, ...old.filter((d) => !d.id.startsWith('temp-'))];
        });
      };
      updateList(newDiary.folderId || '전체');
      if (newDiary.folderId) updateList('전체');

      // Invalidate all diary queries
      queryClient.invalidateQueries({ queryKey: ['diaries'] });
      
      // Invalidate folders to update diary counts
      queryClient.invalidateQueries({ queryKey: ['folders'] });
      
      // Invalidate calendar queries for the specific year/month of the new diary
      const diaryDate = new Date(newDiary.date);
      const year = diaryDate.getFullYear();
      const month = diaryDate.getMonth() + 1;
      queryClient.invalidateQueries({ queryKey: ['diaries', 'calendar', year, month] });
      
      // Also invalidate all calendar queries to be safe
      queryClient.invalidateQueries({ queryKey: ['diaries', 'calendar'] });
    },
  });
}

// Update diary mutation with optimistic update
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
    onMutate: async ({ id, ...variables }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['diary', id] });
      await queryClient.cancelQueries({ queryKey: ['diaries'] });

      // Snapshot previous values
      const previousDiary = queryClient.getQueryData<Diary>(['diary', id]);
      const previousDiaries = queryClient.getQueriesData<Diary[]>({ queryKey: ['diaries'] });

      // Optimistically update
      if (previousDiary) {
        queryClient.setQueryData<Diary>(['diary', id], {
          ...previousDiary,
          ...variables,
          updatedAt: new Date().toISOString(),
        });
      }

      // Update in lists
      queryClient.setQueriesData<Diary[]>({ queryKey: ['diaries'] }, (old) => {
        if (!old) return undefined;
        return old.map((diary) =>
          diary.id === id
            ? { ...diary, ...variables, updatedAt: new Date().toISOString() }
            : diary
        );
      });

      return { previousDiary, previousDiaries };
    },
    onError: (_err, variables, context) => {
      // Rollback on error
      if (context?.previousDiary) {
        queryClient.setQueryData<Diary>(['diary', variables.id], context.previousDiary);
      }
      if (context?.previousDiaries) {
        context.previousDiaries.forEach(([queryKey, data]) => {
          if (data) {
            queryClient.setQueryData(queryKey, data);
          }
        });
      }
    },
    onSuccess: (updatedDiary) => {
      // Update single diary cache
      queryClient.setQueryData<Diary>(['diary', updatedDiary.id], updatedDiary);

      // Update list cache
      queryClient.setQueriesData<Diary[]>({ queryKey: ['diaries'] }, (old) => {
        if (!old) return undefined;
        return old.map((diary) =>
          diary.id === updatedDiary.id ? updatedDiary : diary
        );
      });

      // Invalidate to refetch in background (gets any other updates)
      queryClient.invalidateQueries({ queryKey: ['diaries'] });
      
      // Invalidate calendar queries for the specific year/month of the updated diary
      const diaryDate = new Date(updatedDiary.date);
      const year = diaryDate.getFullYear();
      const month = diaryDate.getMonth() + 1;
      queryClient.invalidateQueries({ queryKey: ['diaries', 'calendar', year, month] });
      
      // Also invalidate all calendar queries to be safe
      queryClient.invalidateQueries({ queryKey: ['diaries', 'calendar'] });
    },
  });
}

// Delete diary mutation with optimistic update
export function useDeleteDiary() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await apiRequest(`/diaries/${id}`, {
        method: 'DELETE',
      });
      return id;
    },
    onMutate: async (id) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['diaries'] });

      // Snapshot previous values
      const previousDiaries = queryClient.getQueriesData<Diary[]>({ queryKey: ['diaries'] });

      // Optimistically remove from cache
      queryClient.setQueriesData<Diary[]>({ queryKey: ['diaries'] }, (old) => {
        if (!old) return undefined;
        return old.filter((diary) => diary.id !== id);
      });

      return { previousDiaries };
    },
    onError: (_err, _id, context) => {
      // Rollback on error
      if (context?.previousDiaries) {
        context.previousDiaries.forEach(([queryKey, data]) => {
          if (data) {
            queryClient.setQueryData(queryKey, data);
          }
        });
      }
    },
    onSuccess: () => {
      // Invalidate to refetch in background
      queryClient.invalidateQueries({ queryKey: ['diaries'] });
      queryClient.invalidateQueries({ queryKey: ['diaries', 'calendar'] });
    },
  });
}

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';
import type { Folder } from './useDiaries';

// Create folder mutation
export function useCreateFolder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { name: string; coverImageUrl?: string; color?: string }) => {
      const response = await apiRequest<{ data: { folder: Folder } }>('/folders', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return response.data.folder;
    },
    onSuccess: (newFolder) => {
      // Optimistically add to cache
      queryClient.setQueryData<Folder[]>(['folders'], (old) => {
        if (!old) return [newFolder];
        return [...old, newFolder];
      });
      // Invalidate to ensure all components get the updated list
      queryClient.invalidateQueries({ queryKey: ['folders'] });
    },
  });
}

// Update folder mutation
export function useUpdateFolder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...data
    }: {
      id: string;
      name?: string;
      coverImageUrl?: string;
      color?: string;
    }) => {
      const response = await apiRequest<{ data: { folder: Folder } }>(`/folders/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
      return response.data.folder;
    },
    onSuccess: (updatedFolder) => {
      // Update cache
      queryClient.setQueryData<Folder[]>(['folders'], (old) => {
        if (!old) return undefined;
        return old.map((folder) => (folder.id === updatedFolder.id ? updatedFolder : folder));
      });

      // Invalidate diaries to refetch with new folder info
      queryClient.invalidateQueries({ queryKey: ['diaries'] });
    },
  });
}

// Delete folder mutation
export function useDeleteFolder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await apiRequest(`/folders/${id}`, {
        method: 'DELETE',
      });
      return id;
    },
    onSuccess: (deletedId) => {
      // Remove from cache
      queryClient.setQueryData<Folder[]>(['folders'], (old) => {
        if (!old) return undefined;
        return old.filter((folder) => folder.id !== deletedId);
      });

      // Invalidate diaries
      queryClient.invalidateQueries({ queryKey: ['diaries'] });
    },
  });
}

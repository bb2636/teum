import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';

export function useUploadImage() {
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('image', file);

      const response = await apiRequest<{ data: { url: string } }>('/upload/image', {
        method: 'POST',
        body: formData,
        // Don't set Content-Type header, let browser set it with boundary
        headers: {},
      });

      return response.data.url;
    },
  });
}

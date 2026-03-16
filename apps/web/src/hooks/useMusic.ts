import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';

export interface MusicJob {
  jobId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  overallEmotion?: string;
  mood?: string;
  keywords?: string[];
  lyricalTheme?: string;
  lyrics?: string;
  musicPrompt?: string;
  audioUrl?: string;
  errorMessage?: string;
  createdAt: string;
  completedAt?: string;
}

export interface GenerateMusicResponse {
  jobId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  overallEmotion?: string;
  mood?: string;
  keywords?: string[];
  lyricalTheme?: string;
  lyrics?: string;
  musicPrompt?: string;
  audioUrl?: string;
}

// Generate music from selected diaries
export function useGenerateMusic() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (diaryIds: string[]) => {
      if (diaryIds.length !== 7) {
        throw new Error('정확히 7개의 일기를 선택해주세요');
      }

      const response = await apiRequest<{ data: GenerateMusicResponse }>(
        '/music/generate',
        {
          method: 'POST',
          body: JSON.stringify({ diaryIds }),
        }
      );
      return response.data;
    },
    onSuccess: (data) => {
      // Invalidate music jobs query to refetch
      queryClient.invalidateQueries({ queryKey: ['music', 'jobs'] });
      // Set the new job in cache
      queryClient.setQueryData(['music', 'job', data.jobId], data);
    },
  });
}

// Get music job status
export function useMusicJob(jobId: string) {
  return useQuery<MusicJob>({
    queryKey: ['music', 'job', jobId],
    queryFn: async () => {
      const response = await apiRequest<{ data: MusicJob }>(`/music/jobs/${jobId}`);
      return response.data;
    },
    enabled: !!jobId,
    refetchInterval: (query) => {
      // Poll every 2 seconds if job is still processing
      const data = query.state.data;
      if (data?.status === 'processing' || data?.status === 'queued') {
        return 2000;
      }
      return false;
    },
  });
}

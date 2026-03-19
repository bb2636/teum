import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';

export interface MusicJobListItem {
  jobId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  title?: string;
  titleEn?: string;
  lyrics?: string;
  audioUrl?: string;
  thumbnailUrl?: string;
  sourceDiaryIds: string[];
  durationSeconds?: number;
  createdAt: string;
  completedAt?: string;
}

export interface MusicJobsResponse {
  jobs: MusicJobListItem[];
  monthlyUsed: number;
  monthlyLimit: number;
  hasSubscription: boolean;
  nextPaymentDate?: string; // ISO, 다음 결제/갱신일
}

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
  thumbnailUrl?: string;
  errorMessage?: string;
  durationSeconds?: number;
  title?: string;
  titleEn?: string;
  sourceDiaryIds: string[];
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
  thumbnailUrl?: string;
  title?: string;
  titleEn?: string;
}

export interface MusicGenre {
  tag: string;
  labelKo: string;
}

export interface MusicGenresResponse {
  genres: MusicGenre[];
}

// 장르/스타일 목록 (뮤레카 스타일)
export function useMusicGenres() {
  return useQuery<MusicGenresResponse>({
    queryKey: ['music', 'genres'],
    queryFn: async () => {
      const response = await apiRequest<{ data: MusicGenresResponse }>('/music/genres');
      return response.data;
    },
    staleTime: 1000 * 60 * 60, // 1시간
  });
}

// 목록 및 월간 한도
export function useMusicJobs() {
  return useQuery<MusicJobsResponse>({
    queryKey: ['music', 'jobs'],
    queryFn: async () => {
      const response = await apiRequest<{ data: MusicJobsResponse }>('/music/jobs');
      return response.data;
    },
    staleTime: 0, // 구독 상태 변경 시 즉시 반영되도록
  });
}

export interface GenerateMusicParams {
  diaryIds: string[];
  genreTag: string;
}

// Generate music from selected diaries + selected genre
export function useGenerateMusic() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ diaryIds, genreTag }: GenerateMusicParams) => {
      if (diaryIds.length !== 7) {
        throw new Error('정확히 7개의 일기를 선택해주세요');
      }
      if (!genreTag?.trim()) {
        throw new Error('장르를 선택해주세요');
      }

      const response = await apiRequest<{ data: GenerateMusicResponse }>(
        '/music/generate',
        {
          method: 'POST',
          body: JSON.stringify({ diaryIds, genreTag: genreTag.trim() }),
        }
      );
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['music', 'jobs'] });
      queryClient.setQueryData(['music', 'job', data.jobId], data);
    },
  });
}

export type GenerateMusicErrorCode = 'SUBSCRIPTION_REQUIRED' | 'MONTHLY_LIMIT_EXCEEDED';

export function isMusicApiError(
  error: unknown
): error is { response?: { data?: { error?: { code?: string; message?: string } } } } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    typeof (error as { response?: unknown }).response === 'object'
  );
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

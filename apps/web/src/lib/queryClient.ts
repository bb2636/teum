import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes - 데이터가 fresh로 간주되는 시간
      gcTime: 1000 * 60 * 30, // 30 minutes (formerly cacheTime) - 캐시 유지 시간
      refetchOnWindowFocus: false, // 윈도우 포커스 시 자동 refetch 비활성화
      refetchOnMount: false, // 마운트 시 자동 refetch 비활성화 (캐시 우선)
      refetchOnReconnect: true, // 네트워크 재연결 시 refetch
      retry: 1, // 실패 시 1번만 재시도
    },
    mutations: {
      retry: 0, // mutation은 재시도 안 함
    },
  },
});

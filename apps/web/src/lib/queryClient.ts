import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 60 * 6,
      refetchOnWindowFocus: false,
      // 'always' 는 페이지 진입마다 무조건 재요청해 Neon DB quota 를 빠르게 소진시킨다.
      // true 로 두면 staleTime(5분) 안에서는 캐시를 사용하고 그 이후에만 재요청한다.
      refetchOnMount: true,
      refetchOnReconnect: false,
      retry: 1,
    },
    mutations: {
      retry: 0,
    },
  },
});

let currentUserId: string | null = null;

export function onUserChanged(userId: string | null) {
  if (currentUserId && userId && currentUserId !== userId) {
    queryClient.cancelQueries();
    queryClient.clear();
  }
  currentUserId = userId;
}

export function forceFullCacheClear() {
  queryClient.cancelQueries();
  queryClient.clear();
  queryClient.removeQueries();
  currentUserId = null;
}

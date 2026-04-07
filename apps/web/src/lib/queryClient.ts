import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 60 * 6,
      refetchOnWindowFocus: false,
      refetchOnMount: 'always',
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

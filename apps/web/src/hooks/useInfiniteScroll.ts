import { useEffect, useRef, useCallback } from 'react';

export function useInfiniteScroll(options: {
  hasMore: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
  rootMargin?: string;
}) {
  const { hasMore, isFetchingNextPage, fetchNextPage, rootMargin = '200px' } = options;
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const handleIntersect = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      if (entries[0]?.isIntersecting && hasMore && !isFetchingNextPage) {
        fetchNextPage();
      }
    },
    [hasMore, isFetchingNextPage, fetchNextPage]
  );

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(handleIntersect, { rootMargin });
    observer.observe(el);
    return () => observer.disconnect();
  }, [handleIntersect, rootMargin]);

  return sentinelRef;
}

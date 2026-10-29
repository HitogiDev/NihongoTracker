import { useEffect, useRef } from 'react';
import Spinner from './Spinner';

interface InfiniteScrollSentinelProps {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
}

/**
 * Load the next page when this element nears the viewport. It also shows the
 * loading state, so a list needs no "load more" button.
 */
export default function InfiniteScrollSentinel({
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
}: InfiniteScrollSentinelProps) {
  const ref = useRef<HTMLDivElement>(null);
  const loadMore = useRef(onLoadMore);
  useEffect(() => {
    loadMore.current = onLoadMore;
  }, [onLoadMore]);

  useEffect(() => {
    const element = ref.current;
    if (!element || !hasNextPage || isFetchingNextPage) return undefined;
    const observer = new IntersectionObserver(
      (items) => {
        if (items.some((item) => item.isIntersecting)) loadMore.current();
      },
      { rootMargin: '400px 0px' }
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage]);

  if (!hasNextPage) return null;
  return (
    <div ref={ref} className="flex justify-center py-4" role="status">
      {isFetchingNextPage && <Spinner />}
    </div>
  );
}

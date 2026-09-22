import { useInfiniteQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useOutletContext } from 'react-router-dom';
import { getActivityFeedFn } from '../api/activitiesApi';
import ActivityCard from '../components/social/ActivityCard';
import Button from '../components/ui/Button';
import { OutletProfileContextType } from '../types';

export default function ProfileActivityScreen() {
  const { t } = useTranslation('profile');
  const { username } = useOutletContext<OutletProfileContextType>();

  const {
    data,
    isLoading,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['profileActivities', username],
    queryFn: ({ pageParam }) =>
      getActivityFeedFn({
        scope: 'user',
        username: username!,
        before: pageParam,
        limit: 20,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: Boolean(username),
    staleTime: 60_000,
  });

  const activities = data?.pages.flatMap((page) => page.activities) ?? [];

  return (
    <main className="flex min-h-screen flex-col items-center px-4 py-6 sm:px-6 sm:py-8">
      <div className="w-full max-w-3xl space-y-5">
        <h1 className="text-2xl font-semibold text-base-content sm:text-3xl">
          {t('socialActivity.title', { username })}
        </h1>

        {isLoading ? (
          <div className="space-y-3" aria-busy="true">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="skeleton h-36 w-full" />
            ))}
          </div>
        ) : isError ? (
          <div role="alert" className="alert alert-error">
            <span>{t('socialActivity.loadError')}</span>
            <Button
              size="sm"
              appearance="outline"
              onClick={() => void refetch()}
            >
              {t('socialActivity.retry')}
            </Button>
          </div>
        ) : activities.length === 0 ? (
          <div className="surface-muted p-8 text-center text-sm text-base-content/70">
            {t('socialActivity.empty')}
          </div>
        ) : (
          <div className="space-y-3">
            {activities.map((activity) => (
              <ActivityCard
                key={activity._id}
                activity={activity}
                surface="default"
              />
            ))}
          </div>
        )}

        {hasNextPage && (
          <div className="flex justify-center">
            <Button
              size="sm"
              appearance="outline"
              loading={isFetchingNextPage}
              onClick={() => void fetchNextPage()}
            >
              {t('socialActivity.loadMore')}
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}

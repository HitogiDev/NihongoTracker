import { useInfiniteQuery } from '@tanstack/react-query';
import { History } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getClubFeedFn } from '../../api/clubApi';
import ActivityCard from '../social/ActivityCard';
import Spinner from '../ui/Spinner';

interface RecentActivityProps {
  clubId: string;
  enabled?: boolean;
}

export default function RecentActivity({ clubId, enabled = true }: RecentActivityProps) {
  const { t } = useTranslation('clubs');
  const feed = useInfiniteQuery({
    queryKey: ['clubFeed', clubId],
    queryFn: ({ pageParam }: { pageParam: string | undefined }) =>
      getClubFeedFn(clubId, { before: pageParam, limit: 10 }),
    initialPageParam: undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    enabled: Boolean(clubId && enabled),
  });
  const activities = feed.data?.pages.flatMap((page) => page.activities) ?? [];

  return (
    <section className="card surface">
      <div className="card-body gap-4">
        <h2 className="card-title text-lg">
          <History className="h-5 w-5" />
          {t('activity.title')}
        </h2>
        {!enabled ? (
          <p className="py-6 text-center text-sm text-base-content/60">
            {t('activity.membersOnly')}
          </p>
        ) : feed.isLoading ? (
          <div className="flex justify-center py-8" aria-busy="true">
            <Spinner />
          </div>
        ) : activities.length === 0 ? (
          <div className="py-6 text-center text-base-content/60">
            <History className="mx-auto mb-2 h-8 w-8 opacity-50" />
            <p className="text-sm">{t('activity.empty')}</p>
            <p className="text-xs">{t('activity.emptyHint')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activities.map((activity) => (
              <ActivityCard
                key={activity._id}
                activity={activity}
                highlighted={activity.isPinned}
              />
            ))}
          </div>
        )}
        {feed.hasNextPage && (
          <button
            className="btn btn-sm self-center"
            disabled={feed.isFetchingNextPage}
            onClick={() => feed.fetchNextPage()}
          >
            {feed.isFetchingNextPage ? <Spinner size="sm" /> : t('activity.loadMore')}
          </button>
        )}
      </div>
    </section>
  );
}

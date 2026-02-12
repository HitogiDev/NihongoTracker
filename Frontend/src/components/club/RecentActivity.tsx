import { useInfiniteQuery } from '@tanstack/react-query';
import {
  Bookmark,
  MessageSquareText,
  Star,
  Play,
  Book,
  Clapperboard,
  History,
} from 'lucide-react';
import { getClubRecentActivityFn } from '../../api/clubApi';
import { formatDistanceToNow } from 'date-fns';
import { Link } from 'react-router-dom';

interface RecentActivityProps {
  clubId: string;
}

interface ActivityMetadata {
  episodes?: number;
  pages?: number;
  time?: number;
  xp?: number;
  rating?: number;
  hasSpoilers?: boolean;
}

interface Activity {
  type: 'log' | 'review';
  _id: string;
  user: {
    _id: string;
    username: string;
    avatar?: string;
  };
  media: {
    _id: string;
    title: string;
  };
  clubMedia: boolean;
  content: string;
  metadata: ActivityMetadata;
  createdAt: string;
}

const getMediaTypeIcon = (metadata: ActivityMetadata) => {
  // Try to determine media type from metadata
  if (metadata.episodes) return <Play className="w-4 h-4 text-primary" />;
  if (metadata.pages) return <Book className="w-4 h-4 text-secondary" />;
  return <Clapperboard className="w-4 h-4 text-accent" />;
};

const formatActivityContent = (activity: Activity) => {
  if (activity.type === 'log') {
    const parts = [];
    if (activity.metadata.episodes) {
      parts.push(
        `${activity.metadata.episodes} episode${activity.metadata.episodes !== 1 ? 's' : ''}`
      );
    }
    if (activity.metadata.pages) {
      parts.push(
        `${activity.metadata.pages} page${activity.metadata.pages !== 1 ? 's' : ''}`
      );
    }
    if (activity.metadata.time) {
      parts.push(`${activity.metadata.time} min`);
    }

    const progressText = parts.length > 0 ? parts.join(', ') : 'activity';
    return `logged ${progressText}`;
  } else {
    const rating = activity.metadata.rating;
    const ratingText = rating ? ` (${rating}★)` : '';
    return `reviewed${ratingText}`;
  }
};

export default function RecentActivity({ clubId }: RecentActivityProps) {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useInfiniteQuery({
      queryKey: ['clubRecentActivity', clubId],
      queryFn: ({ pageParam = 1 }: { pageParam?: number }) =>
        getClubRecentActivityFn(clubId, {
          limit: 10,
          days: 7,
          page: pageParam,
        }),
      getNextPageParam: (
        lastPage: { activities: Activity[]; total: number; hasMore: boolean },
        allPages: Array<{
          activities: Activity[];
          total: number;
          hasMore: boolean;
        }>
      ) => (lastPage.hasMore ? allPages.length + 1 : undefined),
      enabled: !!clubId,
      staleTime: Infinity,
      initialPageParam: 1,
    });

  const activities = data?.pages.flatMap((page) => page.activities) || [];

  if (isLoading && activities.length === 0) {
    return (
      <div className="card bg-base-100 shadow-sm">
        <div className="card-body">
          <h2 className="card-title text-lg mb-4 flex items-center gap-2">
            <History className="text-xl" />
            Recent Activity
          </h2>
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="avatar placeholder">
                  <div className="bg-base-300 rounded-full w-8 h-8 animate-pulse"></div>
                </div>
                <div className="flex-1 space-y-1">
                  <div className="h-3 bg-base-300 rounded animate-pulse w-3/4"></div>
                  <div className="h-2 bg-base-300 rounded animate-pulse w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!isLoading && activities.length === 0) {
    return (
      <div className="card bg-base-100 shadow-sm">
        <div className="card-body">
          <h2 className="card-title text-lg mb-4 flex items-center gap-2">
            <History className="text-xl" />
            Recent Activity
          </h2>
          <div className="text-center py-6 text-base-content/60">
            <History className="mx-auto text-2xl mb-2 opacity-50" />
            <p className="text-sm">No recent activity</p>
            <p className="text-xs">
              Activity from the last 7 days will appear here
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card bg-base-100 shadow-sm">
      <div className="card-body">
        <h2 className="card-title text-lg mb-4 flex items-center gap-2">
          <History className="text-xl" />
          Recent Activity
        </h2>

        <div className="space-y-3">
          {activities.map((activity: Activity) => (
            <div
              key={`${activity.type}-${activity._id}`}
              className="flex items-start gap-3"
            >
              {/* User Avatar */}
              <Link to={`/user/${activity.user.username}`} className="avatar">
                <div className="w-8 h-8 rounded-full">
                  {activity.user.avatar ? (
                    <img
                      src={activity.user.avatar}
                      alt={activity.user.username}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="bg-base-300 flex items-center justify-center text-xs font-semibold">
                      {activity.user.username.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
              </Link>

              {/* Activity Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1 flex-wrap">
                  <Link
                    to={`/user/${activity.user.username}`}
                    className="font-semibold text-sm truncate hover:underline"
                  >
                    {activity.user.username}
                  </Link>
                  <span className="text-sm text-base-content/70">
                    {formatActivityContent(activity)}
                  </span>
                </div>

                {/* Media Title as main line */}
                <div className="flex items-center gap-1 mt-1">
                  {activity.type === 'log' ? (
                    <Bookmark className="w-3 h-3 text-primary flex-shrink-0" />
                  ) : (
                    <MessageSquareText className="w-3 h-3 text-secondary flex-shrink-0" />
                  )}
                  <span className="text-xs text-base-content/60 truncate">
                    {activity.media.title}
                  </span>
                </div>

                {/* Club Media Label */}
                {activity.clubMedia && (
                  <span className="text-xs text-primary font-semibold mt-1 block">
                    Club Media
                  </span>
                )}

                {/* Timestamp */}
                <span className="text-xs text-base-content/40 mt-1 block">
                  {formatDistanceToNow(new Date(activity.createdAt), {
                    addSuffix: true,
                  })}
                </span>
              </div>

              {/* Activity Type Indicator */}
              <div className="flex-shrink-0">
                {activity.type === 'log' ? (
                  getMediaTypeIcon(activity.metadata)
                ) : (
                  <div className="flex items-center gap-1">
                    <Star className="w-3 h-3 text-warning" />
                    {activity.metadata.rating && (
                      <span className="text-xs font-semibold">
                        {activity.metadata.rating}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {hasNextPage && (
          <div className="text-center mt-4">
            <button
              className="btn btn-sm btn-primary"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
            >
              {isFetchingNextPage ? 'Loading...' : 'Load More'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

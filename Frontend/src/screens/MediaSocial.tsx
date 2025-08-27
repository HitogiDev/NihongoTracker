import { useState } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  compareUserStatsFn,
  getGlobalMediaStatsFn,
  getRecentMediaLogsFn,
  IComparisonResult,
} from '../api/trackerApi';
import { OutletMediaContextType, ILog } from '../types';
import { useUserDataStore } from '../store/userData';
import LogCard from '../components/LogCard';
import { numberWithCommas } from '../utils/utils';
import { toast } from 'react-toastify';
import type { AxiosError } from 'axios';

export default function MediaSocial() {
  const { mediaDocument, mediaType } =
    useOutletContext<OutletMediaContextType>();
  const { user: currentUser } = useUserDataStore();

  // Basic guards
  const mediaId = mediaDocument?.contentId;
  const type = mediaDocument?.type || mediaType;
  const allowedTypes: ILog['type'][] = [
    'anime',
    'manga',
    'reading',
    'vn',
    'video',
    'movie',
    'tv show',
    'audio',
    'other',
  ];
  const logType = allowedTypes.includes(type as ILog['type'])
    ? (type as ILog['type'])
    : undefined;

  // Fetch aggregate media stats (global for this media/type)
  const {
    data: mediaStats,
    isLoading: statsLoading,
    error: statsError,
    refetch: refetchStats,
  } = useQuery({
    queryKey: ['mediaStats', mediaId, type],
    queryFn: () => {
      if (!mediaId || !type) throw new Error('Missing media parameters');
      return getGlobalMediaStatsFn(mediaId, type);
    },
    enabled: !!mediaId && !!type,
    staleTime: 10 * 60 * 1000,
  });

  // Fetch recent logs across all users for this media (paginated by increasing limit)
  const [globalLimit, setGlobalLimit] = useState(10);
  const {
    data: globalLogs,
    isLoading: globalLogsLoading,
    error: globalLogsError,
    refetch: refetchGlobalLogs,
  } = useQuery({
    queryKey: ['media', 'recent', mediaId, type, globalLimit],
    queryFn: () => {
      if (!mediaId || !logType) throw new Error('Missing params');
      return getRecentMediaLogsFn(mediaId, logType, globalLimit);
    },
    enabled: !!mediaId && !!logType,
    staleTime: 60 * 1000,
  });

  // Share current page helper
  function shareCurrentPage() {
    const shareUrl = window.location.href;
    if (navigator.share) {
      navigator
        .share({
          title: mediaDocument?.title?.contentTitleNative || 'NihongoTracker',
          text: 'Check out this media social page on NihongoTracker',
          url: shareUrl,
        })
        .catch(() => {
          navigator.clipboard
            .writeText(shareUrl)
            .then(() => toast.success('Link copied to clipboard!'))
            .catch(() => toast.success('Link copied to clipboard!'));
        });
    } else {
      navigator.clipboard
        .writeText(shareUrl)
        .then(() => toast.success('Link copied to clipboard!'))
        .catch(() => toast.success('Link copied to clipboard!'));
    }
  }

  // Compare with a friend
  const [friend, setFriend] = useState('');
  const [comparison, setComparison] = useState<IComparisonResult | null>(null);
  const { mutate: runCompare, isPending: comparing } = useMutation({
    mutationFn: async () => {
      const friendTrim = friend.trim();
      if (!currentUser?.username || !friendTrim || !mediaId || !type)
        throw new Error('Missing comparison params');
      if (friendTrim === currentUser.username) {
        toast.info("That's you! Enter a different username");
        return null;
      }
      const res = await compareUserStatsFn(
        currentUser.username,
        friendTrim,
        mediaId,
        type
      );
      return res;
    },
    onSuccess: (res) => {
      if (res) setComparison(res);
    },
    onError: (err: unknown) => {
      let msg = 'Comparison failed';
      const axiosErr = err as AxiosError<{ message?: string }>;
      if (axiosErr?.response?.data?.message)
        msg = axiosErr.response.data.message;
      else if (err instanceof Error && err.message) msg = err.message;
      toast.error(msg);
    },
  });

  // Avoid toasting during render; show inline alerts instead below

  return (
    <div className="min-h-screen">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl md:text-2xl font-bold">
              Social for {mediaDocument?.title?.contentTitleNative}
            </h2>
            <p className="text-sm text-base-content/60">
              See community stats for this title and share your page.
            </p>
          </div>
          <button onClick={shareCurrentPage} className="btn btn-primary">
            Share
          </button>
        </div>

        {/* Stats */}
        <div className="card bg-base-100 shadow-lg mb-6">
          <div className="card-body">
            <h3 className="card-title text-lg mb-2">Media-wide stats</h3>
            {statsError && (
              <div role="alert" className="alert alert-error mb-4">
                <span>
                  {(statsError as Error)?.message ||
                    'Failed to load media stats'}
                </span>
                <button className="btn btn-sm" onClick={() => refetchStats()}>
                  Retry
                </button>
              </div>
            )}
            {statsLoading ? (
              <div className="w-full" aria-busy>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="card bg-base-200">
                      <div className="card-body">
                        <div className="skeleton h-4 w-24 mb-2" />
                        <div className="skeleton h-8 w-32 mb-2" />
                        <div className="skeleton h-3 w-20" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : mediaStats ? (
              <div className="stats stats-vertical sm:stats-horizontal shadow w-full">
                <div className="stat">
                  <div className="stat-title">Total Logs</div>
                  <div className="stat-value text-primary">
                    {numberWithCommas(mediaStats.total.logs || 0)}
                  </div>
                  <div className="stat-desc">All-time</div>
                </div>
                <div className="stat">
                  <div className="stat-title">Total XP</div>
                  <div className="stat-value text-secondary">
                    {numberWithCommas(mediaStats.total.xp || 0)}
                  </div>
                  <div className="stat-desc">All-time</div>
                </div>
                {(mediaStats.total.minutes || 0) > 0 && (
                  <div className="stat">
                    <div className="stat-title">Total Time</div>
                    <div className="stat-value text-accent">
                      {mediaStats.total.minutes >= 60
                        ? `${Math.floor(mediaStats.total.minutes / 60)}h ${mediaStats.total.minutes % 60}m`
                        : `${mediaStats.total.minutes}m`}
                    </div>
                    <div className="stat-desc">All-time</div>
                  </div>
                )}
                {(mediaStats.total.characters || 0) > 0 && (
                  <div className="stat">
                    <div className="stat-title">Characters Read</div>
                    <div className="stat-value text-info">
                      {numberWithCommas(mediaStats.total.characters)}
                    </div>
                    <div className="stat-desc">All-time</div>
                  </div>
                )}
                {(mediaStats.total.pages || 0) > 0 && (
                  <div className="stat">
                    <div className="stat-title">Pages</div>
                    <div className="stat-value text-warning">
                      {numberWithCommas(mediaStats.total.pages)}
                    </div>
                    <div className="stat-desc">All-time</div>
                  </div>
                )}
                {(mediaStats.total.episodes || 0) > 0 && (
                  <div className="stat">
                    <div className="stat-title">Episodes</div>
                    <div className="stat-value text-success">
                      {numberWithCommas(mediaStats.total.episodes)}
                    </div>
                    <div className="stat-desc">All-time</div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm text-base-content/60">
                No stats available for this media yet.
              </div>
            )}
          </div>
        </div>

        {/* Compare with a friend */}
        <div className="card bg-base-100 shadow-lg mb-6">
          <div className="card-body">
            <div className="flex items-center justify-between gap-4 mb-3">
              <h3 className="card-title text-lg">Compare with a friend</h3>
            </div>
            <div className="join w-full max-w-xl">
              <input
                type="text"
                className="input input-bordered join-item w-full"
                placeholder="Enter a username"
                value={friend}
                onChange={(e) => setFriend(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !comparing && friend.trim()) {
                    runCompare();
                  }
                }}
              />
              <button
                className="btn btn-primary join-item"
                onClick={() => runCompare()}
                disabled={comparing || !friend.trim()}
              >
                {comparing ? (
                  <span className="loading loading-spinner loading-sm" />
                ) : (
                  'Compare'
                )}
              </button>
              {comparison && (
                <button
                  className="btn btn-ghost join-item"
                  onClick={() => setComparison(null)}
                >
                  Clear
                </button>
              )}
            </div>

            {comparison && (
              <div className="mt-4 overflow-x-auto" aria-live="polite">
                <div className="stats stats-vertical lg:stats-horizontal shadow">
                  <div className="stat">
                    <div className="stat-title">Total XP</div>
                    <div className="stat-value text-primary">
                      {numberWithCommas(comparison.user1.stats.totalXp)}
                    </div>
                    <div className="stat-desc">
                      vs {comparison.user2.username}:{' '}
                      {numberWithCommas(comparison.user2.stats.totalXp)}
                    </div>
                  </div>
                  <div className="stat">
                    <div className="stat-title">Time</div>
                    <div className="stat-value text-secondary">
                      {comparison.user1.stats.totalTime >= 60
                        ? `${Math.floor(comparison.user1.stats.totalTime / 60)}h ${comparison.user1.stats.totalTime % 60}m`
                        : `${comparison.user1.stats.totalTime}m`}
                    </div>
                    <div className="stat-desc">
                      vs {comparison.user2.username}:{' '}
                      {comparison.user2.stats.totalTime >= 60
                        ? `${Math.floor(comparison.user2.stats.totalTime / 60)}h ${comparison.user2.stats.totalTime % 60}m`
                        : `${comparison.user2.stats.totalTime}m`}
                    </div>
                  </div>
                  {(comparison.user1.stats.totalChars || 0) > 0 && (
                    <div className="stat">
                      <div className="stat-title">Characters</div>
                      <div className="stat-value text-info">
                        {numberWithCommas(comparison.user1.stats.totalChars)}
                      </div>
                      <div className="stat-desc">
                        vs {comparison.user2.username}:{' '}
                        {numberWithCommas(comparison.user2.stats.totalChars)}
                      </div>
                    </div>
                  )}
                  {(comparison.user1.stats.totalPages || 0) > 0 && (
                    <div className="stat">
                      <div className="stat-title">Pages</div>
                      <div className="stat-value text-warning">
                        {numberWithCommas(comparison.user1.stats.totalPages)}
                      </div>
                      <div className="stat-desc">
                        vs {comparison.user2.username}:{' '}
                        {numberWithCommas(comparison.user2.stats.totalPages)}
                      </div>
                    </div>
                  )}
                  {(comparison.user1.stats.totalEpisodes || 0) > 0 && (
                    <div className="stat">
                      <div className="stat-title">Episodes</div>
                      <div className="stat-value text-success">
                        {numberWithCommas(comparison.user1.stats.totalEpisodes)}
                      </div>
                      <div className="stat-desc">
                        vs {comparison.user2.username}:{' '}
                        {numberWithCommas(comparison.user2.stats.totalEpisodes)}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Global recent activity for this media */}
        <div className="card bg-base-100 shadow-lg mb-6">
          <div className="card-body">
            <div className="flex items-center justify-between mb-4">
              <h3 className="card-title text-lg">Recent activity (everyone)</h3>
              {globalLogs && globalLogs.length > 0 && (
                <div className="badge badge-neutral">
                  {globalLogs.length} item{globalLogs.length !== 1 ? 's' : ''}
                </div>
              )}
            </div>
            {globalLogsError && (
              <div role="alert" className="alert alert-error mb-4">
                <span>
                  {(globalLogsError as Error)?.message ||
                    'Failed to load recent activity'}
                </span>
                <button
                  className="btn btn-sm"
                  onClick={() => refetchGlobalLogs()}
                >
                  Retry
                </button>
              </div>
            )}
            {globalLogsLoading ? (
              <div className="space-y-3" aria-busy>
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="card bg-base-200">
                    <div className="card-body">
                      <div className="flex items-center gap-4">
                        <div className="skeleton h-12 w-12 rounded-full" />
                        <div className="flex-1">
                          <div className="skeleton h-4 w-1/3 mb-2" />
                          <div className="skeleton h-3 w-1/2" />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : globalLogs && globalLogs.length > 0 ? (
              <div>
                <div className="space-y-3">
                  {globalLogs.map((log) => {
                    const logWithUser = log as unknown as {
                      user?: { username?: string; avatar?: string };
                    };
                    const uname = logWithUser.user?.username;
                    const avatar = logWithUser.user?.avatar;
                    return (
                      <div key={log._id} className="space-y-2">
                        <div className="flex items-center gap-2 text-sm text-base-content/70">
                          {avatar ? (
                            <img
                              src={avatar}
                              alt="avatar"
                              className="w-6 h-6 rounded-full"
                            />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-base-300" />
                          )}
                          {uname ? (
                            <Link
                              to={`/user/${encodeURIComponent(uname)}`}
                              className="link link-hover"
                            >
                              @{uname}
                            </Link>
                          ) : (
                            <span>@unknown</span>
                          )}
                        </div>
                        <LogCard log={log} user={uname} />
                      </div>
                    );
                  })}
                </div>
                {globalLogs.length >= globalLimit && (
                  <div className="mt-4 text-center">
                    <button
                      className="btn"
                      onClick={() => setGlobalLimit((l) => l + 10)}
                      disabled={globalLogsLoading}
                    >
                      {globalLogsLoading ? (
                        <span className="loading loading-spinner loading-sm" />
                      ) : (
                        'Load more'
                      )}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-10 text-base-content/60">
                No recent public activity yet for this media.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

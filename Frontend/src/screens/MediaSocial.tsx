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
import { useTranslation } from 'react-i18next';

export default function MediaSocial() {
  const { t } = useTranslation(['media', 'common']);
  const { mediaDocument, mediaType } =
    useOutletContext<OutletMediaContextType>();
  const { user: currentUser } = useUserDataStore();

  const mediaId = mediaDocument?.contentId;
  const type = mediaDocument?.type || mediaType;
  const allowedTypes: ILog['type'][] = [
    'anime',
    'manga',
    'reading',
    'vn',
    'game',
    'video',
    'movie',
    'tv show',
    'book',
    'audio',
    'other',
  ];
  const logType = allowedTypes.includes(type as ILog['type'])
    ? (type as ILog['type'])
    : undefined;

  const normalizedType = (type || '').toLowerCase().trim();
  const socialMetricType: 'episodes' | 'pages' | 'characters' | null = (() => {
    if (normalizedType === 'anime' || normalizedType === 'tv show') {
      return 'episodes';
    }

    if (normalizedType === 'manga') {
      return 'pages';
    }

    if (
      normalizedType === 'vn' ||
      normalizedType === 'game' ||
      normalizedType === 'reading' ||
      normalizedType === 'light novel' ||
      normalizedType === 'light novels'
    ) {
      return 'characters';
    }

    return null;
  })();

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

  // Compare with a friend
  const [friend, setFriend] = useState('');
  const [comparison, setComparison] = useState<IComparisonResult | null>(null);
  const { mutate: runCompare, isPending: comparing } = useMutation({
    mutationFn: async () => {
      const friendTrim = friend.trim();
      if (!currentUser?.username || !friendTrim || !mediaId || !type)
        throw new Error('Missing comparison params');
      if (friendTrim === currentUser.username) {
        toast.info(t('social.compareSelf'));
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
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl md:text-2xl font-bold">
              Social for {mediaDocument?.title?.contentTitleNative}
            </h2>
            <p className="text-sm text-base-content/60">
              {t('social.subtitle')}
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="card surface mb-6">
          <div className="card-body">
            <h3 className="card-title text-lg mb-2">
              {t('social.mediaWideStats')}
            </h3>
            {statsError && (
              <div role="alert" className="alert alert-error mb-4">
                <span>
                  {(statsError as Error)?.message ||
                    'Failed to load media stats'}
                </span>
                <button className="btn btn-sm" onClick={() => refetchStats()}>
                  {t('social.retry')}
                </button>
              </div>
            )}
            {statsLoading ? (
              <div className="w-full" aria-busy>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="card surface-muted">
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
              <div className="stats stats-vertical sm:stats-horizontal shadow-sm w-full">
                <div className="stat">
                  <div className="stat-title">{t('social.totalLogs')}</div>
                  <div className="stat-value text-primary">
                    {numberWithCommas(mediaStats.total.logs || 0)}
                  </div>
                  <div className="stat-desc">{t('social.allTime')}</div>
                </div>
                <div className="stat">
                  <div className="stat-title">{t('stats.totalXp')}</div>
                  <div className="stat-value text-secondary">
                    {numberWithCommas(mediaStats.total.xp || 0)}
                  </div>
                  <div className="stat-desc">{t('social.allTime')}</div>
                </div>
                {(mediaStats.total.minutes || 0) > 0 && (
                  <div className="stat">
                    <div className="stat-title">{t('stats.totalTime')}</div>
                    <div className="stat-value text-accent">
                      {mediaStats.total.minutes >= 60
                        ? `${Math.floor(mediaStats.total.minutes / 60)}h ${mediaStats.total.minutes % 60}m`
                        : `${mediaStats.total.minutes}m`}
                    </div>
                    <div className="stat-desc">{t('social.allTime')}</div>
                  </div>
                )}
                {socialMetricType === 'characters' &&
                  (mediaStats.total.characters || 0) > 0 && (
                    <div className="stat">
                      <div className="stat-title">{t('stats.charsRead')}</div>
                      <div className="stat-value text-info">
                        {numberWithCommas(mediaStats.total.characters)}
                      </div>
                      <div className="stat-desc">{t('social.allTime')}</div>
                    </div>
                  )}
                {socialMetricType === 'pages' &&
                  (mediaStats.total.pages || 0) > 0 && (
                    <div className="stat">
                      <div className="stat-title">{t('stats.pagesLabel')}</div>
                      <div className="stat-value text-warning">
                        {numberWithCommas(mediaStats.total.pages)}
                      </div>
                      <div className="stat-desc">{t('social.allTime')}</div>
                    </div>
                  )}
                {socialMetricType === 'episodes' &&
                  (mediaStats.total.episodes || 0) > 0 && (
                    <div className="stat">
                      <div className="stat-title">
                        {t('stats.episodesLabel')}
                      </div>
                      <div className="stat-value text-success">
                        {numberWithCommas(mediaStats.total.episodes)}
                      </div>
                      <div className="stat-desc">{t('social.allTime')}</div>
                    </div>
                  )}
              </div>
            ) : (
              <div className="text-sm text-base-content/60">
                {t('social.noStats')}
              </div>
            )}
          </div>
        </div>

        {/* Compare with a friend */}
        <div className="card surface mb-6">
          <div className="card-body">
            <div className="flex items-center justify-between gap-4 mb-3">
              <h3 className="card-title text-lg">{t('social.compare')}</h3>
            </div>
            <div className="join w-full max-w-xl">
              <input
                type="text"
                className="input join-item w-full"
                placeholder={t('social.usernamePlaceholder')}
                value={friend}
                onChange={(e) => setFriend(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !comparing && friend.trim()) {
                    runCompare();
                  }
                }}
              />
              <button
                className="join-item btn btn-primary btn-sm"
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
                  className="join-item btn btn-ghost btn-sm"
                  onClick={() => setComparison(null)}
                >
                  {t('common.clear')}
                </button>
              )}
            </div>

            {comparison && (
              <div className="mt-4 overflow-x-auto" aria-live="polite">
                <div className="stats stats-vertical lg:stats-horizontal shadow-sm">
                  <div className="stat">
                    <div className="stat-title">{t('stats.totalXp')}</div>
                    <div className="stat-value text-primary">
                      {numberWithCommas(comparison.user1.stats.totalXp)}
                    </div>
                    <div className="stat-desc">
                      vs {comparison.user2.username}:{' '}
                      {numberWithCommas(comparison.user2.stats.totalXp)}
                    </div>
                  </div>
                  <div className="stat">
                    <div className="stat-title">{t('stats.timeLabel')}</div>
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
                  {socialMetricType === 'characters' &&
                    (comparison.user1.stats.totalChars || 0) > 0 && (
                      <div className="stat">
                        <div className="stat-title">
                          {t('stats.charactersLabel')}
                        </div>
                        <div className="stat-value text-info">
                          {numberWithCommas(comparison.user1.stats.totalChars)}
                        </div>
                        <div className="stat-desc">
                          vs {comparison.user2.username}:{' '}
                          {numberWithCommas(comparison.user2.stats.totalChars)}
                        </div>
                      </div>
                    )}
                  {socialMetricType === 'pages' &&
                    (comparison.user1.stats.totalPages || 0) > 0 && (
                      <div className="stat">
                        <div className="stat-title">
                          {t('stats.pagesLabel')}
                        </div>
                        <div className="stat-value text-warning">
                          {numberWithCommas(comparison.user1.stats.totalPages)}
                        </div>
                        <div className="stat-desc">
                          vs {comparison.user2.username}:{' '}
                          {numberWithCommas(comparison.user2.stats.totalPages)}
                        </div>
                      </div>
                    )}
                  {socialMetricType === 'episodes' &&
                    (comparison.user1.stats.totalEpisodes || 0) > 0 && (
                      <div className="stat">
                        <div className="stat-title">
                          {t('stats.episodesLabel')}
                        </div>
                        <div className="stat-value text-success">
                          {numberWithCommas(
                            comparison.user1.stats.totalEpisodes
                          )}
                        </div>
                        <div className="stat-desc">
                          vs {comparison.user2.username}:{' '}
                          {numberWithCommas(
                            comparison.user2.stats.totalEpisodes
                          )}
                        </div>
                      </div>
                    )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Global recent activity for this media */}
        <div className="card surface mb-6">
          <div className="card-body">
            <div className="flex items-center justify-between mb-4">
              <h3 className="card-title text-lg">
                {t('social.recentActivity')}
              </h3>
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
                  {t('social.retry')}
                </button>
              </div>
            )}
            {globalLogsLoading ? (
              <div className="space-y-3" aria-busy>
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="card surface-muted">
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
                    const username = logWithUser.user?.username;
                    const avatar = logWithUser.user?.avatar;
                    return (
                      <div key={log._id} className="space-y-2">
                        <div className="flex items-center gap-2 text-sm text-base-content/70">
                          {avatar ? (
                            <img
                              src={avatar}
                              alt={t('social.avatarAlt')}
                              className="w-6 h-6 rounded-full"
                            />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-base-300" />
                          )}
                          {username ? (
                            <Link
                              to={`/user/${encodeURIComponent(username)}`}
                              className="link link-hover"
                            >
                              {username}
                            </Link>
                          ) : (
                            <span>unknown</span>
                          )}
                        </div>
                        <LogCard log={log} user={username} />
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
                {t('social.noRecentActivity')}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

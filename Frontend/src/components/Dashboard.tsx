import { Link, useSearchParams } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';
import type { ParseKeys } from 'i18next';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useUserDataStore } from '../store/userData';
import {
  useInfiniteQuery,
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import {
  getDashboardHoursFn,
  getRecentLogsFn,
  getRankingSummaryFn,
  getUserFn,
  getAverageColorFn,
  hideRecentMediaFn,
  getHiddenRecentMediaFn,
} from '../api/trackerApi';
import {
  Flame,
  CirclePlus,
  Trophy,
  Plus,
  ChevronDown,
  ChevronUp,
  ChartNoAxesColumn,
  User,
  Play,
  Minus,
  Settings2,
  Eye,
  Globe2,
  Users,
  UsersRound,
  LayoutGrid,
  List,
} from 'lucide-react';
import { numberWithCommas } from '../utils/utils';
import { useDateFormatting } from '../hooks/useDateFormatting';
import ClubRanking from './club/ClubRanking';
import QuickLog from './QuickLog';
import {
  IMediaDocument,
  ILog,
  ILoginResponse,
  IHiddenRecentMediaItem,
} from '../types';
import Modal from './ui/Modal';
import Button from './ui/Button';
import Field from './ui/Field';
import {
  ActivityFeedScope,
  getActivityFeedFn,
} from '../api/activitiesApi';
import ActivityCard from './social/ActivityCard';
import { useHideRankingFeatures } from '../hooks/useRankingVisibility';
import GettingStartedModal from './GettingStartedModal';

type DashboardActivityScope = Exclude<ActivityFeedScope, 'user'>;
type DashboardLayout = 'classic' | 'compact';

const ACTIVITY_SCOPES: Array<{
  value: DashboardActivityScope;
  icon: React.ElementType;
}> = [
  { value: 'following', icon: Users },
  { value: 'clubs', icon: UsersRound },
  { value: 'global', icon: Globe2 },
];

const RECENT_MEDIA_LIMIT_STORAGE_KEY = 'dashboard:recentMediaLimit';
const COMPACT_MEDIA_LIMIT_STORAGE_KEY = 'dashboard:compactMediaLimit';
const DASHBOARD_LAYOUT_STORAGE_KEY = 'dashboard:layout';
const DEFAULT_RECENT_MEDIA_LIMIT = 4;
const DEFAULT_COMPACT_MEDIA_LIMIT = 7;
const MAX_RECENT_MEDIA_LIMIT = 12;
const DASHBOARD_CARD_EYEBROW_CLASS =
  'text-[11px] uppercase tracking-[0.2em] text-base-content/60';
const DASHBOARD_CARD_TITLE_CLASS =
  'card-title text-xl font-semibold leading-snug text-base-content';
const DASHBOARD_CARD_DESCRIPTION_CLASS = 'text-sm text-base-content/65';

function getStoredRecentMediaLimit(storageKey: string, defaultLimit: number) {
  try {
    const storedLimit = Number(window.localStorage.getItem(storageKey));
    if (
      Number.isInteger(storedLimit) &&
      storedLimit >= 1 &&
      storedLimit <= MAX_RECENT_MEDIA_LIMIT
    ) {
      return storedLimit;
    }
  } catch {
    // Storage can be unavailable in private browsing modes.
  }
  return defaultLimit;
}

function getStoredDashboardLayout(): DashboardLayout {
  try {
    return window.localStorage.getItem(DASHBOARD_LAYOUT_STORAGE_KEY) ===
      'compact'
      ? 'compact'
      : 'classic';
  } catch {
    return 'classic';
  }
}

function Dashboard() {
  const { t } = useTranslation('home');
  const { user, setUser } = useUserDataStore();
  const hideRankingFeatures = useHideRankingFeatures();
  const username = user?.username;
  const userTimezone = user?.settings?.timezone ?? 'UTC';
  const [searchParams] = useSearchParams();
  const focusedActivityId = searchParams.get('activity');
  const requestedFeed = searchParams.get('feed');

  // Pick the key once so the greeting stays put, but translate on every render
  // so it follows a language change.
  const [greetingKey] = useState<ParseKeys<'home'>>(() => {
    const keys: ParseKeys<'home'>[] = [
      'dashboard.greetings.immersion',
      'dashboard.greetings.track',
      'dashboard.greetings.fluency',
      'dashboard.greetings.keepUp',
      'dashboard.greetings.journey',
    ];
    return keys[Math.floor(Math.random() * keys.length)];
  });

  const { formatRelativeDate, formatNumber } = useDateFormatting();
  const [quickLogOpen, setQuickLogOpen] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<
    IMediaDocument | undefined
  >();
  const [activityScope, setActivityScope] = useState<DashboardActivityScope>(() =>
    requestedFeed === 'following' ||
    requestedFeed === 'clubs' ||
    requestedFeed === 'global'
      ? requestedFeed
      : 'global'
  );
  const [mediaToRemove, setMediaToRemove] = useState<{
    mediaId: string;
    title: string;
  } | null>(null);
  const [manageHiddenOpen, setManageHiddenOpen] = useState(false);
  const [recentMediaLimit, setRecentMediaLimit] = useState(() =>
    getStoredRecentMediaLimit(
      RECENT_MEDIA_LIMIT_STORAGE_KEY,
      DEFAULT_RECENT_MEDIA_LIMIT
    )
  );
  const [compactMediaLimit, setCompactMediaLimit] = useState(() =>
    getStoredRecentMediaLimit(
      COMPACT_MEDIA_LIMIT_STORAGE_KEY,
      DEFAULT_COMPACT_MEDIA_LIMIT
    )
  );
  const [dashboardLayout, setDashboardLayout] = useState<DashboardLayout>(
    getStoredDashboardLayout
  );
  const [onboardingOpen, setOnboardingOpen] = useState(false);

  useEffect(() => {
    if (!username) return;
    try {
      if (sessionStorage.getItem('nihongoTracker:onboardingPending') === username) {
        sessionStorage.removeItem('nihongoTracker:onboardingPending');
        setOnboardingOpen(true);
      }
    } catch {
      // Storage can be unavailable in private browsing modes.
    }
  }, [username]);

  const queryClient = useQueryClient();

  const hideMediaMutation = useMutation({
    mutationFn: (mediaId: string) => hideRecentMediaFn('add', mediaId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recentLogs', username] });
      setMediaToRemove(null);
    },
  });

  const { data: hours } = useQuery({
    queryKey: ['logsHero', username],
    queryFn: () => getDashboardHoursFn(username),
    staleTime: Infinity,
    enabled: !!username,
  });

  const { data: logs } = useQuery({
    queryKey: ['recentLogs', username],
    queryFn: () => getRecentLogsFn(username).catch(() => []),
    staleTime: Infinity,
    enabled: !!username,
  });

  const { data: rankingSummary } = useQuery({
    queryKey: ['rankingSummary', username, userTimezone],
    queryFn: () => getRankingSummaryFn(username ?? '', userTimezone),
    enabled: !!username && !hideRankingFeatures,
    staleTime: 1000 * 60 * 5,
  });

  // Fetch live user profile for streak: this query key ['user', username]
  // gets invalidated by LogCard's delete/update mutations, so the streak
  // updates reactively without relying on the stale auth store.
  const { data: liveUserProfile } = useQuery({
    queryKey: ['user', username],
    queryFn: () => getUserFn(username!),
    enabled: !!username,
    staleTime: 1000 * 60,
  });

  const {
    data: activityPages,
    isLoading: activityLoading,
    isError: activityError,
    refetch: refetchActivity,
    fetchNextPage: fetchNextActivityPage,
    hasNextPage: hasNextActivityPage,
    isFetchingNextPage: isFetchingNextActivityPage,
  } = useInfiniteQuery({
    queryKey: ['socialActivities', activityScope],
    queryFn: ({ pageParam }) =>
      getActivityFeedFn({
        scope: activityScope,
        before: pageParam,
        limit: 20,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: Boolean(username),
    staleTime: 60_000,
  });

  const socialActivities = useMemo(
    () => activityPages?.pages.flatMap((page) => page.activities) ?? [],
    [activityPages]
  );

  useEffect(() => {
    if (
      requestedFeed === 'following' ||
      requestedFeed === 'clubs' ||
      requestedFeed === 'global'
    ) {
      setActivityScope(requestedFeed);
    }
  }, [requestedFeed]);

  useEffect(() => {
    if (!focusedActivityId) return;
    document
      .getElementById(`activity-${focusedActivityId}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [focusedActivityId, socialActivities.length]);

  const immersionStats = (() => {
    if (!hours) {
      return {
        currentMonth: { reading: 0, listening: 0, total: 0 },
        lastMonth: { reading: 0, listening: 0, total: 0 },
        changes: { reading: 0, listening: 0, total: 0 },
      };
    }

    const currentReadingTime = hours.currentMonth.readingTime / 60;
    const currentListeningTime = hours.currentMonth.listeningTime / 60;
    const currentTotal = hours.currentMonth.totalTime / 60;

    const lastReadingTime = hours.previousMonth.readingTime / 60;
    const lastListeningTime = hours.previousMonth.listeningTime / 60;
    const lastTotal = hours.previousMonth.totalTime / 60;

    const calculatePercentChange = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 100);
    };

    const readingChange = calculatePercentChange(
      currentReadingTime,
      lastReadingTime
    );
    const listeningChange = calculatePercentChange(
      currentListeningTime,
      lastListeningTime
    );
    const totalChange = calculatePercentChange(currentTotal, lastTotal);

    return {
      currentMonth: {
        reading: parseFloat(currentReadingTime.toFixed(1)),
        listening: parseFloat(currentListeningTime.toFixed(1)),
        total: parseFloat(currentTotal.toFixed(1)),
      },
      lastMonth: {
        reading: parseFloat(lastReadingTime.toFixed(1)),
        listening: parseFloat(lastListeningTime.toFixed(1)),
        total: parseFloat(lastTotal.toFixed(1)),
      },
      changes: {
        reading: readingChange,
        listening: listeningChange,
        total: totalChange,
      },
    };
  })();

  const recentMediaHighlights = (() => {
    if (!logs || !Array.isArray(logs)) return [];

    const sortedLogs = [...logs].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    const uniqueLogs: Array<
      ILog & { formattedDate: string; formattedTime: string }
    > = [];
    const seenMedia = new Set<string>();

    for (const log of sortedLogs) {
      if (!log.media?.contentId) {
        continue;
      }

      // Playlist-batch logs share the channel as their media, so a single
      // channel tile would quick-log the whole channel instead of the
      // playlist. Skip them: playlists are not re-logged from here.
      if (log.playlistBatchId) {
        continue;
      }

      const mediaKey = log.media.contentId;
      if (seenMedia.has(mediaKey)) continue;
      seenMedia.add(mediaKey);
      uniqueLogs.push({
        ...log,
        formattedDate: formatRelativeDate(log.date),
        formattedTime: formatTime(log.time, log.episodes, log.chars),
      });
    }

    return uniqueLogs;
  })();

  const recentMediaPanelHighlights = recentMediaHighlights.slice(
    0,
    recentMediaLimit
  );
  const compactMediaHighlights = recentMediaHighlights.slice(
    0,
    compactMediaLimit
  );

  function handleRecentMediaLimitChange(nextLimit: number) {
    const compact = dashboardLayout === 'compact';
    if (compact) {
      setCompactMediaLimit(nextLimit);
    } else {
      setRecentMediaLimit(nextLimit);
    }
    try {
      window.localStorage.setItem(
        compact
          ? COMPACT_MEDIA_LIMIT_STORAGE_KEY
          : RECENT_MEDIA_LIMIT_STORAGE_KEY,
        String(nextLimit)
      );
    } catch {
      // Keep the setting for this session if storage is unavailable.
    }
  }

  function handleDashboardLayoutChange(nextLayout: DashboardLayout) {
    setDashboardLayout(nextLayout);
    try {
      window.localStorage.setItem(DASHBOARD_LAYOUT_STORAGE_KEY, nextLayout);
    } catch {
      // Keep the chosen layout for this session if storage is unavailable.
    }
  }

  if (!user) {
    return null;
  }

  function formatTime(minutes?: number, episodes?: number, chars?: number) {
    if (minutes && minutes > 0) {
      const hoursValue = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return hoursValue > 0
        ? `${hoursValue}h ${mins > 0 ? `${mins}m` : ''}`
        : `${mins}m`;
    } else if (episodes) {
      return `${episodes} ep${episodes > 1 ? 's' : ''}`;
    } else if (chars && chars > 0) {
      return formatNumber(chars, {
        notation: 'compact',
        maximumFractionDigits: 1,
      });
    }
    return 'N/A';
  }

  function transformMediaToDocument(
    media?: ILog['media']
  ): IMediaDocument | undefined {
    if (!media) return undefined;
    return {
      contentId: media.contentId,
      title: {
        contentTitleNative: media.title?.contentTitleNative ?? media.contentId,
        contentTitleEnglish: media.title?.contentTitleEnglish,
        contentTitleRomaji: media.title?.contentTitleRomaji,
      },
      contentImage: media.contentImage ?? undefined,
      coverImage:
        (media as IMediaDocument)?.coverImage ??
        media.contentImage ??
        undefined,
      type: (media.type as IMediaDocument['type']) ?? 'anime',
      isAdult: (media as IMediaDocument)?.isAdult ?? false,
      isAdultImage: (media as IMediaDocument)?.isAdultImage ?? false,
    };
  }

  function handleQuickLogOpen(media?: ILog['media']) {
    setSelectedMedia(transformMediaToDocument(media));
    setQuickLogOpen(true);
  }

  // XP/level feedback itself comes from the global LogCelebrationHost:
  // here we only refresh the stored user so the dashboard numbers update.
  async function handleQuickLogSuccess() {
    if (!user?.username) return;

    try {
      const updatedUser = await getUserFn(user.username);

      const loginResponse: ILoginResponse = {
        _id: updatedUser._id || user._id,
        username: updatedUser.username || user.username,
        email: updatedUser.email ?? user.email,
        verified: updatedUser.verified ?? user.verified,
        stats: updatedUser.stats || user.stats,
        avatar: updatedUser.avatar ?? user.avatar,
        banner: updatedUser.banner ?? user.banner,
        titles: updatedUser.titles || user.titles,
        roles: updatedUser.roles || user.roles,
        discordId: updatedUser.discordId ?? '',
        patreon: updatedUser.patreon ?? user.patreon,
        settings: updatedUser.settings ?? user.settings,
        about: updatedUser.about ?? user.about,
      };

      setUser(loginResponse);
    } catch (error) {
      console.error(t('dashboard.refreshFailed'), error);
    }
  }

  // Use live profile data for streak (reactive to log mutations).
  // fall back to auth store while query is loading.
  const streak =
    liveUserProfile?.stats?.currentStreak ?? user.stats?.currentStreak ?? 0;

  const monthlyRanking = rankingSummary?.monthly;
  const xpGapContent = monthlyRanking ? (
    monthlyRanking.nextUser ? (
      <>
        <Trans
          t={t}
          i18nKey="dashboard.ranking.gap"
          values={{
            xp: numberWithCommas(monthlyRanking.nextUser.gap),
            username: monthlyRanking.nextUser.username,
          }}
          components={{
            xp: <span />,
            user: (
              <Link
                to={`/user/${monthlyRanking.nextUser.username}`}
                className="hover:underline"
              />
            ),
          }}
        />
      </>
    ) : (
      t('dashboard.ranking.leading')
    )
  ) : (
    t('dashboard.ranking.notRanked')
  );

  const closeQuickLog = () => {
    setQuickLogOpen(false);
    setSelectedMedia(undefined);
  };

  function handleRemoveMedia(mediaId: string, title: string) {
    setMediaToRemove({ mediaId, title });
  }

  function confirmRemoveMedia() {
    if (mediaToRemove) {
      hideMediaMutation.mutate(mediaToRemove.mediaId);
    }
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 md:pt-28 pb-6 md:pb-8 space-y-6 md:space-y-8">
      <GettingStartedModal
        open={onboardingOpen}
        onClose={() => setOnboardingOpen(false)}
      />
      <QuickLog
        open={quickLogOpen}
        onClose={closeQuickLog}
        media={selectedMedia}
        onLogged={handleQuickLogSuccess}
      />

      <ManageHiddenMedia
        open={manageHiddenOpen}
        onClose={() => setManageHiddenOpen(false)}
        recentMediaLimit={
          dashboardLayout === 'compact' ? compactMediaLimit : recentMediaLimit
        }
        onRecentMediaLimitChange={handleRecentMediaLimitChange}
        onUnhidden={() => {
          queryClient.invalidateQueries({
            queryKey: ['recentLogs', username],
          });
        }}
      />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm uppercase tracking-wide text-primary font-semibold">
            {t('dashboard.welcomeBack')}
          </p>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-base-content">
            {user.username}
          </h1>
          <p className="text-base-content/70 mt-1">{t(greetingKey)}</p>
          <div
            className="join mt-3"
            role="group"
            aria-label={t('dashboard.layout.label')}
          >
            <button
              type="button"
              className={`join-item btn btn-sm ${dashboardLayout === 'classic' ? 'btn-primary' : 'btn-outline'}`}
              aria-pressed={dashboardLayout === 'classic'}
              onClick={() => handleDashboardLayoutChange('classic')}
            >
              <LayoutGrid className="h-4 w-4" />
              {t('dashboard.layout.classic')}
            </button>
            <button
              type="button"
              className={`join-item btn btn-sm ${dashboardLayout === 'compact' ? 'btn-primary' : 'btn-outline'}`}
              aria-pressed={dashboardLayout === 'compact'}
              onClick={() => handleDashboardLayoutChange('compact')}
            >
              <List className="h-4 w-4" />
              {t('dashboard.layout.compact')}
            </button>
          </div>
        </div>
        <div
          className={`hidden md:grid ${
            hideRankingFeatures
              ? 'grid-cols-1 sm:grid-cols-2 gap-3 w-full lg:w-auto'
              : 'grid-cols-1 sm:grid-cols-3 gap-3 w-full lg:w-auto'
          }`}
        >
          <Link to="/log" className="btn btn-primary btn-lg">
            <Plus className="w-5 h-5" />
            {t('dashboard.actions.createLog')}
          </Link>
          <Link
            to={`/user/${user.username}`}
            className="btn btn-secondary btn-lg"
          >
            <User className="w-5 h-5" />
            {t('dashboard.actions.profile')}
          </Link>
          {!hideRankingFeatures && (
            <Link to="/ranking" className="btn btn-accent btn-lg">
              <ChartNoAxesColumn className="w-5 h-5" />
              {t('dashboard.actions.rankings')}
            </Link>
          )}
        </div>
      </div>

      {dashboardLayout === 'compact' && (
        <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_15rem]">
          <div className="card surface min-w-0">
            <div className="card-body gap-4 p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className={DASHBOARD_CARD_EYEBROW_CLASS}>
                  {t('dashboard.recentMedia')}
                </h2>
                <Button
                  appearance="outline"
                  size="sm"
                  onClick={() => setManageHiddenOpen(true)}
                >
                  <Settings2 className="h-4 w-4" />
                  {t('dashboard.manage')}
                </Button>
              </div>
              {compactMediaHighlights.length === 0 ? (
                <p className="py-12 text-center text-sm text-base-content/70">
                  {t('dashboard.recentEmpty')}
                </p>
              ) : (
                <div className="overflow-x-auto pb-1">
                  <div className="flex w-max gap-3">
                    {compactMediaHighlights.map((log) => (
                      <RecentMediaRailTile
                        key={`${log._id}-compact`}
                        log={log}
                        blurAdultContent={user.settings?.blurAdultContent ?? false}
                        onQuickLog={handleQuickLogOpen}
                        onRemove={handleRemoveMedia}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-6 lg:grid-cols-1">
            <div
              className={
                hideRankingFeatures
                  ? 'surface-muted col-span-2 flex items-center gap-2 bg-secondary/10 px-3 py-2 sm:col-span-6 lg:col-span-1'
                  : 'surface-muted flex items-center gap-2 bg-secondary/10 px-3 py-2 sm:col-span-3 lg:col-span-1'
              }
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-field bg-secondary text-secondary-content">
                <Flame className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase text-secondary">
                  {t('dashboard.streak.label')}
                </p>
                <p className="truncate text-sm font-bold">
                  {t('dashboard.streak.days', { count: streak })}
                </p>
              </div>
            </div>
            {!hideRankingFeatures && (
              <Link
                to="/ranking"
                className="surface-muted flex items-center gap-2 bg-primary/10 px-3 py-2 hover:bg-primary/15 sm:col-span-3 lg:col-span-1"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-field bg-primary text-primary-content">
                  <Trophy className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[11px] font-semibold uppercase text-primary">
                    {t('dashboard.monthlyRanking')}
                  </p>
                  <p className="text-sm font-bold">
                    #{monthlyRanking?.position ?? '-'} /{' '}
                    {monthlyRanking?.totalUsers ?? '-'}
                  </p>
                </div>
              </Link>
            )}
            {([
              ['reading', 'text-primary'],
              ['listening', 'text-secondary'],
              ['total', 'text-base-content'],
            ] as const).map(([key, accent]) => {
              const change = immersionStats.changes[key];
              return (
                <div
                  key={key}
                  className="surface-muted col-span-2 flex min-w-0 items-center justify-between gap-2 px-3 py-2 lg:col-span-1"
                >
                  <span className="truncate text-[11px] font-semibold uppercase text-base-content/65">
                    {t(`dashboard.stats.${key}`)}
                  </span>
                  <span className={`shrink-0 text-sm font-bold ${accent}`}>
                    {immersionStats.currentMonth[key]}h
                  </span>
                  <span
                    className={`shrink-0 text-xs ${change > 0 ? 'text-success' : change < 0 ? 'text-error' : 'text-base-content/60'}`}
                    aria-label={
                      change === 0
                        ? t('dashboard.stats.noChange')
                        : t('dashboard.stats.change', {
                            percent: Math.abs(change),
                          })
                    }
                  >
                    {change > 0 ? '+' : change < 0 ? '−' : ''}
                    {Math.abs(change)}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {dashboardLayout === 'classic' && (
        <>
      <div className="xl:hidden">
        <RecentMediaRail
          allLogs={recentMediaHighlights}
          limit={recentMediaLimit}
          onQuickLog={handleQuickLogOpen}
          onRemove={handleRemoveMedia}
          onManage={() => setManageHiddenOpen(true)}
        />
      </div>

      <div
        className={
          hideRankingFeatures
            ? 'grid grid-cols-1 gap-4'
            : 'grid grid-cols-1 md:grid-cols-2 gap-4'
        }
      >
        <div className="card surface-muted bg-secondary/10 shadow-sm">
          <div className="card-body">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-secondary text-secondary-content">
                <Flame className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm uppercase tracking-wide text-secondary">
                  {t('dashboard.streak.label')}
                </p>
                <h3 className="text-2xl font-bold text-base-content">
                  {t('dashboard.streak.days', { count: streak })}
                </h3>
                <p className="text-base-content/70 text-sm">
                  {t('dashboard.streak.hint')}
                </p>
              </div>
            </div>
          </div>
        </div>
        {!hideRankingFeatures && (
          <div className="card surface-muted bg-primary/10 shadow-sm">
          <div className="card-body">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-primary text-primary-content">
                <Trophy className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm uppercase tracking-wide text-primary">
                  {t('dashboard.monthlyRanking')}
                </p>
                <h3 className="text-2xl font-bold text-base-content">
                  #{monthlyRanking?.position ?? '-'} /{' '}
                  {monthlyRanking?.totalUsers ?? '-'}
                </h3>
                <p className="text-base-content/70 text-sm">{xpGapContent}</p>
              </div>
            </div>
          </div>
          </div>
        )}
      </div>

        </>
      )}

      <div
        className={
          dashboardLayout === 'compact'
            ? 'grid min-w-0 grid-cols-1 gap-5'
            : 'grid grid-cols-1 gap-8 xl:grid-cols-3'
        }
      >
        <div className={dashboardLayout === 'compact' ? 'min-w-0 space-y-5' : 'space-y-8 xl:col-span-2'}>
          {dashboardLayout === 'classic' && (
          <div className="card surface">
            <div className="card-body p-4 sm:p-6">
              <h2 className={DASHBOARD_CARD_TITLE_CLASS}>
                {t('dashboard.immersion.title')}
              </h2>
              <p className={`${DASHBOARD_CARD_DESCRIPTION_CLASS} -mt-1 mb-4`}>
                {t('dashboard.immersion.subtitle')}
              </p>
              <div className="grid grid-cols-1 gap-2 sm:gap-4 md:grid-cols-3">
                {[
                  {
                    label: t('dashboard.stats.reading'),
                    value: `${immersionStats.currentMonth.reading}h`,
                    change: immersionStats.changes.reading,
                    accent: 'text-primary',
                  },
                  {
                    label: t('dashboard.stats.listening'),
                    value: `${immersionStats.currentMonth.listening}h`,
                    change: immersionStats.changes.listening,
                    accent: 'text-secondary',
                  },
                  {
                    label: t('dashboard.stats.total'),
                    value: `${immersionStats.currentMonth.total}h`,
                    change: immersionStats.changes.total,
                    accent: 'text-base-content',
                  },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="min-w-0 rounded-box border border-base-300 bg-base-200/60 p-3 sm:p-4"
                  >
                    <p className="break-words text-xs uppercase leading-tight tracking-wide text-base-content/70 sm:text-sm">
                      {stat.label}
                    </p>
                    <p className={`mt-2 text-2xl font-bold sm:text-3xl ${stat.accent}`}>
                      {stat.value}
                    </p>
                    <p
                      className={`text-sm mt-1 inline-flex items-center gap-1 ${
                        stat.change > 0
                          ? 'text-success'
                          : stat.change < 0
                            ? 'text-error'
                            : 'text-base-content/60'
                      }`}
                    >
                      {stat.change > 0 && (
                        <ChevronUp className="w-4 h-4 shrink-0" />
                      )}
                      {stat.change < 0 && (
                        <ChevronDown className="w-4 h-4 shrink-0" />
                      )}
                      {stat.change !== 0
                        ? t('dashboard.stats.change', {
                            percent: Math.abs(stat.change),
                          })
                        : t('dashboard.stats.noChange')}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
          )}

          <div className="card surface">
            <div className="card-body space-y-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <h2 className={DASHBOARD_CARD_TITLE_CLASS}>
                    {t('dashboard.feed.globalFeed')}
                  </h2>
                  <p className={DASHBOARD_CARD_DESCRIPTION_CLASS}>
                    {t('dashboard.feed.subtitle')}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 lg:flex-nowrap lg:shrink-0">
                  <div role="tablist" className="join" aria-label={t('dashboard.feed.globalFeed')}>
                    {ACTIVITY_SCOPES.map(({ value, icon: Icon }) => (
                      <button
                        key={value}
                        type="button"
                        role="tab"
                        className={`join-item btn btn-sm gap-2 ${activityScope === value ? 'btn-primary' : 'btn-outline'}`}
                        aria-selected={activityScope === value}
                        onClick={() => setActivityScope(value)}
                      >
                        <Icon className="h-4 w-4" />
                        {t(`dashboard.feed.scopes.${value}`)}
                      </button>
                    ))}
                  </div>

                </div>
              </div>

              <div className="space-y-3">
                {activityLoading ? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <div key={index} className="skeleton h-32 w-full" />
                  ))
                ) : activityError ? (
                  <div role="alert" className="alert alert-error">
                    <span>{t('dashboard.feed.loadError')}</span>
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => void refetchActivity()}
                    >
                      {t('dashboard.feed.retry')}
                    </button>
                  </div>
                ) : socialActivities.length > 0 ? (
                  socialActivities.map((activity) => (
                    <ActivityCard
                      key={activity._id}
                      activity={activity}
                      highlighted={activity._id === focusedActivityId}
                    />
                  ))
                ) : (
                  <div className="surface-muted p-6 text-center text-sm text-base-content/70">
                    <p>{t(`dashboard.feed.emptyScopes.${activityScope}`)}</p>
                    {activityScope === 'following' && (
                      <p className="mt-1 text-xs">
                        {t('dashboard.feed.followingHint')}
                      </p>
                    )}
                  </div>
                )}
              </div>
              {hasNextActivityPage && (
                <div className="mt-4 flex justify-center">
                  <Button
                    variant="primary"
                    size="sm"
                    appearance="outline"
                    loading={isFetchingNextActivityPage}
                    onClick={() => void fetchNextActivityPage()}
                  >
                    {t('dashboard.feed.loadMore')}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-8">
          {dashboardLayout === 'classic' && <div className="hidden xl:block">
            <RecentMediaPanel
              logs={recentMediaPanelHighlights}
              user={user}
              onQuickLog={handleQuickLogOpen}
              onRemove={handleRemoveMedia}
              onManage={() => setManageHiddenOpen(true)}
            />
          </div>}

          {!hideRankingFeatures && <ClubRanking username={user.username} />}
        </div>
      </div>

      <dialog
        className="modal modal-bottom sm:modal-middle"
        open={mediaToRemove !== null}
      >
        <div className="modal-box">
          <h3 className="font-bold text-lg">{t('dashboard.hideTitle')}</h3>
          <p className="py-4">
            <Trans
              t={t}
              i18nKey="dashboard.hideConfirm"
              values={{ title: mediaToRemove?.title ?? '' }}
              components={{ title: <span className="font-semibold" /> }}
            />
          </p>
          <div className="modal-action">
            <button
              type="button"
              className="btn"
              onClick={() => setMediaToRemove(null)}
            >
              {t('dashboard.actions.cancel')}
            </button>
            <button
              type="button"
              className="btn btn-error"
              onClick={confirmRemoveMedia}
              disabled={hideMediaMutation.isPending}
            >
              {hideMediaMutation.isPending ? (
                <span className="loading loading-spinner loading-sm" />
              ) : (
                t('dashboard.actions.hide')
              )}
            </button>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button type="button" onClick={() => setMediaToRemove(null)}>
            {t('common.close')}
          </button>
        </form>
      </dialog>
    </div>
  );
}

export default Dashboard;

type RecentMediaLog = ILog & { formattedDate: string; formattedTime: string };

type RecentMediaPanelProps = {
  logs: RecentMediaLog[];
  user: ILoginResponse | null;
  onQuickLog: (media?: ILog['media']) => void;
  onRemove: (mediaId: string, title: string) => void;
  onManage: () => void;
};

function RecentMediaPanel({
  logs,
  user,
  onQuickLog,
  onRemove,
  onManage,
}: RecentMediaPanelProps) {
  const { t } = useTranslation('home');

  return (
    <div className="card surface">
      <div className="card-body space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2
              className={`${DASHBOARD_CARD_TITLE_CLASS} flex items-center gap-2`}
            >
              <CirclePlus className="w-5 h-5 text-primary" />
              {t('dashboard.recentMedia')}
            </h2>
            <p className={`${DASHBOARD_CARD_DESCRIPTION_CLASS} mt-1`}>
              {t('dashboard.quickShortcuts')}
            </p>
          </div>
          <Button
            appearance="outline"
            size="sm"
            onClick={onManage}
            className="shrink-0"
          >
            <Settings2 className="w-4 h-4" />
            {t('dashboard.manage')}
          </Button>
        </div>
        {logs.length === 0 ? (
          <p className="text-base-content/70 text-sm">
            {t('dashboard.recentEmpty')}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {logs.map((log) => (
              <RecentMediaTile
                key={log._id}
                log={log}
                user={user}
                onQuickLog={onQuickLog}
                onRemove={onRemove}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

type RecentMediaRailProps = {
  allLogs: RecentMediaLog[];
  limit: number;
  onQuickLog: (media?: ILog['media']) => void;
  onRemove: (mediaId: string, title: string) => void;
  onManage: () => void;
};

function RecentMediaRail({
  allLogs,
  limit,
  onQuickLog,
  onRemove,
  onManage,
}: RecentMediaRailProps) {
  const { t } = useTranslation('home');
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showSwipeHint, setShowSwipeHint] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      const el = scrollRef.current;
      if (el) {
        const needsScroll = el.scrollWidth > el.clientWidth + 4;
        setShowSwipeHint(needsScroll);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [allLogs, limit]);

  const logs = allLogs.slice(0, limit);

  return (
    <div className="card surface">
      <div className="card-body space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className={DASHBOARD_CARD_EYEBROW_CLASS}>
              {t('dashboard.recentMedia')}
            </p>
            <h2 className={DASHBOARD_CARD_TITLE_CLASS}>
              {t('dashboard.jumpBackIn')}
            </h2>
            <p className={`${DASHBOARD_CARD_DESCRIPTION_CLASS} mt-1`}>
              {t('dashboard.quickShortcuts')}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            {showSwipeHint && (
              <span className="text-xs text-base-content/60">
                {t('dashboard.swipe')}
              </span>
            )}
            <Button
              appearance="outline"
              size="sm"
              onClick={onManage}
              aria-label={t('dashboard.manage')}
            >
              <Settings2 className="w-4 h-4" />
              <span className="hidden sm:inline">
                {t('dashboard.manage')}
              </span>
            </Button>
          </div>
        </div>
        {logs.length === 0 ? (
          <p className="text-base-content/70 text-sm">
            {t('dashboard.recentEmpty')}
          </p>
        ) : (
          <div className="overflow-x-auto -mx-2 px-2 pb-2" ref={scrollRef}>
            <div className="flex gap-3 snap-x snap-mandatory">
              {logs.map((log) => (
                <RecentMediaRailTile
                  key={`${log._id}-rail`}
                  log={log}
                  blurAdultContent
                  onQuickLog={onQuickLog}
                  onRemove={onRemove}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

type RecentMediaRailTileProps = {
  log: RecentMediaLog;
  blurAdultContent: boolean;
  onQuickLog: (media?: ILog['media']) => void;
  onRemove: (mediaId: string, title: string) => void;
};

function RecentMediaRailTile({
  log,
  blurAdultContent,
  onQuickLog,
  onRemove,
}: RecentMediaRailTileProps) {
  const { t } = useTranslation('home');
  const mediaCover = (log.media as IMediaDocument | undefined)?.coverImage;
  const image = log.media?.contentImage || mediaCover;
  const title = log.media?.title?.contentTitleNative || log.description;
  const mediaId = log.media?.contentId;
  const mediaDoc = log.media as IMediaDocument | undefined;
  const isVn = log.type === 'vn' || mediaDoc?.type === 'vn';
  const isAdult = isVn
    ? (mediaDoc?.isAdultImage ?? false)
    : log.isAdult || mediaDoc?.isAdult || false;

  function handleRemoveClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (mediaId) {
      onRemove(mediaId, title || t('dashboard.thisMedia'));
    }
  }

  return (
    <div
      className="group/tile relative shrink-0 w-28 h-44 rounded-2xl overflow-hidden border border-base-300 snap-start focus-visible:outline-2 focus-visible:outline-primary cursor-pointer"
      onClick={() => onQuickLog(log.media)}
      onKeyDown={(e) => e.key === 'Enter' && onQuickLog(log.media)}
      tabIndex={0}
      role="button"
    >
      {mediaId && (
        <button
          type="button"
          onClick={handleRemoveClick}
          className="absolute top-1.5 left-1.5 z-10 w-6 h-6 rounded-full bg-error/90 text-error-content flex items-center justify-center opacity-0 group-hover/tile:opacity-100 transition-opacity hover:bg-error focus:opacity-100"
          aria-label={t('dashboard.hideAria')}
        >
          <Minus className="w-4 h-4" />
        </button>
      )}
      {image ? (
        <img
          src={image}
          alt={title}
          className={`w-full h-full object-cover ${
            isAdult && blurAdultContent ? 'blur-sm scale-110' : ''
          }`}
        />
      ) : (
        <div className="w-full h-full bg-base-300 flex items-center justify-center">
          <Play className="w-8 h-8 text-base-content/40" />
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-2 text-left">
        <span className="text-[10px] uppercase tracking-[0.3em] text-white/70">
          {t('dashboard.quickLog')}
        </span>
        <p className="text-xs font-semibold leading-tight text-white line-clamp-2">
          {title}
        </p>
        <p className="text-[11px] text-white/80">
          {log.formattedTime} · {log.formattedDate}
        </p>
      </div>
    </div>
  );
}

type RecentMediaTileProps = {
  log: RecentMediaLog;
  user: ILoginResponse | null;
  onQuickLog: (media?: ILog['media']) => void;
  onRemove: (mediaId: string, title: string) => void;
};

function RecentMediaTile({
  log,
  user,
  onQuickLog,
  onRemove,
}: RecentMediaTileProps) {
  const { t } = useTranslation('home');
  const mediaCover = (log.media as IMediaDocument | undefined)?.coverImage;
  const image = log.media?.contentImage || mediaCover;
  const title = log.media?.title?.contentTitleNative || log.description;
  const mediaId = log.media?.contentId;
  const mediaDoc = log.media as IMediaDocument | undefined;
  const isVn = log.type === 'vn' || mediaDoc?.type === 'vn';
  const isAdult = isVn
    ? (mediaDoc?.isAdultImage ?? false)
    : log.isAdult || mediaDoc?.isAdult || false;

  const { data: averageColorData } = useQuery({
    queryKey: ['recentMediaAverageColor', image],
    queryFn: () => getAverageColorFn(image),
    enabled: !!image,
    staleTime: Infinity,
  });

  function handleRemoveClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (mediaId) {
      onRemove(mediaId, title || t('dashboard.thisMedia'));
    }
  }

  return (
    <div
      className="group relative aspect-[2/3] w-full overflow-hidden rounded-xl border border-base-300 bg-base-200/80 focus-visible:outline-2 focus-visible:outline-primary cursor-pointer"
      onClick={() => onQuickLog(log.media)}
      onKeyDown={(e) => e.key === 'Enter' && onQuickLog(log.media)}
      tabIndex={0}
      role="button"
    >
      {mediaId && (
        <button
          type="button"
          onClick={handleRemoveClick}
          className="absolute top-1.5 left-1.5 z-10 w-6 h-6 rounded-full bg-error/90 text-error-content flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-error focus:opacity-100"
          aria-label={t('dashboard.hideAria')}
        >
          <Minus className="w-4 h-4" />
        </button>
      )}
      {image ? (
        <img
          src={image}
          alt={title}
          className={`absolute inset-0 h-full w-full object-cover ${
            isAdult && user?.settings?.blurAdultContent
              ? 'blur-sm scale-110'
              : ''
          }`}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-base-300">
          <Play className="w-10 h-10 text-base-content/40" />
        </div>
      )}
      <div
        className="absolute inset-0 opacity-80 transition duration-200 group-hover:opacity-100"
        style={{
          background:
            'linear-gradient(0deg, rgba(2, 6, 23, 0.95), rgba(2, 6, 23, 0.65) 55%, transparent)',
        }}
      />
      <div
        className="absolute inset-x-0 bottom-0 flex flex-col gap-1 p-2 text-left"
        style={{
          color: averageColorData?.isDark ? '#ffffff' : '#f8fafc',
          textShadow: '0 2px 6px rgba(0, 0, 0, 0.65)',
        }}
      >
        <span className="text-[10px] uppercase tracking-[0.3em] text-white/80">
          {t('dashboard.quickLog')}
        </span>
        <p className="text-xs font-semibold leading-tight line-clamp-2">
          {title}
        </p>
        <p className="text-[11px] text-white/80">
          {log.formattedTime} · {log.formattedDate}
        </p>
      </div>
    </div>
  );
}

const hiddenMediaTypeLabelKey: Record<
  IHiddenRecentMediaItem['type'],
  ParseKeys<'common'>
> = {
  anime: 'mediaTypes.anime',
  manga: 'mediaTypes.manga',
  'light-novel': 'mediaTypes.light-novel',
  vn: 'mediaTypes.vn',
  game: 'mediaTypes.game',
  video: 'mediaTypes.video',
  movie: 'mediaTypes.movie',
  'tv show': 'mediaTypes.tvShow',
  book: 'mediaTypes.book',
};

type ManageHiddenMediaProps = {
  open: boolean;
  onClose: () => void;
  recentMediaLimit: number;
  onRecentMediaLimitChange: (limit: number) => void;
  onUnhidden?: () => void;
};

function ManageHiddenMedia({
  open,
  onClose,
  recentMediaLimit,
  onRecentMediaLimitChange,
  onUnhidden,
}: ManageHiddenMediaProps) {
  const { t } = useTranslation('home');
  const { t: tCommon } = useTranslation('common');
  const queryClient = useQueryClient();

  const { data: hiddenMedia = [], isLoading } = useQuery({
    queryKey: ['hiddenRecentMedia'],
    queryFn: getHiddenRecentMediaFn,
    enabled: open,
    staleTime: 1000 * 60,
  });

  const unhideMutation = useMutation({
    mutationFn: (mediaId: string) => hideRecentMediaFn('remove', mediaId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hiddenRecentMedia'] });
      onUnhidden?.();
    },
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('dashboard.manageHiddenTitle')}
    >
      <p className="text-sm text-base-content/70 -mt-2 mb-4">
        {t('dashboard.manageHiddenDescription')}
      </p>
      <Field
        label={t('dashboard.quickLogCardCount')}
        aside={t('dashboard.quickLogCardCountOption', {
          count: recentMediaLimit,
        })}
        hint={t('dashboard.quickLogCardCountHint')}
        className="mb-4"
      >
        {(id) => (
          <input
            id={id}
            type="range"
            min={1}
            max={MAX_RECENT_MEDIA_LIMIT}
            step={1}
            className="range range-primary w-full"
            value={recentMediaLimit}
            aria-valuetext={t('dashboard.quickLogCardCountOption', {
              count: recentMediaLimit,
            })}
            onChange={(event) =>
              onRecentMediaLimitChange(Number(event.target.value))
            }
          />
        )}
      </Field>
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="skeleton h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : hiddenMedia.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-6 text-center">
          <Settings2 className="w-8 h-8 text-base-content/40" />
          <p className="text-sm text-base-content/70">
            {t('dashboard.manageHiddenEmpty')}
          </p>
        </div>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {hiddenMedia.map((media) => {
            const title = media.title?.contentTitleNative ?? media.contentId;
            const image = media.contentImage || media.coverImage;
            const isAdult =
              media.type === 'vn' ? media.isAdultImage : media.isAdult;
            const isPending = unhideMutation.isPending
              ? unhideMutation.variables === media.contentId
              : false;
            return (
              <div
                key={media.contentId}
                className="flex items-center gap-3 p-2 rounded-xl bg-base-200/60 border border-base-300"
              >
                {image ? (
                  <img
                    src={image}
                    alt={title}
                    className={`w-12 h-16 rounded-lg object-cover shrink-0 ${
                      isAdult ? 'blur-sm scale-110' : ''
                    }`}
                  />
                ) : (
                  <div className="w-12 h-16 rounded-lg bg-base-300 flex items-center justify-center shrink-0">
                    <Play className="w-5 h-5 text-base-content/40" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{title}</p>
                  <p className="text-xs text-base-content/60">
                    {tCommon(hiddenMediaTypeLabelKey[media.type])}
                  </p>
                </div>
                <Button
                  appearance="outline"
                  size="sm"
                  loading={isPending}
                  disabled={unhideMutation.isPending && !isPending}
                  onClick={() => unhideMutation.mutate(media.contentId)}
                  className="shrink-0"
                >
                  <Eye className="w-4 h-4" />
                  {t('dashboard.unhide')}
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}

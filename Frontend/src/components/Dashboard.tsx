import { Link } from 'react-router-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useUserDataStore } from '../store/userData';
import { useQuery } from '@tanstack/react-query';
import {
  getDashboardHoursFn,
  getRecentLogsFn,
  getGlobalFeedFn,
  getRankingSummaryFn,
  getUserFn,
  getAverageColorFn,
} from '../api/trackerApi';
import {
  MdAdd,
  MdArrowDownward,
  MdArrowUpward,
  MdBook,
  MdGamepad,
  MdLeaderboard,
  MdMovie,
  MdOutlineTv,
  MdPerson,
  MdPlayArrow,
  MdVideoLibrary,
  MdVolumeUp,
} from 'react-icons/md';
import { Flame, Sparkles, Trophy } from 'lucide-react';
import { numberWithCommas } from '../utils/utils';
import { useDateFormatting } from '../hooks/useDateFormatting';
import ClubRanking from './club/ClubRanking';
import QuickLog from './QuickLog';
import XpAnimation from './XpAnimation';
import { IMediaDocument, ILog, ILoginResponse } from '../types';

const logTypeIcons: { [key: string]: React.ElementType } = {
  reading: MdBook,
  anime: MdPlayArrow,
  vn: MdGamepad,
  video: MdVideoLibrary,
  manga: MdBook,
  audio: MdVolumeUp,
  movie: MdMovie,
  'tv show': MdOutlineTv,
};

type FeedType = ILog['type'] | 'all';
type FeedTimeRange = 'day' | 'week' | 'month' | 'year' | 'all';

const feedTypeOptions: Array<{ label: string; value: FeedType }> = [
  { label: 'All types', value: 'all' },
  { label: 'Anime', value: 'anime' },
  { label: 'Manga', value: 'manga' },
  { label: 'Reading', value: 'reading' },
  { label: 'Visual Novel', value: 'vn' },
  { label: 'Video', value: 'video' },
  { label: 'Movie', value: 'movie' },
  { label: 'Audio', value: 'audio' },
];

const feedTimeOptions: Array<{ label: string; value: FeedTimeRange }> = [
  { label: 'Last 24h', value: 'day' },
  { label: 'Last 7 days', value: 'week' },
  { label: 'Last 30 days', value: 'month' },
  { label: 'Last year', value: 'year' },
  { label: 'All time', value: 'all' },
];

const RECENT_MEDIA_LIMIT = 4;

function Dashboard() {
  const { user, setUser } = useUserDataStore();
  const username = user?.username;
  const userTimezone = user?.settings?.timezone ?? 'UTC';
  const { formatRelativeDate } = useDateFormatting();
  const [quickLogOpen, setQuickLogOpen] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<
    IMediaDocument | undefined
  >();
  const [initialXp, setInitialXp] = useState(0);
  const [finalXp, setFinalXp] = useState(0);
  const [showXpAnimation, setShowXpAnimation] = useState(false);
  const [feedFilters, setFeedFilters] = useState<{
    type: FeedType;
    timeRange: FeedTimeRange;
  }>({ type: 'all', timeRange: 'day' });

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
    enabled: !!username,
    staleTime: 1000 * 60 * 5,
  });

  const { data: globalFeed, isLoading: globalFeedLoading } = useQuery({
    queryKey: ['globalFeed', username, feedFilters],
    queryFn: () =>
      getGlobalFeedFn({
        type: feedFilters.type,
        timeRange: feedFilters.timeRange,
        limit: 20,
        includeSelf: false,
      }).catch(() => []),
    enabled: !!username,
    staleTime: 1000 * 60 * 2,
  });

  const immersionStats = useMemo(() => {
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
  }, [hours]);

  const recentMediaHighlights = useMemo(() => {
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

      const mediaKey = log.media.contentId;
      if (seenMedia.has(mediaKey)) continue;
      seenMedia.add(mediaKey);
      uniqueLogs.push({
        ...log,
        formattedDate: formatRelativeDate(log.date),
        formattedTime: formatTime(log.time, log.episodes),
      });
      if (uniqueLogs.length === RECENT_MEDIA_LIMIT) break;
    }

    return uniqueLogs;
  }, [logs, formatRelativeDate]);

  const randomGreeting = useMemo(() => {
    const greetings = [
      "Let's get some immersion done!",
      'Time to track your progress!',
      'Another day, another step towards fluency!',
      'Keep up the great work!',
      'The journey of a thousand miles begins with a single step.',
    ];
    return greetings[Math.floor(Math.random() * greetings.length)];
  }, []);

  if (!user) {
    return null;
  }

  function formatTime(minutes?: number, episodes?: number) {
    if (minutes && minutes > 0) {
      const hoursValue = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return hoursValue > 0
        ? `${hoursValue}h ${mins > 0 ? `${mins}m` : ''}`
        : `${mins}m`;
    } else if (episodes) {
      return `${episodes} ep${episodes > 1 ? 's' : ''}`;
    }
    return 'N/A';
  }

  const transformMediaToDocument = (
    media?: ILog['media']
  ): IMediaDocument | undefined => {
    if (!media) return undefined;
    return {
      contentId: media.contentId,
      title: {
        contentTitleNative: media.title?.contentTitleNative ?? media.contentId,
        contentTitleEnglish: media.title?.contentTitleEnglish,
        contentTitleRomaji: media.title?.contentTitleRomaji,
      },
      contentImage: media.contentImage,
      coverImage: (media as IMediaDocument)?.coverImage ?? media.contentImage,
      type: (media.type as IMediaDocument['type']) ?? 'anime',
      isAdult: (media as IMediaDocument)?.isAdult ?? false,
    };
  };

  const handleQuickLogOpen = (media?: ILog['media']) => {
    setSelectedMedia(transformMediaToDocument(media));
    setQuickLogOpen(true);
  };

  const handleQuickLogSuccess = async () => {
    if (!user?.username) return;
    const previousXp = user.stats?.userXp ?? 0;
    setInitialXp(previousXp);

    try {
      const updatedUser = await getUserFn(user.username);
      const updatedXp = updatedUser.stats?.userXp ?? previousXp;

      const loginResponse: ILoginResponse = {
        _id: updatedUser._id,
        username: updatedUser.username,
        email: updatedUser.email,
        verified: updatedUser.verified,
        stats: updatedUser.stats,
        avatar: updatedUser.avatar,
        banner: updatedUser.banner,
        titles: updatedUser.titles,
        roles: updatedUser.roles,
        discordId: updatedUser.discordId,
        patreon: updatedUser.patreon,
        settings: updatedUser.settings,
      };

      setUser(loginResponse);

      if (updatedXp > previousXp) {
        setFinalXp(updatedXp);
        setShowXpAnimation(true);
      }
    } catch (error) {
      console.error('Failed to refresh user data after quick log', error);
    }
  };

  const streak = user.stats?.currentStreak ?? 0;
  const monthlyRanking = rankingSummary?.monthly;
  const xpGapText = monthlyRanking
    ? monthlyRanking.nextUser
      ? `${numberWithCommas(monthlyRanking.nextUser.gap)} XP behind ${monthlyRanking.nextUser.username} this month`
      : 'You are leading the monthly ranking!'
    : 'Log something to enter this month’s ranking.';

  const closeQuickLog = () => {
    setQuickLogOpen(false);
    setSelectedMedia(undefined);
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-8 space-y-8">
      <QuickLog
        open={quickLogOpen}
        onClose={closeQuickLog}
        media={selectedMedia}
        onLogged={handleQuickLogSuccess}
      />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm uppercase tracking-wide text-primary font-semibold">
            Welcome back
          </p>
          <h1 className="text-3xl md:text-4xl font-bold text-base-content">
            {user.username}
          </h1>
          <p className="text-base-content/70 mt-1">{randomGreeting}</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full lg:w-auto">
          <Link to="/createlog" className="btn btn-primary btn-lg">
            <MdAdd className="w-5 h-5" />
            Create Log
          </Link>
          <Link
            to={`/user/${user.username}`}
            className="btn btn-secondary btn-lg"
          >
            <MdPerson className="w-5 h-5" />
            Profile
          </Link>
          <Link to="/ranking" className="btn btn-accent btn-lg">
            <MdLeaderboard className="w-5 h-5" />
            Rankings
          </Link>
        </div>
      </div>

      <div className="xl:hidden">
        <RecentMediaRail
          logs={recentMediaHighlights}
          onQuickLog={handleQuickLogOpen}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card bg-gradient-to-br from-secondary/10 to-secondary/5 shadow-xl">
          <div className="card-body">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-secondary text-secondary-content">
                <Flame className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm uppercase tracking-wide text-secondary">
                  Streak
                </p>
                <h3 className="text-2xl font-bold text-base-content">
                  {streak} day{streak === 1 ? '' : 's'}
                </h3>
                <p className="text-base-content/70 text-sm">
                  Keep it burning with daily immersion
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className="card bg-gradient-to-br from-primary/10 to-primary/5 shadow-xl">
          <div className="card-body">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-primary text-primary-content">
                <Trophy className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm uppercase tracking-wide text-primary">
                  Monthly Ranking
                </p>
                <h3 className="text-2xl font-bold text-base-content">
                  #{monthlyRanking?.position ?? '—'} /{' '}
                  {monthlyRanking?.totalUsers ?? '—'}
                </h3>
                <p className="text-base-content/70 text-sm">{xpGapText}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-2 space-y-8">
          <div className="card bg-base-100 shadow-xl border border-base-200/60">
            <div className="card-body">
              <h2 className="card-title">This Month's Immersion</h2>
              <p className="text-sm text-base-content/60 -mt-2 mb-4">
                Compared to the same period last month
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  {
                    label: 'Reading',
                    value: `${immersionStats.currentMonth.reading}h`,
                    change: immersionStats.changes.reading,
                    accent: 'text-primary',
                  },
                  {
                    label: 'Listening',
                    value: `${immersionStats.currentMonth.listening}h`,
                    change: immersionStats.changes.listening,
                    accent: 'text-secondary',
                  },
                  {
                    label: 'Total',
                    value: `${immersionStats.currentMonth.total}h`,
                    change: immersionStats.changes.total,
                    accent: 'text-base-content',
                  },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="p-4 rounded-2xl bg-base-200/60 border border-base-300"
                  >
                    <p className="text-sm uppercase tracking-wide text-base-content/70">
                      {stat.label}
                    </p>
                    <p className={`text-3xl font-bold mt-2 ${stat.accent}`}>
                      {stat.value}
                    </p>
                    <p
                      className={`text-sm mt-1 flex items-center gap-1 ${
                        stat.change > 0
                          ? 'text-success'
                          : stat.change < 0
                            ? 'text-error'
                            : 'text-base-content/60'
                      }`}
                    >
                      {stat.change > 0 && <MdArrowUpward />}
                      {stat.change < 0 && <MdArrowDownward />}
                      {stat.change !== 0
                        ? `${Math.abs(stat.change)}% vs. last month`
                        : 'No change'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card bg-base-100 shadow-xl border border-base-200/60">
            <div className="card-body space-y-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="card-title">Global Feed</h2>
                  <p className="text-sm text-base-content/70">
                    See what the community is immersing in right now
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <select
                    className="select select-sm select-bordered"
                    value={feedFilters.type}
                    onChange={(event) =>
                      setFeedFilters((prev) => ({
                        ...prev,
                        type: event.target.value as FeedType,
                      }))
                    }
                  >
                    {feedTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <select
                    className="select select-sm select-bordered"
                    value={feedFilters.timeRange}
                    onChange={(event) =>
                      setFeedFilters((prev) => ({
                        ...prev,
                        timeRange: event.target.value as FeedTimeRange,
                      }))
                    }
                  >
                    {feedTimeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-3">
                {globalFeedLoading ? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <div
                      key={index}
                      className="skeleton h-20 w-full rounded-2xl"
                    />
                  ))
                ) : globalFeed && globalFeed.length > 0 ? (
                  globalFeed.map((log) => {
                    const Icon = logTypeIcons[log.type] || MdBook;
                    const mediaCover = (log.media as IMediaDocument | undefined)
                      ?.coverImage;
                    const image = log.media?.contentImage || mediaCover;
                    const feedUsername = log.user?.username ?? 'Someone';
                    const userAvatar = log.user?.avatar;
                    const mediaType =
                      (log.media as IMediaDocument | undefined)?.type ??
                      log.type;
                    const mediaContentId = log.media?.contentId;
                    const mediaLink =
                      mediaType && mediaContentId
                        ? `/${mediaType}/${mediaContentId}`
                        : undefined;
                    return (
                      <div
                        key={log._id}
                        className="flex items-center gap-4 p-4 rounded-2xl bg-base-200/60 border border-base-300 hover:border-primary/40 transition"
                      >
                        {log.user?.username ? (
                          <Link
                            to={`/user/${log.user.username}`}
                            className="shrink-0"
                            aria-label={`View ${log.user.username}'s profile`}
                          >
                            <div className="avatar">
                              <div className="w-12 rounded-full border border-base-300 overflow-hidden">
                                {userAvatar ? (
                                  <img src={userAvatar} alt={feedUsername} />
                                ) : (
                                  <div className="w-full h-full bg-base-300" />
                                )}
                              </div>
                            </div>
                          </Link>
                        ) : (
                          <div className="avatar">
                            <div className="w-12 rounded-full border border-base-300">
                              {userAvatar ? (
                                <img src={userAvatar} alt={feedUsername} />
                              ) : (
                                <div className="w-full h-full bg-base-300" />
                              )}
                            </div>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 text-sm">
                            {log.user?.username ? (
                              <Link
                                to={`/user/${log.user.username}`}
                                className="font-semibold hover:underline"
                              >
                                {log.user.username}
                              </Link>
                            ) : (
                              <span className="font-semibold">
                                {feedUsername}
                              </span>
                            )}
                            <span className="text-base-content/60">
                              tracked
                            </span>
                            <Icon className="text-primary" />
                            {mediaLink ? (
                              <Link
                                to={mediaLink}
                                className="font-medium hover:underline"
                              >
                                {log.media?.title?.contentTitleNative ??
                                  log.description}
                              </Link>
                            ) : (
                              <span className="font-medium">
                                {log.media?.title?.contentTitleNative ??
                                  log.description}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-base-content/70">
                            {formatRelativeDate(log.date)} · +
                            {numberWithCommas(log.xp)} XP
                          </p>
                        </div>
                        {image &&
                          (mediaLink ? (
                            <Link
                              to={mediaLink}
                              className="shrink-0"
                              aria-label={`View ${log.media?.title?.contentTitleNative ?? 'media'}`}
                            >
                              <img
                                src={image}
                                alt={log.media?.title?.contentTitleNative}
                                className="w-20 h-28 rounded-2xl object-cover"
                              />
                            </Link>
                          ) : (
                            <img
                              src={image}
                              alt={log.media?.title?.contentTitleNative}
                              className="w-20 h-28 rounded-2xl object-cover"
                            />
                          ))}
                      </div>
                    );
                  })
                ) : (
                  <div className="text-base-content/70 text-sm">
                    No public logs match the current filters.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-8">
          <div className="hidden xl:block">
            <RecentMediaPanel
              logs={recentMediaHighlights}
              onQuickLog={handleQuickLogOpen}
            />
          </div>

          <ClubRanking username={user.username} />
        </div>
      </div>

      {showXpAnimation && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex justify-center items-center z-50 animate-fade-in"
          onClick={() => setShowXpAnimation(false)}
        >
          <XpAnimation initialXp={initialXp} finalXp={finalXp} />
        </div>
      )}
    </div>
  );
}

export default Dashboard;

type RecentMediaLog = ILog & { formattedDate: string; formattedTime: string };

type RecentMediaPanelProps = {
  logs: RecentMediaLog[];
  onQuickLog: (media?: ILog['media']) => void;
};

const RecentMediaPanel = ({ logs, onQuickLog }: RecentMediaPanelProps) => (
  <div className="card bg-base-100 shadow-xl border border-base-200/60">
    <div className="card-body space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-base-content/60">
            Recent Media
          </p>
          <h2 className="card-title flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Jump back in instantly
          </h2>
        </div>
        <span className="text-xs text-base-content/60">
          Quick log shortcuts
        </span>
      </div>
      {logs.length === 0 ? (
        <p className="text-base-content/70 text-sm">
          Log something to unlock quick actions here.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {logs.map((log) => (
            <RecentMediaTile key={log._id} log={log} onQuickLog={onQuickLog} />
          ))}
        </div>
      )}
    </div>
  </div>
);

type RecentMediaRailProps = {
  logs: RecentMediaLog[];
  onQuickLog: (media?: ILog['media']) => void;
};

const RecentMediaRail = ({ logs, onQuickLog }: RecentMediaRailProps) => (
  <RecentMediaRailInner logs={logs} onQuickLog={onQuickLog} />
);

const RecentMediaRailInner = ({ logs, onQuickLog }: RecentMediaRailProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showSwipeHint, setShowSwipeHint] = useState(false);

  useEffect(() => {
    const checkOverflow = () => {
      const el = scrollRef.current;
      if (!el) return;
      const needsScroll = el.scrollWidth > el.clientWidth + 4;
      setShowSwipeHint(needsScroll);
    };

    checkOverflow();
    window.addEventListener('resize', checkOverflow);
    return () => window.removeEventListener('resize', checkOverflow);
  }, [logs]);

  return (
    <div className="card bg-base-100 shadow-xl border border-base-200/60">
      <div className="card-body space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-base-content/60">
              Recent Media
            </p>
            <h2 className="card-title text-lg">Jump back in</h2>
          </div>
          {showSwipeHint && (
            <span className="text-xs text-base-content/60">Swipe</span>
          )}
        </div>
        {logs.length === 0 ? (
          <p className="text-base-content/70 text-sm">
            Log something to unlock quick actions here.
          </p>
        ) : (
          <div className="overflow-x-auto -mx-2 px-2 pb-2" ref={scrollRef}>
            <div className="flex gap-3 snap-x snap-mandatory">
              {logs.map((log) => (
                <RecentMediaRailTile
                  key={`${log._id}-rail`}
                  log={log}
                  onQuickLog={onQuickLog}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

type RecentMediaRailTileProps = {
  log: RecentMediaLog;
  onQuickLog: (media?: ILog['media']) => void;
};

const RecentMediaRailTile = ({ log, onQuickLog }: RecentMediaRailTileProps) => {
  const mediaCover = (log.media as IMediaDocument | undefined)?.coverImage;
  const image = log.media?.contentImage || mediaCover;
  const title = log.media?.title?.contentTitleNative || log.description;

  return (
    <button
      type="button"
      onClick={() => onQuickLog(log.media)}
      className="relative shrink-0 w-28 h-44 rounded-2xl overflow-hidden border border-base-300 snap-start focus-visible:outline-2 focus-visible:outline-primary cursor-pointer"
    >
      {image ? (
        <img src={image} alt={title} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full bg-base-300 flex items-center justify-center">
          <MdPlayArrow className="w-8 h-8 text-base-content/40" />
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-2 text-left">
        <span className="text-[10px] uppercase tracking-[0.3em] text-white/70">
          Quick Log
        </span>
        <p className="text-xs font-semibold leading-tight text-white line-clamp-2">
          {title}
        </p>
        <p className="text-[11px] text-white/80">
          {log.formattedTime} · {log.formattedDate}
        </p>
      </div>
    </button>
  );
};

type RecentMediaTileProps = {
  log: RecentMediaLog;
  onQuickLog: (media?: ILog['media']) => void;
};

const RecentMediaTile = ({ log, onQuickLog }: RecentMediaTileProps) => {
  const mediaCover = (log.media as IMediaDocument | undefined)?.coverImage;
  const image = log.media?.contentImage || mediaCover;
  const title = log.media?.title?.contentTitleNative || log.description;

  const { data: averageColorData } = useQuery({
    queryKey: ['recentMediaAverageColor', image],
    queryFn: () => getAverageColorFn(image),
    enabled: !!image,
    staleTime: Infinity,
  });

  return (
    <button
      type="button"
      onClick={() => onQuickLog(log.media)}
      className="group relative aspect-[2/3] w-full overflow-hidden rounded-xl border border-base-300 bg-base-200/80 focus-visible:outline-2 focus-visible:outline-primary cursor-pointer"
    >
      {image ? (
        <img
          src={image}
          alt={title}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-base-300">
          <MdPlayArrow className="w-10 h-10 text-base-content/40" />
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
          Quick Log
        </span>
        <p className="text-xs font-semibold leading-tight line-clamp-2">
          {title}
        </p>
        <p className="text-[11px] text-white/80">
          {log.formattedTime} · {log.formattedDate}
        </p>
      </div>
    </button>
  );
};

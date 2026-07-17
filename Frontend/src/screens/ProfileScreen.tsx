import { Link, useOutletContext } from 'react-router-dom';
import LogCard from '../components/LogCard';
import PlaylistBatchCard from '../components/PlaylistBatchCard';
import ProgressBar from '../components/ProgressBar';
import ImmersionGoals from '../components/ImmersionGoals';
import ImmersionHeatmap from '../components/ImmersionHeatmap';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { getUserLogsFn, getUserAchievementsFn, getUserAchievementActivityFn } from '../api/trackerApi';
import { Icon } from '@iconify/react';
import AchievementFeedItem from '../components/achievements/AchievementFeedItem';
import { RARITY_COLOR } from '../components/achievements/rarity';
import {
  OutletProfileContextType,
  UnifiedFeedItem,
  UnifiedFeedFilter,
  IPendingAchievement,
  AchievementCategory,
  AchievementRarity,
} from '../types';
import { useUserDataStore } from '../store/userData';
import { DayPicker } from 'react-day-picker';
import { useDateFormatting } from '../hooks/useDateFormatting';
import { renderMarkdownWithSpoilers } from '../utils/markdown';
import {
  Search,
  Funnel,
  Clock,
  ChevronDown,
  ListFilter,
  ArrowUp,
  ArrowDown,
  LayoutList,
  Trophy,
  Sparkles,
  Tag,
} from 'lucide-react';

const RARITY_ORDER: Record<AchievementRarity, number> = {
  common: 0,
  rare: 1,
  epic: 2,
  legendary: 3,
  secret: 4,
};

const achievementCategoryOptions: Array<{
  value: 'all' | AchievementCategory;
  label: string;
}> = [
  { value: 'all', label: 'All Categories' },
  { value: 'streaks', label: 'Streaks' },
  { value: 'immersion', label: 'Immersion' },
  { value: 'social', label: 'Social' },
  { value: 'milestone', label: 'Milestone' },
  { value: 'secret', label: 'Secret' },
];

function ProfileScreen() {
  const limit = 10;
  const { user, username } = useOutletContext<OutletProfileContextType>();
  const { user: loggedUser } = useUserDataStore();
  const { getCurrentTime, getDayBounds, formatDateOnly } = useDateFormatting();
  const [showFullAbout, setShowFullAbout] = useState(false);
  const aboutContentRef = useRef<HTMLDivElement | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<
    | 'all'
    | 'anime'
    | 'manga'
    | 'reading'
    | 'vn'
    | 'game'
    | 'video'
    | 'movie'
    | 'audio'
    | 'other'
  >('all');
  const [achievementCategory, setAchievementCategory] = useState<
    'all' | AchievementCategory
  >('all');
  const [dateFilter, setDateFilter] = useState<
    'all' | 'today' | 'week' | 'month' | 'year' | 'custom'
  >('all');
  const [showUnknownDates, setShowUnknownDates] = useState(false);
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>(
    undefined
  );
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>(
    undefined
  );
  const [sortBy, setSortBy] = useState<
    | 'date'
    | 'xp'
    | 'episodes'
    | 'chars'
    | 'pages'
    | 'time'
    | 'readingSpeed'
    | 'rarity'
    | 'points'
  >('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const aboutText = user?.about?.trim() ?? '';
  const aboutHtml = aboutText ? renderMarkdownWithSpoilers(aboutText) : '';
  const [shouldCollapseAbout, setShouldCollapseAbout] = useState(false);
  const showAboutPreview = shouldCollapseAbout && !showFullAbout;
  const aboutPreviewHeight = 224;
  const [feedKind, setFeedKind] = useState<UnifiedFeedFilter>('all');

  const feedKindOptions: Array<{ label: string; value: UnifiedFeedFilter; icon: React.ElementType }> = [
    { label: 'All activity', value: 'all', icon: Sparkles },
    { label: 'Logs', value: 'logs', icon: LayoutList },
    { label: 'Achievements', value: 'achievements', icon: Trophy },
  ];

  const sortFieldOptions =
    feedKind === 'achievements'
      ? [
          { value: 'date', label: 'Date' },
          { value: 'rarity', label: 'Rarity' },
          { value: 'points', label: 'Points' },
        ]
      : [
          { value: 'date', label: 'Date' },
          { value: 'xp', label: 'XP' },
          { value: 'episodes', label: 'Episodes' },
          { value: 'chars', label: 'Characters' },
          { value: 'pages', label: 'Pages' },
          { value: 'time', label: 'Time' },
          { value: 'readingSpeed', label: 'Reading Speed' },
        ];

  useEffect(() => {
    setShowFullAbout(false);
  }, [username, aboutText]);

  // Sort options differ by feed kind — reset to a value valid for the newly selected kind.
  useEffect(() => {
    const achievementSorts = ['date', 'rarity', 'points'];
    const isAchievementSort = achievementSorts.includes(sortBy);
    if (feedKind === 'achievements' && !isAchievementSort) {
      setSortBy('date');
    } else if (feedKind !== 'achievements' && (sortBy === 'rarity' || sortBy === 'points')) {
      setSortBy('date');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedKind]);

  useEffect(() => {
    const content = aboutContentRef.current;

    if (!content || !aboutHtml) {
      setShouldCollapseAbout(false);
      return;
    }

    const updateShouldCollapse = () => {
      const contentHeight = content.scrollHeight;
      const nextValue = contentHeight > aboutPreviewHeight + 1;
      setShouldCollapseAbout((current) =>
        current === nextValue ? current : nextValue
      );
    };

    updateShouldCollapse();

    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    const observer = new ResizeObserver(() => {
      updateShouldCollapse();
    });

    observer.observe(content);

    return () => observer.disconnect();
  }, [aboutHtml]);

  const isValidLogType = (
    value: string
  ): value is
    | 'anime'
    | 'manga'
    | 'reading'
    | 'vn'
    | 'game'
    | 'video'
    | 'movie'
    | 'audio'
    | 'other' => {
    return [
      'anime',
      'manga',
      'reading',
      'vn',
      'game',
      'video',
      'movie',
      'audio',
      'other',
    ].includes(value);
  };

  // Function to get date range based on filter
  const getDateRange = () => {
    const now = getCurrentTime();
    const today = getDayBounds(now);

    switch (dateFilter) {
      case 'today': {
        return {
          startDate: today.start,
          endDate: today.end,
        };
      }
      case 'week': {
        const weekStart = new Date(today.start);
        weekStart.setDate(today.start.getDate() - today.start.getDay()); // Start of week (Sunday)
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);
        return {
          startDate: weekStart,
          endDate: weekEnd,
        };
      }
      case 'month': {
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthEnd = new Date(
          now.getFullYear(),
          now.getMonth() + 1,
          0,
          23,
          59,
          59
        );
        return {
          startDate: monthStart,
          endDate: monthEnd,
        };
      }
      case 'year': {
        const yearStart = new Date(now.getFullYear(), 0, 1);
        const yearEnd = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
        return {
          startDate: yearStart,
          endDate: yearEnd,
        };
      }
      case 'custom': {
        if (customStartDate && customEndDate) {
          const startBounds = getDayBounds(customStartDate);
          const endBounds = getDayBounds(customEndDate);
          return {
            startDate: startBounds.start,
            endDate: endBounds.end,
          };
        }
        return null;
      }
      default:
        return null;
    }
  };

  const dateRange = getDateRange();
  const totalUserXpToLevelUp = user?.stats?.userXpToNextLevel
    ? user?.stats?.userXpToNextLevel - user?.stats?.userXpToCurrentLevel
    : 0;
  const userProgressXP = user?.stats?.userXp
    ? user?.stats?.userXp - user?.stats?.userXpToCurrentLevel
    : 0;
  const userProgressPercentage = (userProgressXP / totalUserXpToLevelUp) * 100;

  const totalListeningXpToLevelUp = user?.stats?.listeningXpToNextLevel
    ? user?.stats?.listeningXpToNextLevel -
      user?.stats?.listeningXpToCurrentLevel
    : 0;
  const listeningProgressXP = user?.stats?.listeningXp
    ? user?.stats?.listeningXp - user?.stats?.listeningXpToCurrentLevel
    : 0;
  const listeningProgressPercentage =
    (listeningProgressXP / totalListeningXpToLevelUp) * 100;

  const totalReadingXpToLevelUp = user?.stats?.readingXpToNextLevel
    ? user?.stats?.readingXpToNextLevel - user?.stats?.readingXpToCurrentLevel
    : 0;
  const readingProgressXP = user?.stats?.readingXp
    ? user?.stats?.readingXp - user?.stats?.readingXpToCurrentLevel
    : 0;
  const readingProgressPercentage =
    (readingProgressXP / totalReadingXpToLevelUp) * 100;

  const isLogSortValue = sortBy !== 'readingSpeed' && sortBy !== 'rarity' && sortBy !== 'points';
  const backendSortBy = isLogSortValue ? sortBy : 'date';
  const backendSortDirection = isLogSortValue ? sortDirection : 'desc';

  const {
    data: logs,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: [
      'logs',
      username,
      searchTerm,
      filterType,
      dateFilter,
      customStartDate?.toISOString(),
      customEndDate?.toISOString(),
      backendSortBy,
      backendSortDirection,
    ],
    queryFn: ({ pageParam }) =>
      getUserLogsFn(username as string, {
        limit,
        page: pageParam as number,
        search: searchTerm,
        type: filterType !== 'all' ? filterType : undefined,
        start: dateRange?.startDate?.toISOString(),
        end: dateRange?.endDate?.toISOString(),
        sortBy: backendSortBy,
        sortDirection: backendSortDirection,
      }),
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage || lastPage.length === 0) return undefined;
      // Backend paginates by groups (playlist batches = 1 group).
      // Count unique groups in this page to check if we got a full page.
      const groupKeys = new Set(
        lastPage.map((log) => log.playlistBatchId?.trim() || `single:${log._id}`)
      );
      if (groupKeys.size < limit) return undefined;
      return allPages ? allPages.length + 1 : 2;
    },
    initialPageParam: 1,
    staleTime: Infinity,
    enabled: !!username,
  });

  const displayedLogs = (() => {
    const pages = logs?.pages ?? [];
    const flattened = pages.flatMap((page) =>
      Array.isArray(page) ? page : []
    );
    const baseLogs = showUnknownDates
      ? flattened
      : flattened.filter((log) => !log.unknownDate);

    if (sortBy !== 'readingSpeed') {
      return baseLogs;
    }

    return baseLogs
      .filter((log) => (log.time ?? 0) > 0 && (log.chars ?? 0) > 0)
      .sort((a, b) => {
        const speedA = ((a.chars ?? 0) / (a.time ?? 1)) * 60;
        const speedB = ((b.chars ?? 0) / (b.time ?? 1)) * 60;
        return sortDirection === 'asc' ? speedA - speedB : speedB - speedA;
      });
  })();

  // Group logs by playlistBatchId  Eplaylist batches become single entries
  type LogGroup = {
    key: string;
    logs: typeof displayedLogs;
    isPlaylistGroup: boolean;
  };

  const groupedLogs = useMemo<LogGroup[]>(() => {
    const grouped = new Map<string, typeof displayedLogs>();
    const order: string[] = [];

    for (const log of displayedLogs) {
      const key = log.playlistBatchId?.trim() || `single:${log._id}`;
      if (!grouped.has(key)) {
        grouped.set(key, []);
        order.push(key);
      }
      grouped.get(key)!.push(log);
    }

    return order.map((key) => {
      const logs = grouped.get(key) ?? [];
      return {
        key,
        logs,
        isPlaylistGroup: Boolean(logs[0]?.playlistBatchId),
      };
    });
  }, [displayedLogs]);

  // Achievement activity for unified feed
  const { data: achievementActivity } = useQuery({
    queryKey: ['userAchievementActivity', username],
    queryFn: () => getUserAchievementActivityFn(username as string, 50),
    staleTime: 2 * 60 * 1000,
    enabled: !!username,
  });

  // Apply the search/category/date/sort filters to achievements too (client-side,
  // since a user's unlocked achievements are a small bounded set already fetched in full).
  const filteredAchievements = useMemo(() => {
    let items = achievementActivity ?? [];

    if (achievementCategory !== 'all') {
      items = items.filter((a) => a.achievement.category === achievementCategory);
    }

    const term = searchTerm.trim().toLowerCase();
    if (term) {
      items = items.filter(
        (a) =>
          a.achievement.name?.toLowerCase().includes(term) ||
          a.achievement.description?.toLowerCase().includes(term)
      );
    }

    if (dateRange) {
      items = items.filter((a) => {
        const unlockedAt = new Date(a.unlockedAt);
        return unlockedAt >= dateRange.startDate && unlockedAt <= dateRange.endDate;
      });
    }

    const sorted = [...items];
    if (sortBy === 'rarity') {
      sorted.sort((a, b) => {
        const diff =
          RARITY_ORDER[b.achievement.rarity] - RARITY_ORDER[a.achievement.rarity];
        return sortDirection === 'asc' ? -diff : diff;
      });
    } else if (sortBy === 'points') {
      sorted.sort((a, b) => {
        const diff = b.achievement.points - a.achievement.points;
        return sortDirection === 'asc' ? -diff : diff;
      });
    } else {
      sorted.sort((a, b) => {
        const diff = new Date(b.unlockedAt).getTime() - new Date(a.unlockedAt).getTime();
        return sortDirection === 'asc' ? -diff : diff;
      });
    }

    return sorted;
  }, [achievementActivity, achievementCategory, searchTerm, dateRange, sortBy, sortDirection]);

  // Unified chronological feed (achievements + log groups)
  const unifiedFeed = useMemo<UnifiedFeedItem[]>(() => {
    const logItems: UnifiedFeedItem[] = displayedLogs.map((log) => ({
      kind: 'log',
      sortDate: new Date(log.date ?? 0),
      data: log,
    }));
    const achievementItems: UnifiedFeedItem[] = filteredAchievements.map((a) => ({
      kind: 'achievement',
      sortDate: new Date(a.unlockedAt),
      data: a,
    }));
    return [...logItems, ...achievementItems].sort(
      (a, b) => b.sortDate.getTime() - a.sortDate.getTime()
    );
  }, [displayedLogs, filteredAchievements]);

  return (
    <div className="flex flex-col items-center py-4 sm:py-8 px-4 sm:px-6">
      <div className="w-full max-w-7xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-10">
          <div className="flex flex-col shrink gap-4 md:gap-5">
            <div className="card w-full bg-base-100 shadow-sm">
              <div className="card-body w-full p-4 sm:p-6">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <h2 className="card-title">About</h2>
                  {username === loggedUser?.username && (
                    <Link
                      to="/settings"
                      className="btn btn-ghost btn-xs text-primary"
                    >
                      Edit profile
                    </Link>
                  )}
                </div>
                {aboutHtml ? (
                  <div className="space-y-3">
                    <div className="relative">
                      <div
                        ref={aboutContentRef}
                        className={`prose prose-sm max-w-none text-base-content/90 ${
                          showAboutPreview ? 'max-h-56 overflow-hidden' : ''
                        }`}
                        dangerouslySetInnerHTML={{ __html: aboutHtml }}
                      />
                      {showAboutPreview && (
                        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-base-100 via-base-100/90 to-transparent" />
                      )}
                    </div>
                    {shouldCollapseAbout && (
                      <div className="flex justify-center">
                        <span
                          role="button"
                          tabIndex={0}
                          className="link link-hover link-primary text-sm"
                          onClick={() => setShowFullAbout((value) => !value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              setShowFullAbout((value) => !value);
                            }
                          }}
                          aria-expanded={showFullAbout}
                        >
                          {showFullAbout ? 'Show less' : 'Read more'}
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-base-content/70 text-sm">
                    {username === loggedUser?.username
                      ? 'Add a short introduction from Settings ↁEProfile Information.'
                      : 'This user has not added an about section yet.'}
                  </p>
                )}
              </div>
            </div>
            <div className="card w-full bg-base-100 shadow-sm">
              <div className="card-body w-full p-4 sm:p-6">
                <h2 className="card-title mb-4">Progress Stats</h2>
                <div className="stats stats-vertical w-full shadow-none bg-transparent">
                  <div className="stat px-0 py-4">
                    <div className="stat-title">Overall Progress</div>
                    <div className="stat-value text-2xl">
                      Level {user?.stats?.userLevel}
                    </div>
                    <div className="stat-desc mb-3">
                      {userProgressXP}/{totalUserXpToLevelUp} XP
                    </div>
                    <ProgressBar
                      progress={userProgressPercentage}
                      maxProgress={100}
                    />
                  </div>

                  <div className="stat px-0 py-4">
                    <div className="stat-title">Listening Progress</div>
                    <div className="stat-value text-2xl">
                      Level {user?.stats?.listeningLevel}
                    </div>
                    <div className="stat-desc mb-3">
                      {listeningProgressXP}/{totalListeningXpToLevelUp} XP
                    </div>
                    <ProgressBar
                      progress={listeningProgressPercentage}
                      maxProgress={100}
                    />
                  </div>

                  <div className="stat px-0 py-4">
                    <div className="stat-title">Reading Progress</div>
                    <div className="stat-value text-2xl">
                      Level {user?.stats?.readingLevel}
                    </div>
                    <div className="stat-desc mb-3">
                      {readingProgressXP}/{totalReadingXpToLevelUp} XP
                    </div>
                    <ProgressBar
                      progress={readingProgressPercentage}
                      maxProgress={100}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="card w-full bg-base-100 shadow-sm overflow-visible">
              <div className="card-body w-full p-4 sm:p-6 overflow-visible">
                <h2 className="card-title mb-4">Immersion Activity</h2>
                {username && <ImmersionHeatmap username={username} />}
              </div>
            </div>

            {username === loggedUser?.username && (
              <ImmersionGoals username={username} />
            )}

            {/* Achievement Showcase */}
            {username && (
              <AchievementShowcaseWidget
                username={username}
                isOwner={username === loggedUser?.username}
              />
            )}

          </div>

          <div className="flex flex-col gap-4 md:gap-5">
            <div className="flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <h2 className="card-title self-start">{username}'s Activity</h2>
                {/* Kind filter */}
                <div className="dropdown dropdown-end">
                  <div
                    tabIndex={0}
                    role="button"
                    className="btn btn-outline gap-2 justify-start"
                  >
                    {(() => {
                      const Icon = feedKindOptions.find((o) => o.value === feedKind)?.icon;
                      return Icon ? <Icon className="w-4 h-4" /> : null;
                    })()}
                    {feedKindOptions.find((o) => o.value === feedKind)?.label}
                    <ChevronDown className="w-4 h-4 ml-auto" />
                  </div>
                  <ul
                    tabIndex={0}
                    className="dropdown-content menu bg-base-100 rounded-box z-[1] w-48 p-2 shadow-lg"
                  >
                    {feedKindOptions.map((option) => {
                      const Icon = option.icon;
                      return (
                        <li key={option.value}>
                          <a
                            className={feedKind === option.value ? 'active' : ''}
                            onClick={() => setFeedKind(option.value)}
                          >
                            <Icon className="w-4 h-4" />
                            {option.label}
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                {/* Search Bar and Filter Dropdowns Row */}
                <div className="flex flex-col lg:flex-row gap-4">
                  {/* Search Bar */}
                  <div className="flex-1 lg:max-w-md">
                    <label className="input input-bordered flex items-center gap-2">
                      <Search className="w-5 h-5 opacity-70" />
                      <input
                        type="text"
                        className="grow"
                        placeholder="Search logs..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </label>
                  </div>

                  {/* Filter Dropdowns */}
                  <div className="flex flex-col sm:flex-row gap-3 lg:flex-shrink-0">
                    {/* Type Filter Dropdown (logs only) */}
                    {feedKind !== 'achievements' && (
                      <div className="dropdown dropdown-end sm:dropdown-start flex-1 sm:flex-none">
                        <div
                          tabIndex={0}
                          role="button"
                          className="btn btn-outline gap-2 w-full sm:w-auto justify-start"
                        >
                          <Funnel className="w-4 h-4" />
                          {filterType === 'all'
                            ? 'All Types'
                            : filterType.charAt(0).toUpperCase() +
                              filterType.slice(1)}
                          <ChevronDown className="w-4 h-4 ml-auto" />
                        </div>
                        <ul
                          tabIndex={0}
                          className="dropdown-content menu bg-base-100 rounded-box z-[1] w-full sm:w-52 p-2 shadow-lg"
                        >
                          {[
                            { value: 'all', label: 'All Types' },
                            { value: 'anime', label: 'Anime' },
                            { value: 'manga', label: 'Manga' },
                            { value: 'reading', label: 'Reading' },
                            { value: 'vn', label: 'Visual Novel' },
                            { value: 'game', label: 'Video Game' },
                            { value: 'video', label: 'Video' },
                            { value: 'movie', label: 'Movie' },
                            { value: 'audio', label: 'Audio' },
                            { value: 'other', label: 'Other' },
                          ].map((option) => (
                            <li key={option.value}>
                              <a
                                className={
                                  filterType === option.value ? 'active' : ''
                                }
                                onClick={() => {
                                  const value = option.value;
                                  if (value === 'all' || isValidLogType(value)) {
                                    setFilterType(value as typeof filterType);
                                  }
                                }}
                              >
                                {option.label}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Category Filter Dropdown (achievements only) */}
                    {feedKind !== 'logs' && (
                      <div className="dropdown dropdown-end sm:dropdown-start flex-1 sm:flex-none">
                        <div
                          tabIndex={0}
                          role="button"
                          className="btn btn-outline gap-2 w-full sm:w-auto justify-start"
                        >
                          <Tag className="w-4 h-4" />
                          {achievementCategoryOptions.find((o) => o.value === achievementCategory)?.label}
                          <ChevronDown className="w-4 h-4 ml-auto" />
                        </div>
                        <ul
                          tabIndex={0}
                          className="dropdown-content menu bg-base-100 rounded-box z-[1] w-full sm:w-52 p-2 shadow-lg"
                        >
                          {achievementCategoryOptions.map((option) => (
                            <li key={option.value}>
                              <a
                                className={
                                  achievementCategory === option.value ? 'active' : ''
                                }
                                onClick={() => setAchievementCategory(option.value)}
                              >
                                {option.label}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Date Filter Dropdown */}
                    <div className="dropdown dropdown-end sm:dropdown-start flex-1 sm:flex-none">
                      <div
                        tabIndex={0}
                        role="button"
                        className="btn btn-outline gap-2 w-full sm:w-auto justify-start"
                      >
                        <Clock className="w-4 h-4" />
                        {dateFilter === 'all'
                          ? 'All Time'
                          : dateFilter === 'today'
                            ? 'Today'
                            : dateFilter === 'week'
                              ? 'This Week'
                              : dateFilter === 'month'
                                ? 'This Month'
                                : dateFilter === 'year'
                                  ? 'This Year'
                                  : 'Custom Range'}
                        <ChevronDown className="w-4 h-4 ml-auto" />
                      </div>
                      <ul
                        tabIndex={0}
                        className="dropdown-content menu bg-base-100 rounded-box z-[1] w-full sm:w-52 p-2 shadow-lg"
                      >
                        {[
                          { value: 'all', label: 'All Time' },
                          { value: 'today', label: 'Today' },
                          { value: 'week', label: 'This Week' },
                          { value: 'month', label: 'This Month' },
                          { value: 'year', label: 'This Year' },
                          { value: 'custom', label: 'Custom Range' },
                        ].map((option) => (
                          <li key={option.value}>
                            <a
                              className={
                                dateFilter === option.value ? 'active' : ''
                              }
                              onClick={() => {
                                const value = option.value as typeof dateFilter;
                                setDateFilter(value);
                                // Reset custom dates when switching away from custom
                                if (value !== 'custom') {
                                  setCustomStartDate(undefined);
                                  setCustomEndDate(undefined);
                                }
                              }}
                            >
                              {option.label}
                            </a>
                          </li>
                        ))}
                        <li className="mt-1">
                          <div className="divider my-1"></div>
                        </li>
                        <li>
                          <label className="flex items-center gap-2 px-2 py-1 cursor-pointer">
                            <input
                              type="checkbox"
                              className="toggle toggle-sm"
                              checked={showUnknownDates}
                              onChange={(e) =>
                                setShowUnknownDates(e.target.checked)
                              }
                            />
                            <span>Include unknown dates</span>
                          </label>
                        </li>
                      </ul>
                    </div>

                    {/* Combined Sort Filter Dropdown (hidden for the mixed "all" feed, which is always chronological) */}
                    {feedKind !== 'all' && (
                      <div className="dropdown dropdown-end flex-1 sm:flex-none">
                        <div
                          tabIndex={0}
                          role="button"
                          className="btn btn-outline gap-2 w-full sm:w-auto justify-start"
                        >
                          <ListFilter className="w-4 h-4" />
                          Sort:{' '}
                          {sortFieldOptions.find((o) => o.value === sortBy)?.label ?? 'Date'}{' '}
                          {sortDirection === 'desc' ? (
                            <ArrowDown className="w-3 h-3" />
                          ) : (
                            <ArrowUp className="w-3 h-3" />
                          )}
                          <ChevronDown className="w-4 h-4 ml-auto" />
                        </div>
                        <ul
                          tabIndex={0}
                          className="dropdown-content menu bg-base-100 rounded-box z-[1] w-full sm:w-60 p-2 shadow-lg"
                        >
                          <li className="menu-title">
                            <span>Sort Field</span>
                          </li>
                          {sortFieldOptions.map((option) => (
                            <li key={option.value}>
                              <a
                                className={
                                  sortBy === option.value ? 'active' : ''
                                }
                                onClick={() => {
                                  setSortBy(option.value as typeof sortBy);
                                }}
                              >
                                {option.label}
                              </a>
                            </li>
                          ))}
                          <div className="divider my-1"></div>
                          <li className="menu-title">
                            <span>Sort Direction</span>
                          </li>
                          <li>
                            <a
                              className={sortDirection === 'desc' ? 'active' : ''}
                              onClick={() => setSortDirection('desc')}
                            >
                              <ArrowDown className="w-4 h-4" />
                              Highest to Lowest
                            </a>
                          </li>
                          <li>
                            <a
                              className={sortDirection === 'asc' ? 'active' : ''}
                              onClick={() => setSortDirection('asc')}
                            >
                              <ArrowUp className="w-4 h-4" />
                              Lowest to Highest
                            </a>
                          </li>
                        </ul>
                      </div>
                    )}
                  </div>
                </div>

                {/* Custom Date Range (when selected) - Now below the main filter row */}
                {dateFilter === 'custom' && (
                  <div className="flex flex-col sm:flex-row gap-3 w-full">
                    <div className="dropdown dropdown-bottom flex-1 sm:flex-none">
                      <div
                        tabIndex={0}
                        role="button"
                        className="btn btn-outline w-full sm:w-auto"
                      >
                        {customStartDate
                          ? formatDateOnly(customStartDate)
                          : 'Start Date'}
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4 ml-1"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                      </div>
                      <div
                        tabIndex={0}
                        className="dropdown-content z-[1000] card card-compact w-64 p-2 shadow-sm bg-base-100 border border-base-300"
                      >
                        <DayPicker
                          className="react-day-picker mx-auto"
                          mode="single"
                          selected={customStartDate}
                          onSelect={(date) => {
                            setCustomStartDate(date);
                            // Close dropdown by removing focus
                            (document.activeElement as HTMLElement)?.blur?.();
                            // Reset end date if it's before the new start date
                            if (customEndDate && date && customEndDate < date) {
                              setCustomEndDate(undefined);
                            }
                          }}
                          disabled={(date) => date > new Date()} // Disable future dates
                        />
                      </div>
                    </div>
                    <span className="hidden sm:flex items-center text-base-content/50 justify-center">
                      to
                    </span>

                    <div className="dropdown dropdown-bottom flex-1 sm:flex-none">
                      <div
                        tabIndex={0}
                        role="button"
                        className={`btn btn-outline w-full sm:w-auto ${!customStartDate ? 'btn-disabled' : ''}`}
                      >
                        {customEndDate
                          ? formatDateOnly(customEndDate)
                          : 'End Date'}
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4 ml-1"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                      </div>
                      {customStartDate && (
                        <div
                          tabIndex={0}
                          className="dropdown-content z-[1000] card card-compact w-64 p-2 shadow-sm bg-base-100 border border-base-300"
                        >
                          <DayPicker
                            className="react-day-picker mx-auto"
                            mode="single"
                            selected={customEndDate}
                            onSelect={(date) => {
                              setCustomEndDate(date);
                              // Close dropdown by removing focus
                              (document.activeElement as HTMLElement)?.blur?.();
                            }}
                            disabled={(date) => {
                              const today = new Date();
                              const startDate = customStartDate;
                              return (
                                date > today || (startDate && date < startDate)
                              );
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Active Filters - Now below everything else */}
                {(dateFilter !== 'all' ||
                  (feedKind !== 'achievements' && filterType !== 'all') ||
                  (feedKind !== 'logs' && achievementCategory !== 'all') ||
                  searchTerm ||
                  showUnknownDates) && (
                  <div className="flex flex-wrap gap-2 items-center">
                    <span className="text-xs text-base-content/60">
                      Active filters:
                    </span>

                    {searchTerm && (
                      <div className="badge badge-primary badge-sm gap-1">
                        Search: "{searchTerm}"
                        <button
                          className="ml-1 hover:bg-primary-focus rounded-full"
                          onClick={() => setSearchTerm('')}
                          aria-label="Clear search"
                        >
                          ✁E
                        </button>
                      </div>
                    )}

                    {feedKind !== 'achievements' && filterType !== 'all' && (
                      <div className="badge badge-secondary badge-sm gap-1">
                        Type: {filterType}
                        <button
                          className="ml-1 hover:bg-secondary-focus rounded-full"
                          onClick={() => setFilterType('all')}
                          aria-label="Clear type filter"
                        >
                          ✁E
                        </button>
                      </div>
                    )}

                    {feedKind !== 'logs' && achievementCategory !== 'all' && (
                      <div className="badge badge-secondary badge-sm gap-1">
                        Category:{' '}
                        {achievementCategoryOptions.find((o) => o.value === achievementCategory)?.label}
                        <button
                          className="ml-1 hover:bg-secondary-focus rounded-full"
                          onClick={() => setAchievementCategory('all')}
                          aria-label="Clear category filter"
                        >
                          ✁E
                        </button>
                      </div>
                    )}

                    {dateFilter !== 'all' && (
                      <div className="badge badge-accent badge-sm gap-1">
                        {dateFilter === 'custom'
                          ? `${customStartDate?.toLocaleDateString() || 'Start'} to ${customEndDate?.toLocaleDateString() || 'End'}`
                          : dateFilter === 'today'
                            ? 'Today'
                            : dateFilter === 'week'
                              ? 'This Week'
                              : dateFilter === 'month'
                                ? 'This Month'
                                : 'This Year'}
                        <button
                          className="ml-1 hover:bg-accent-focus rounded-full"
                          onClick={() => {
                            setDateFilter('all');
                            setCustomStartDate(undefined);
                            setCustomEndDate(undefined);
                          }}
                          aria-label="Clear date filter"
                        >
                          ✁E
                        </button>
                      </div>
                    )}

                    {showUnknownDates && (
                      <div className="badge badge-neutral badge-sm gap-1">
                        Include unknown dates
                        <button
                          className="ml-1 hover:bg-neutral-focus rounded-full"
                          onClick={() => setShowUnknownDates(false)}
                          aria-label="Hide unknown dates"
                        >
                          ✁E
                        </button>
                      </div>
                    )}

                    {feedKind !== 'all' && sortBy !== 'date' && (
                      <div className="badge badge-info badge-sm gap-1">
                        Sort:{' '}
                        {sortFieldOptions.find((o) => o.value === sortBy)?.label}
                        <button
                          className="ml-1 hover:bg-info-focus rounded-full"
                          onClick={() => setSortBy('date')}
                          aria-label="Clear sort filter"
                        >
                          ✁E
                        </button>
                      </div>
                    )}

                    <button
                      className="btn btn-ghost btn-xs text-base-content/60 hover:text-base-content"
                      onClick={() => {
                        setSearchTerm('');
                        setFilterType('all');
                        setAchievementCategory('all');
                        setDateFilter('all');
                        setCustomStartDate(undefined);
                        setCustomEndDate(undefined);
                        setSortBy('date');
                        setSortDirection('desc');
                        setShowUnknownDates(false);
                      }}
                    >
                      Clear all
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Unified feed: achievements + log cards mixed chronologically */}
            {feedKind === 'achievements' ? (
              // Show ONLY achievements
              filteredAchievements.length === 0 ? (
                <div className="card w-full bg-base-100 shadow-sm p-4">
                  <p className="text-center text-base-content/60">
                    {(achievementActivity ?? []).length === 0
                      ? 'No achievements yet'
                      : 'No achievements match your filters'}
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {filteredAchievements.map((item) => (
                    <AchievementFeedItem
                      key={String(item.userAchievementId)}
                      item={item as IPendingAchievement}
                    />
                  ))}
                </div>
              )
            ) : feedKind === 'logs' ? (
              // Show ONLY logs (original log card rendering)
              <>
                {logs?.pages ? (
                  groupedLogs.map((entry) =>
                    entry.isPlaylistGroup ? (
                      <PlaylistBatchCard key={entry.key} logs={entry.logs} user={username} />
                    ) : (
                      <LogCard key={entry.logs[0]._id} log={entry.logs[0]} user={username} />
                    )
                  )
                ) : (
                  <div className="card w-full bg-base-100 shadow-sm p-4">
                    <p className="text-center">No logs available</p>
                  </div>
                )}
                {logs?.pages && displayedLogs.length === 0 ? (
                  <div className="card w-full bg-base-100 shadow-sm p-4">
                    <div className="alert alert-info">
                      <span>No logs match your search criteria</span>
                    </div>
                  </div>
                ) : null}
                <button
                  className="btn btn-primary w-full sm:btn-wide mt-2 self-center"
                  onClick={() => fetchNextPage()}
                  disabled={!hasNextPage || isFetchingNextPage}
                >
                  {isFetchingNextPage ? (
                    <span className="loading loading-spinner loading-sm"></span>
                  ) : hasNextPage ? (
                    'Load More'
                  ) : (
                    'Nothing more to load'
                  )}
                </button>
              </>
            ) : (
              // Show ALL — unified chronological mix
              <>
                {unifiedFeed.length === 0 ? (
                  <div className="card w-full bg-base-100 shadow-sm p-4">
                    <p className="text-center text-base-content/60">No activity yet</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {unifiedFeed.map((item) => {
                      if (item.kind === 'achievement') {
                        return (
                          <AchievementFeedItem
                            key={`ach-${item.data.userAchievementId}`}
                            item={item.data as IPendingAchievement}
                          />
                        );
                      }
                      // Log — find group
                      const log = item.data;
                      const groupKey = log.playlistBatchId?.trim() || `single:${log._id}`;
                      const entry = groupedLogs.find((g) => g.key === groupKey);
                      if (!entry) return null;
                      // Skip non-representative logs in a group
                      if (entry.logs[0]._id !== log._id) return null;
                      return entry.isPlaylistGroup ? (
                        <PlaylistBatchCard key={entry.key} logs={entry.logs} user={username} />
                      ) : (
                        <LogCard key={entry.logs[0]._id} log={entry.logs[0]} user={username} />
                      );
                    })}
                  </div>
                )}
                {logs?.pages && displayedLogs.length === 0 && filteredAchievements.length === 0 ? (
                  <div className="card w-full bg-base-100 shadow-sm p-4">
                    <div className="alert alert-info">
                      <span>No activity matches your search criteria</span>
                    </div>
                  </div>
                ) : null}
                {hasNextPage && (
                  <button
                    className="btn btn-primary w-full sm:btn-wide mt-2 self-center"
                    onClick={() => fetchNextPage()}
                    disabled={isFetchingNextPage}
                  >
                    {isFetchingNextPage ? (
                      <span className="loading loading-spinner loading-sm"></span>
                    ) : (
                      'Load More Logs'
                    )}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Achievement Showcase Widget ─────────────────────────────────────────────

function AchievementShowcaseWidget({
  username,
  isOwner,
}: {
  username: string;
  isOwner: boolean;
}) {
  const { data: achievements, isLoading } = useQuery({
    queryKey: ['userAchievements', username],
    queryFn: () => getUserAchievementsFn(username),
    staleTime: 5 * 60 * 1000,
  });

  const earned = achievements?.filter((a) => a.isEarned) ?? [];
  const topAchievements = [...earned]
    .sort((a, b) => {
      const rarityOrder = { secret: 0, legendary: 1, epic: 2, rare: 3, common: 4 };
      return (rarityOrder[a.rarity] ?? 5) - (rarityOrder[b.rarity] ?? 5);
    })
    .slice(0, 5);

  if (!isLoading && earned.length === 0) return null;

  return (
    <div className="card w-full bg-base-100 shadow-sm">
      <div className="card-body w-full p-4 sm:p-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="card-title text-base">Achievements</h2>
          <Link
            to={`/user/${username}/achievements`}
            className="btn btn-xs btn-ghost opacity-60 hover:opacity-100"
          >
            View all
          </Link>
        </div>

        {isLoading ? (
          <div className="flex gap-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="skeleton h-10 w-10 rounded-full" />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {topAchievements.map((a) => (
              <div
                key={a._id}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 bg-base-200/60 border border-base-300 transition-all"
              >
                {a.iconSlug ? (
                  <Icon
                    icon={`game-icons:${a.iconSlug}`}
                    width={20}
                    height={20}
                    color={RARITY_COLOR[a.rarity] ?? RARITY_COLOR.common}
                  />
                ) : (
                  <span className="text-sm">🏆</span>
                )}
                <span className="text-xs font-semibold flex-1 truncate">
                  {a.name ?? '???'}
                </span>
                <span
                  className="text-xs capitalize shrink-0"
                  style={{ color: RARITY_COLOR[a.rarity] ?? RARITY_COLOR.common }}
                >
                  {a.rarity}
                </span>
              </div>
            ))}
            {isOwner && earned.length === 0 && (
              <p className="text-xs opacity-40">Log some immersion to start earning achievements!</p>
            )}
          </div>
        )}

        {earned.length > 0 && (
          <p className="text-xs opacity-40 mt-2">
            {earned.length} achievement{earned.length !== 1 ? 's' : ''} earned
          </p>
        )}
      </div>
    </div>
  );
}

export default ProfileScreen;
import { useInfiniteQuery } from '@tanstack/react-query';
import {
  Trophy,
  BookOpen,
  Headphones,
  Zap,
  Calendar1,
  BarChart,
  Calendar,
} from 'lucide-react';

import { getRankingFn, getMediumRankingFn } from '../api/trackerApi';
import { useEffect, useRef, useState } from 'react';
import { filterTypes, IStats } from '../types';
import { Link } from 'react-router-dom';
import { useTimezone } from '../hooks/useTimezone';
import { numberWithCommas } from '../utils/utils';
import { DayPicker } from 'react-day-picker';
import { getPatreonBadgeProps } from '../utils/patreonBadge';

type RankedUser = {
  username: string;
  avatar?: string;
  stats?: Partial<IStats>;
  xp?: number;
  hours?: number;
  episodes?: number;
  pages?: number;
  chars?: number;
  patreon?: {
    isActive: boolean;
    tier: 'donator' | 'enthusiast' | 'consumer' | null;
    customBadgeText?: string;
    badgeColor?: string;
    badgeTextColor?: string;
  };
};

function RankingScreen() {
  const [limit] = useState(10);
  const [xpFilter, setXpFilter] = useState<filterTypes>('userXp');
  const [timeFilter, setTimeFilter] = useState<string>('month');
  const [displayMode, setDisplayMode] = useState<'xp' | 'hours' | 'chars'>(
    'xp'
  );
  const [mode, setMode] = useState<'global' | 'medium'>('global');
  const [mediumType, setMediumType] = useState<
    | 'anime'
    | 'manga'
    | 'reading'
    | 'vn'
    | 'video'
    | 'movie'
    | 'tv show'
    | 'audio'
  >('anime');
  const mediumMetricOptions: Record<
    | 'anime'
    | 'manga'
    | 'reading'
    | 'vn'
    | 'video'
    | 'movie'
    | 'tv show'
    | 'audio',
    Array<{
      label: string;
      value: 'xp' | 'time' | 'episodes' | 'chars' | 'pages';
    }>
  > = {
    anime: [
      { label: 'XP', value: 'xp' },
      { label: 'Time', value: 'time' },
      { label: 'Episodes', value: 'episodes' },
    ],
    audio: [
      { label: 'XP', value: 'xp' },
      { label: 'Time', value: 'time' },
    ],
    reading: [
      { label: 'XP', value: 'xp' },
      { label: 'Time', value: 'time' },
      { label: 'Characters', value: 'chars' },
    ],
    manga: [
      { label: 'XP', value: 'xp' },
      { label: 'Time', value: 'time' },
      { label: 'Pages', value: 'pages' },
      { label: 'Characters', value: 'chars' },
    ],
    video: [
      { label: 'XP', value: 'xp' },
      { label: 'Time', value: 'time' },
    ],
    vn: [
      { label: 'XP', value: 'xp' },
      { label: 'Time', value: 'time' },
      { label: 'Characters', value: 'chars' },
    ],
    movie: [
      { label: 'XP', value: 'xp' },
      { label: 'Time', value: 'time' },
    ],
    'tv show': [
      { label: 'XP', value: 'xp' },
      { label: 'Time', value: 'time' },
    ],
  };
  const [mediumMetric, setMediumMetric] = useState<
    'xp' | 'time' | 'episodes' | 'chars' | 'pages'
  >(mediumMetricOptions[mediumType][0].value);
  const { timezone } = useTimezone(); // Get user's timezone
  const [startDate, setStartDate] = useState<string>(''); // YYYY-MM-DD
  const [endDate, setEndDate] = useState<string>(''); // YYYY-MM-DD
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>(
    undefined
  );
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>(
    undefined
  );
  const startBtnRef = useRef<HTMLDivElement | null>(null);
  const endBtnRef = useRef<HTMLDivElement | null>(null);

  const formatDateOnly = (d?: Date) =>
    d
      ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      : '';

  // Get the actual filter to send to backend based on display mode
  const getBackendFilter = () => {
    if (displayMode === 'hours') {
      return xpFilter === 'userXp'
        ? 'userHours'
        : xpFilter === 'readingXp'
          ? 'readingHours'
          : 'listeningHours';
    } else if (displayMode === 'chars') {
      return 'userChars';
    }
    return xpFilter;
  };

  const {
    data: rankedUsers,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery({
    queryKey: [
      'ranking',
      xpFilter,
      timeFilter,
      displayMode,
      timezone,
      startDate,
      endDate,
    ],
    queryFn: ({ pageParam }) =>
      getRankingFn({
        limit,
        page: pageParam as number,
        filter: getBackendFilter(),
        timeFilter,
        timezone, // Pass user's timezone to backend
        start: startDate || undefined,
        end: endDate || undefined,
      }),
    getNextPageParam: (lastPage, _allPages, lastPageParam) => {
      if (lastPage.length < limit) return undefined;
      return lastPageParam + 1;
    },
    initialPageParam: 1,
    staleTime: Infinity,
    enabled: mode === 'global',
  });

  // Medium-based leaderboard
  const {
    data: mediumUsers,
    fetchNextPage: fetchNextPageMedium,
    hasNextPage: hasNextPageMedium,
    isFetchingNextPage: isFetchingNextPageMedium,
    isLoading: isLoadingMedium,
  } = useInfiniteQuery({
    queryKey: [
      'ranking-medium',
      mediumType,
      mediumMetric,
      timeFilter,
      timezone,
      startDate,
      endDate,
    ],
    queryFn: ({ pageParam }) =>
      getMediumRankingFn({
        limit,
        page: pageParam as number,
        type: mediumType,
        metric: mediumMetric,
        timeFilter,
        timezone,
        start: startDate || undefined,
        end: endDate || undefined,
      }),
    getNextPageParam: (lastPage, _allPages, lastPageParam) => {
      if (lastPage.length < limit) return undefined;
      return lastPageParam + 1;
    },
    initialPageParam: 1,
    staleTime: Infinity,
    enabled: mode === 'medium',
  });

  // Combined filter options: scope (Total/Reading/Listening) and metric (XP/Hours/Chars)
  const scopeOptions = [
    {
      label: 'Total',
      value: 'userXp',
      icon: <Zap className="w-4 h-4" />,
    },
    {
      label: 'Reading',
      value: 'readingXp',
      icon: <BookOpen className="w-4 h-4" />,
    },
    {
      label: 'Listening',
      value: 'listeningXp',
      icon: <Headphones className="w-4 h-4" />,
    },
  ] as const;
  const metricOptions = [
    { label: 'XP', value: 'xp' as const },
    { label: 'Hours', value: 'hours' as const },
    { label: 'Chars', value: 'chars' as const },
  ];
  const allowedMetricOptions = () =>
    xpFilter === 'listeningXp'
      ? metricOptions.filter((m) => m.value !== 'chars')
      : metricOptions;

  // Ensure invalid metric is corrected when switching to Listening scope
  useEffect(() => {
    if (xpFilter === 'listeningXp' && displayMode === 'chars') {
      setDisplayMode('xp');
    }
  }, [xpFilter, displayMode]);

  // Time filter options
  const timeFilterOptions = [
    {
      label: 'All Time',
      value: 'all-time',
      icon: <Trophy className="w-4 h-4" />,
    },
    {
      label: 'Today',
      value: 'today',
      icon: <Calendar1 className="w-4 h-4" />,
    },
    {
      label: 'This Week',
      value: 'week',
      icon: <Calendar1 className="w-4 h-4" />,
    },
    {
      label: 'This Month',
      value: 'month',
      icon: <BarChart className="w-4 h-4" />,
    },
    {
      label: 'This Year',
      value: 'year',
      icon: <Calendar className="w-4 h-4" />,
    },
  ];

  // Get display value based on mode
  const getDisplayValue = (user: {
    stats?: {
      userXp?: number;
      readingXp?: number;
      listeningXp?: number;
      userHours?: number;
      readingHours?: number;
      listeningHours?: number;
    };
  }) => {
    if (displayMode === 'hours') {
      return xpFilter === 'userXp'
        ? user.stats?.userHours || 0
        : xpFilter === 'readingXp'
          ? user.stats?.readingHours || 0
          : user.stats?.listeningHours || 0;
    } else {
      return xpFilter === 'userXp'
        ? user.stats?.userXp || 0
        : xpFilter === 'readingXp'
          ? user.stats?.readingXp || 0
          : user.stats?.listeningXp || 0;
    }
  };

  // Get formatted display value for the podium (top 3)
  const getTopDisplayValue = (user: {
    stats?: {
      userChars?: number;
      userXp?: number;
      readingXp?: number;
      listeningXp?: number;
      userHours?: number;
      readingHours?: number;
      listeningHours?: number;
    };
  }) => {
    if (displayMode === 'hours') {
      return `${numberWithCommas(getDisplayValue(user) as number)} hrs`;
    }
    if (displayMode === 'chars') {
      return numberWithCommas(user.stats?.userChars || 0);
    }
    return numberWithCommas(getDisplayValue(user) as number);
  };

  // Medium-mode podium value formatter
  const getTopDisplayValueMedium = (user: {
    xp?: number;
    hours?: number;
    episodes?: number;
    pages?: number;
    chars?: number;
  }) => {
    if (mediumMetric === 'time') {
      return `${numberWithCommas(user.hours || 0)} hrs`;
    }
    const val =
      mediumMetric === 'episodes'
        ? user.episodes || 0
        : mediumMetric === 'pages'
          ? user.pages || 0
          : mediumMetric === 'chars'
            ? user.chars || 0
            : user.xp || 0;
    return numberWithCommas(val);
  };

  const topGlobalUsers = (
    (rankedUsers?.pages?.[0] ?? []) as RankedUser[]
  ).slice(0, 3);
  const [firstGlobalUser, secondGlobalUser, thirdGlobalUser] = topGlobalUsers;
  const firstGlobalBadge = getPatreonBadgeProps(firstGlobalUser?.patreon);
  const secondGlobalBadge = getPatreonBadgeProps(secondGlobalUser?.patreon);
  const thirdGlobalBadge = getPatreonBadgeProps(thirdGlobalUser?.patreon);

  const topMediumUsers = (
    (mediumUsers?.pages?.[0] ?? []) as RankedUser[]
  ).slice(0, 3);
  const [firstMediumUser, secondMediumUser, thirdMediumUser] = topMediumUsers;
  const firstMediumBadge = getPatreonBadgeProps(firstMediumUser?.patreon);
  const secondMediumBadge = getPatreonBadgeProps(secondMediumUser?.patreon);
  const thirdMediumBadge = getPatreonBadgeProps(thirdMediumUser?.patreon);

  // (units displayed inline per mode)

  // Get the correct label for the selected filter
  const getFilterLabel = () => {
    const option = scopeOptions.find((option) => option.value === xpFilter);
    const metric = metricOptions.find((m) => m.value === displayMode)?.label;
    return `${option?.label || 'Total'} · ${metric}`;
  };

  const getFilterIcon = () => {
    const option = scopeOptions.find((option) => option.value === xpFilter);
    return option?.icon || <Zap className="w-4 h-4" />;
  };

  // Get the correct label for the selected time filter
  const getTimeFilterLabel = () => {
    if (timeFilter === 'custom') return 'Custom';
    const option = timeFilterOptions.find(
      (option) => option.value === timeFilter
    );
    return option?.label || 'All Time';
  };

  const getTimeFilterIcon = () => {
    const option = timeFilterOptions.find(
      (option) => option.value === timeFilter
    );
    return option?.icon || <Trophy className="w-4 h-4" />;
  };

  const getRankColor = (rank: number) => {
    switch (rank) {
      case 1:
        return 'text-warning';
      case 2:
        return 'text-base-content';
      case 3:
        return 'text-accent';
      default:
        return 'text-base-content/70';
    }
  };

  return (
    <div className="min-h-screen pt-16 bg-base-200">
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-2">
            <Trophy className="w-10 h-10 text-warning" />
            <h1 className="text-4xl font-bold text-base-content">
              Leaderboard
            </h1>
          </div>
          <p className="text-base-content/70">
            See how you stack up against other learners
          </p>
        </div>

        <div className="flex flex-col sm:flex-row justify-center gap-4 mb-8">
          <div className="join">
            <button
              className={`btn join-item ${mode === 'global' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setMode('global')}
            >
              Global
            </button>
            <button
              className={`btn join-item ${mode === 'medium' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setMode('medium')}
            >
              By Medium
            </button>
          </div>

          {/* Combined scope+metric dropdown (Global mode only) */}

          <div className="dropdown dropdown-end">
            <div tabIndex={0} role="button" className="btn btn-outline gap-2">
              {getTimeFilterIcon()}
              {getTimeFilterLabel()}
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M19 9l-7 7-7-7"
                ></path>
              </svg>
            </div>
            <ul
              tabIndex={0}
              className="dropdown-content menu p-2 shadow-xl bg-base-100 rounded-box w-72 border border-base-300"
            >
              {timeFilterOptions.map((option) => (
                <li key={option.value}>
                  <button
                    className={`gap-3 ${timeFilter === option.value ? 'active' : ''}`}
                    onClick={() => {
                      setTimeFilter(option.value);
                      if (option.value !== 'custom') {
                        setStartDate('');
                        setEndDate('');
                        setCustomStartDate(undefined);
                        setCustomEndDate(undefined);
                      }
                    }}
                  >
                    {option.icon}
                    {option.label}
                  </button>
                </li>
              ))}
              <li className="menu-title px-2 mt-2">Custom range</li>
              <li className="px-2 py-2">
                <div className="flex flex-col gap-2">
                  <div className="flex flex-col gap-2 w-full">
                    <div className="dropdown dropdown-bottom">
                      <div
                        tabIndex={0}
                        role="button"
                        className="btn btn-outline btn-sm w-full"
                        ref={startBtnRef}
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
                        className="dropdown-content z-[1000] card card-compact w-64 p-2 shadow bg-base-100 border border-base-300"
                      >
                        <DayPicker
                          className="react-day-picker mx-auto"
                          mode="single"
                          selected={customStartDate}
                          onSelect={(date) => {
                            setCustomStartDate(date ?? undefined);
                            if (customEndDate && date && customEndDate < date) {
                              setCustomEndDate(undefined);
                            }
                            // Move focus back to the trigger to close only this picker and keep the main dropdown open
                            startBtnRef.current?.focus();
                          }}
                          disabled={() => false}
                        />
                      </div>
                    </div>
                    <span className="text-center text-base-content/50">to</span>

                    <div className="dropdown dropdown-bottom">
                      <div
                        tabIndex={0}
                        role="button"
                        className={`btn btn-outline btn-sm w-full ${!customStartDate ? 'btn-disabled' : ''}`}
                        ref={endBtnRef}
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
                          className="dropdown-content z-[1000] card card-compact w-64 p-2 shadow bg-base-100 border border-base-300"
                        >
                          <DayPicker
                            className="react-day-picker mx-auto"
                            mode="single"
                            selected={customEndDate}
                            onSelect={(date) => {
                              setCustomEndDate(date ?? undefined);
                              // Move focus back to the trigger to close only this picker and keep the main dropdown open
                              endBtnRef.current?.focus();
                            }}
                            disabled={(date) => {
                              const startD = customStartDate;
                              return startD && date < startD;
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 mt-2">
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={() => {
                        setStartDate(formatDateOnly(customStartDate));
                        setEndDate(formatDateOnly(customEndDate));
                        setTimeFilter('custom');
                      }}
                      disabled={!customStartDate || !customEndDate}
                    >
                      Apply
                    </button>
                    <button
                      className="btn btn-sm"
                      onClick={() => {
                        setStartDate('');
                        setEndDate('');
                        setCustomStartDate(undefined);
                        setCustomEndDate(undefined);
                        setTimeFilter('all-time');
                      }}
                    >
                      Clear
                    </button>
                  </div>
                </div>
              </li>
            </ul>
          </div>

          <div className="dropdown dropdown-end" hidden={mode !== 'global'}>
            <div tabIndex={0} role="button" className="btn btn-primary gap-2">
              {getFilterIcon()}
              {getFilterLabel()}
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M19 9l-7 7-7-7"
                ></path>
              </svg>
            </div>
            <ul
              tabIndex={0}
              className="dropdown-content menu p-2 shadow-lg bg-base-100 rounded-box w-52 border border-base-300"
            >
              <li className="menu-title px-2">Scope</li>
              {scopeOptions.map((option) => (
                <li key={option.value}>
                  <button
                    className={`gap-3 ${xpFilter === option.value ? 'active' : ''}`}
                    onClick={() => {
                      setXpFilter(option.value as filterTypes);
                      if (
                        option.value === 'listeningXp' &&
                        displayMode === 'chars'
                      ) {
                        setDisplayMode('xp');
                      }
                    }}
                  >
                    {option.icon}
                    {option.label}
                  </button>
                </li>
              ))}
              <li className="menu-title px-2 mt-2">Metric</li>
              {allowedMetricOptions().map((m) => (
                <li key={m.value}>
                  <button
                    className={`gap-3 ${displayMode === m.value ? 'active' : ''}`}
                    onClick={() => setDisplayMode(m.value)}
                  >
                    {m.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Medium filters */}
          <div className="dropdown dropdown-end" hidden={mode !== 'medium'}>
            <div tabIndex={0} role="button" className="btn btn-primary gap-2">
              {mediumType.toUpperCase()}
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M19 9l-7 7-7-7"
                ></path>
              </svg>
            </div>
            <ul
              tabIndex={0}
              className="dropdown-content menu p-2 shadow-lg bg-base-100 rounded-box w-52 border border-base-300"
            >
              {(
                [
                  'anime',
                  'manga',
                  'reading',
                  'vn',
                  'video',
                  'movie',
                  'tv show',
                  'audio',
                ] as const
              ).map((t) => (
                <li key={t}>
                  <button
                    onClick={() => {
                      setMediumType(t);
                      setMediumMetric(mediumMetricOptions[t][0].value);
                    }}
                  >
                    {t.toUpperCase()}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="dropdown dropdown-end" hidden={mode !== 'medium'}>
            <div tabIndex={0} role="button" className="btn btn-outline gap-2">
              {
                mediumMetricOptions[mediumType].find(
                  (o) => o.value === mediumMetric
                )?.label
              }
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M19 9l-7 7-7-7"
                ></path>
              </svg>
            </div>
            <ul
              tabIndex={0}
              className="dropdown-content menu p-2 shadow-lg bg-base-100 rounded-box w-52 border border-base-300"
            >
              {mediumMetricOptions[mediumType].map((opt) => (
                <li key={opt.value}>
                  <button onClick={() => setMediumMetric(opt.value)}>
                    {opt.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {(mode === 'global' ? isLoading : isLoadingMedium) ? (
          <div className="flex justify-center items-center py-16">
            <div className="text-center">
              <span className="loading loading-spinner loading-lg text-primary"></span>
              <p className="mt-4 text-base-content/70">Loading rankings...</p>
            </div>
          </div>
        ) : (
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body p-0">
              {mode === 'global' &&
                rankedUsers?.pages[0] &&
                rankedUsers.pages[0].length >= 3 && (
                  <div className="bg-gradient-to-r from-primary/10 to-secondary/10 p-3 sm:p-8 rounded-t-md">
                    <div className="grid grid-cols-3 gap-1.5 sm:gap-4 max-w-2xl mx-auto items-end">
                      <div className="text-center order-1">
                        <div className="relative mb-1 sm:mb-4">
                          <div className="avatar">
                            <div className="w-10 h-10 sm:w-16 sm:h-16 rounded-full ring ring-base-content/40">
                              {secondGlobalUser?.avatar ? (
                                <img
                                  src={secondGlobalUser.avatar}
                                  alt={`${secondGlobalUser.username}'s Avatar`}
                                />
                              ) : (
                                <div className="bg-neutral-content flex items-center justify-center h-full">
                                  <span className="text-sm sm:text-xl font-bold">
                                    {secondGlobalUser?.username
                                      ? secondGlobalUser.username
                                          .charAt(0)
                                          .toUpperCase()
                                      : ''}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col items-center gap-0.5">
                          <div className="badge badge-xs sm:badge-sm bg-base-content text-base-100 font-bold">
                            2nd
                          </div>
                          <Link
                            to={`/user/${secondGlobalUser?.username ?? ''}`}
                            className="font-bold hover:underline text-xs sm:text-sm flex items-center justify-center gap-1 flex-wrap max-w-full"
                          >
                            <span className="truncate max-w-[4.5rem] sm:max-w-none">
                              {secondGlobalUser?.username}
                            </span>
                            {secondGlobalBadge && (
                              <div
                                className={`badge badge-xs gap-1 hidden sm:inline-flex max-w-[8rem] overflow-hidden text-ellipsis whitespace-nowrap ${secondGlobalBadge.colorClass}`}
                                style={secondGlobalBadge.style}
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  className="h-3 w-3"
                                  viewBox="0 0 20 20"
                                  fill="currentColor"
                                >
                                  <path
                                    fillRule="evenodd"
                                    d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                                <span className="font-bold max-w-[5rem] overflow-hidden text-ellipsis whitespace-nowrap">
                                  {secondGlobalBadge.text}
                                </span>
                              </div>
                            )}
                          </Link>
                        </div>
                        <div className="text-xs sm:text-sm text-base-content/70">
                          Lv.{secondGlobalUser?.stats?.userLevel ?? 1}
                        </div>
                        <div className="text-sm sm:text-lg font-bold text-base-content mt-1">
                          {secondGlobalUser
                            ? getTopDisplayValue(secondGlobalUser)
                            : null}
                        </div>
                      </div>

                      <div className="text-center order-2">
                        <div className="relative mb-2 sm:mb-4">
                          <div className="avatar">
                            <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-full ring ring-warning ring-offset-2">
                              {firstGlobalUser?.avatar ? (
                                <img
                                  src={firstGlobalUser.avatar}
                                  alt={`${firstGlobalUser.username}'s Avatar`}
                                />
                              ) : (
                                <div className="bg-neutral-content flex items-center justify-center h-full">
                                  <span className="text-lg sm:text-2xl font-bold">
                                    {firstGlobalUser?.username
                                      ? firstGlobalUser.username
                                          .charAt(0)
                                          .toUpperCase()
                                      : ''}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="absolute -top-4 sm:-top-6 left-1/2 transform -translate-x-1/2">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              fill="currentColor"
                              stroke="none"
                              className="w-7 h-7 sm:w-9 sm:h-9 text-warning"
                            >
                              <path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z" />
                            </svg>
                          </div>
                        </div>
                        <div className="flex flex-col items-center gap-0.5">
                          <div className="badge badge-xs sm:badge-sm bg-warning text-warning-content font-bold">
                            1st
                          </div>
                          <Link
                            to={`/user/${firstGlobalUser?.username ?? ''}`}
                            className="font-bold hover:underline text-xs sm:text-base flex items-center justify-center gap-1 flex-wrap max-w-full"
                          >
                            <span className="truncate max-w-[4.5rem] sm:max-w-none">
                              {firstGlobalUser?.username}
                            </span>
                            {firstGlobalBadge && (
                              <div
                                className={`badge badge-xs gap-1 hidden sm:inline-flex max-w-[8rem] overflow-hidden text-ellipsis whitespace-nowrap ${firstGlobalBadge.colorClass}`}
                                style={firstGlobalBadge.style}
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  className="h-3 w-3"
                                  viewBox="0 0 20 20"
                                  fill="currentColor"
                                >
                                  <path
                                    fillRule="evenodd"
                                    d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                                <span className="font-bold max-w-[5rem] overflow-hidden text-ellipsis whitespace-nowrap">
                                  {firstGlobalBadge.text}
                                </span>
                              </div>
                            )}
                          </Link>
                        </div>
                        <div className="text-xs sm:text-sm text-base-content/70">
                          Lv.{firstGlobalUser?.stats?.userLevel ?? 1}
                        </div>
                        <div className="text-base sm:text-xl font-bold text-warning mt-1">
                          {firstGlobalUser
                            ? getTopDisplayValue(firstGlobalUser)
                            : null}
                        </div>
                      </div>

                      <div className="text-center order-3">
                        <div className="relative mb-1 sm:mb-4">
                          <div className="avatar">
                            <div className="w-10 h-10 sm:w-16 sm:h-16 rounded-full ring ring-accent/50">
                              {thirdGlobalUser?.avatar ? (
                                <img
                                  src={thirdGlobalUser.avatar}
                                  alt={`${thirdGlobalUser.username}'s Avatar`}
                                />
                              ) : (
                                <div className="bg-neutral-content flex items-center justify-center h-full">
                                  <span className="text-sm sm:text-xl font-bold">
                                    {thirdGlobalUser?.username
                                      ? thirdGlobalUser.username
                                          .charAt(0)
                                          .toUpperCase()
                                      : ''}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col items-center gap-0.5">
                          <div className="badge badge-xs sm:badge-sm bg-accent text-accent-content font-bold">
                            3rd
                          </div>
                          <Link
                            to={`/user/${thirdGlobalUser?.username ?? ''}`}
                            className="font-bold hover:underline text-xs sm:text-sm flex items-center justify-center gap-1 flex-wrap max-w-full"
                          >
                            <span className="truncate max-w-[4.5rem] sm:max-w-none">
                              {thirdGlobalUser?.username}
                            </span>
                            {thirdGlobalBadge && (
                              <div
                                className={`badge badge-xs gap-1 hidden sm:inline-flex max-w-[8rem] overflow-hidden text-ellipsis whitespace-nowrap ${thirdGlobalBadge.colorClass}`}
                                style={thirdGlobalBadge.style}
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  className="h-3 w-3"
                                  viewBox="0 0 20 20"
                                  fill="currentColor"
                                >
                                  <path
                                    fillRule="evenodd"
                                    d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                                <span className="font-bold max-w-[5rem] overflow-hidden text-ellipsis whitespace-nowrap">
                                  {thirdGlobalBadge.text}
                                </span>
                              </div>
                            )}
                          </Link>
                        </div>
                        <div className="text-xs sm:text-sm text-base-content/70">
                          Lv.{thirdGlobalUser?.stats?.userLevel ?? 1}
                        </div>
                        <div className="text-sm sm:text-lg font-bold text-base-content mt-1">
                          {thirdGlobalUser
                            ? getTopDisplayValue(thirdGlobalUser)
                            : null}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

              {mode === 'medium' &&
                mediumUsers?.pages[0] &&
                mediumUsers.pages[0].length >= 3 && (
                  <div className="bg-gradient-to-r from-primary/10 to-secondary/10 p-3 sm:p-8 rounded-t-md">
                    <div className="grid grid-cols-3 gap-1.5 sm:gap-4 max-w-2xl mx-auto items-end">
                      <div className="text-center order-1">
                        <div className="relative mb-1 sm:mb-4">
                          <div className="avatar">
                            <div className="w-10 h-10 sm:w-16 sm:h-16 rounded-full ring ring-base-content/40">
                              {secondMediumUser?.avatar ? (
                                <img
                                  src={secondMediumUser.avatar}
                                  alt={`${secondMediumUser.username}'s Avatar`}
                                />
                              ) : (
                                <div className="bg-neutral-content flex items-center justify-center h-full">
                                  <span className="text-sm sm:text-xl font-bold">
                                    {secondMediumUser?.username
                                      ? secondMediumUser.username
                                          .charAt(0)
                                          .toUpperCase()
                                      : ''}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col items-center gap-0.5">
                          <div className="badge badge-xs sm:badge-sm bg-base-content text-base-100 font-bold">
                            2nd
                          </div>
                          <Link
                            to={`/user/${secondMediumUser?.username ?? ''}`}
                            className="font-bold hover:underline text-xs sm:text-sm flex items-center justify-center gap-1 flex-wrap max-w-full"
                          >
                            <span className="truncate max-w-[4.5rem] sm:max-w-none">
                              {secondMediumUser?.username}
                            </span>
                            {secondMediumBadge && (
                              <div
                                className={`badge badge-xs gap-1 hidden sm:inline-flex max-w-[8rem] overflow-hidden text-ellipsis whitespace-nowrap ${secondMediumBadge.colorClass}`}
                                style={secondMediumBadge.style}
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  className="h-3 w-3"
                                  viewBox="0 0 20 20"
                                  fill="currentColor"
                                >
                                  <path
                                    fillRule="evenodd"
                                    d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                                <span className="font-bold max-w-[5rem] overflow-hidden text-ellipsis whitespace-nowrap">
                                  {secondMediumBadge.text}
                                </span>
                              </div>
                            )}
                          </Link>
                        </div>
                        <div className="text-xs sm:text-sm text-base-content/70">
                          Lv.{secondMediumUser?.stats?.userLevel ?? 1}
                        </div>
                        <div className="text-sm sm:text-lg font-bold text-base-content mt-1">
                          {secondMediumUser
                            ? getTopDisplayValueMedium(secondMediumUser)
                            : null}
                        </div>
                      </div>

                      <div className="text-center order-2">
                        <div className="relative mb-2 sm:mb-4">
                          <div className="avatar">
                            <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-full ring ring-warning ring-offset-2">
                              {firstMediumUser?.avatar ? (
                                <img
                                  src={firstMediumUser.avatar}
                                  alt={`${firstMediumUser.username}'s Avatar`}
                                />
                              ) : (
                                <div className="bg-neutral-content flex items-center justify-center h-full">
                                  <span className="text-lg sm:text-2xl font-bold">
                                    {firstMediumUser?.username
                                      ? firstMediumUser.username
                                          .charAt(0)
                                          .toUpperCase()
                                      : ''}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="absolute -top-4 sm:-top-6 left-1/2 transform -translate-x-1/2">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              fill="currentColor"
                              stroke="none"
                              className="w-7 h-7 sm:w-9 sm:h-9 text-warning"
                            >
                              <path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z" />
                            </svg>
                          </div>
                        </div>
                        <div className="flex flex-col items-center gap-0.5">
                          <div className="badge badge-xs sm:badge-sm bg-warning text-warning-content font-bold">
                            1st
                          </div>
                          <Link
                            to={`/user/${firstMediumUser?.username ?? ''}`}
                            className="font-bold hover:underline text-xs sm:text-base flex items-center justify-center gap-1 flex-wrap max-w-full"
                          >
                            <span className="truncate max-w-[4.5rem] sm:max-w-none">
                              {firstMediumUser?.username}
                            </span>
                            {firstMediumBadge && (
                              <div
                                className={`badge badge-xs gap-1 hidden sm:inline-flex max-w-[8rem] overflow-hidden text-ellipsis whitespace-nowrap ${firstMediumBadge.colorClass}`}
                                style={firstMediumBadge.style}
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  className="h-3 w-3"
                                  viewBox="0 0 20 20"
                                  fill="currentColor"
                                >
                                  <path
                                    fillRule="evenodd"
                                    d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                                <span className="font-bold max-w-[5rem] overflow-hidden text-ellipsis whitespace-nowrap">
                                  {firstMediumBadge.text}
                                </span>
                              </div>
                            )}
                          </Link>
                        </div>
                        <div className="text-xs sm:text-sm text-base-content/70">
                          Lv.{firstMediumUser?.stats?.userLevel ?? 1}
                        </div>
                        <div className="text-base sm:text-xl font-bold text-warning mt-1">
                          {firstMediumUser
                            ? getTopDisplayValueMedium(firstMediumUser)
                            : null}
                        </div>
                      </div>

                      <div className="text-center order-3">
                        <div className="relative mb-1 sm:mb-4">
                          <div className="avatar">
                            <div className="w-10 h-10 sm:w-16 sm:h-16 rounded-full ring ring-accent/50">
                              {thirdMediumUser?.avatar ? (
                                <img
                                  src={thirdMediumUser.avatar}
                                  alt={`${thirdMediumUser?.username ?? 'User'}'s Avatar`}
                                />
                              ) : (
                                <div className="bg-neutral-content flex items-center justify-center h-full">
                                  <span className="text-sm sm:text-xl font-bold">
                                    {thirdMediumUser?.username
                                      ? thirdMediumUser.username
                                          .charAt(0)
                                          .toUpperCase()
                                      : ''}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col items-center gap-0.5">
                          <div className="badge badge-xs sm:badge-sm bg-accent text-accent-content font-bold">
                            3rd
                          </div>
                          <Link
                            to={`/user/${thirdMediumUser?.username ?? ''}`}
                            className="font-bold hover:underline text-xs sm:text-sm flex items-center justify-center gap-1 flex-wrap max-w-full"
                          >
                            <span className="truncate max-w-[4.5rem] sm:max-w-none">
                              {thirdMediumUser?.username}
                            </span>
                            {thirdMediumBadge && (
                              <div
                                className={`badge badge-xs gap-1 hidden sm:inline-flex max-w-[8rem] overflow-hidden text-ellipsis whitespace-nowrap ${thirdMediumBadge.colorClass}`}
                                style={thirdMediumBadge.style}
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  className="h-3 w-3"
                                  viewBox="0 0 20 20"
                                  fill="currentColor"
                                >
                                  <path
                                    fillRule="evenodd"
                                    d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                                <span className="font-bold max-w-[5rem] overflow-hidden text-ellipsis whitespace-nowrap">
                                  {thirdMediumBadge.text}
                                </span>
                              </div>
                            )}
                          </Link>
                        </div>
                        <div className="text-xs sm:text-sm text-base-content/70">
                          Lv.{thirdMediumUser?.stats?.userLevel ?? 1}
                        </div>
                        <div className="text-sm sm:text-lg font-bold text-base-content mt-1">
                          {thirdMediumUser
                            ? getTopDisplayValueMedium(thirdMediumUser)
                            : null}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

              <div className="overflow-x-auto">
                <table className="table w-full">
                  <thead>
                    <tr className="border-b border-base-300">
                      <th className="text-center w-10 sm:w-16">Rank</th>
                      <th>User</th>
                      <th className="text-center hidden sm:table-cell">
                        Level
                      </th>
                      <th className="text-end">
                        {mode === 'global'
                          ? displayMode === 'chars'
                            ? 'Characters'
                            : `${getFilterLabel()} ${displayMode === 'hours' ? '(Hours)' : '(XP)'}`
                          : mediumMetricOptions[mediumType].find(
                              (o) => o.value === mediumMetric
                            )?.label}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {(mode === 'global'
                      ? rankedUsers?.pages
                      : mediumUsers?.pages
                    )?.map((group, groupIndex) =>
                      (
                        group as unknown as Array<{
                          username: string;
                          avatar?: string;
                          stats?: Partial<import('../types').IStats>;
                          xp?: number;
                          hours?: number;
                          episodes?: number;
                          pages?: number;
                          chars?: number;
                          patreon?: {
                            isActive: boolean;
                            tier: 'donator' | 'enthusiast' | 'consumer' | null;
                            customBadgeText?: string;
                            badgeColor?: string;
                            badgeTextColor?: string;
                          };
                        }>
                      ).map((user, index) => {
                        const rank = groupIndex * limit + index + 1;
                        const displayValue =
                          mode === 'global'
                            ? displayMode === 'chars'
                              ? user.stats?.userChars || 0
                              : getDisplayValue(user)
                            : mediumMetric === 'time'
                              ? user.hours || 0
                              : mediumMetric === 'episodes'
                                ? user.episodes || 0
                                : mediumMetric === 'pages'
                                  ? user.pages || 0
                                  : mediumMetric === 'chars'
                                    ? user.chars || 0
                                    : user.xp || 0;
                        const patreonBadge = getPatreonBadgeProps(user.patreon);

                        // Skip top 3 in the table if they're already shown in podium
                        if (
                          (mode === 'global' &&
                            rank <= 3 &&
                            rankedUsers!.pages[0].length >= 3) ||
                          (mode === 'medium' &&
                            rank <= 3 &&
                            mediumUsers!.pages[0].length >= 3)
                        )
                          return null;

                        return (
                          <tr key={`${user.username}-${rank}`}>
                            <td className="text-center">
                              <div
                                className={`flex items-center justify-center gap-1 sm:gap-2 ${getRankColor(rank)}`}
                              >
                                <span className="font-bold text-sm sm:text-lg">
                                  {rank}
                                </span>
                              </div>
                            </td>
                            <td>
                              <div className="flex items-center gap-2 sm:gap-3">
                                <div className="avatar">
                                  <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-full ring ring-base-content/10">
                                    {user.avatar ? (
                                      <img
                                        src={user.avatar}
                                        alt={`${user.username}'s Avatar`}
                                      />
                                    ) : (
                                      <div className="bg-neutral-content flex items-center justify-center h-full">
                                        <span className="text-xs sm:text-lg font-bold">
                                          {user.username
                                            .charAt(0)
                                            .toUpperCase()}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <div className="min-w-0">
                                  <Link
                                    to={`/user/${user.username}`}
                                    className="font-bold hover:text-primary transition-colors flex items-center gap-2 flex-nowrap max-w-full"
                                    title={`View ${user.username}'s profile`}
                                  >
                                    {/* Username: full on md+, truncated on small screens */}
                                    <span className="hidden md:inline">
                                      {user.username}
                                    </span>
                                    <span className="inline md:hidden truncate max-w-[6rem] sm:max-w-[8rem]">
                                      {user.username}
                                    </span>
                                    {/* Patreon Badge */}
                                    {patreonBadge && (
                                      <div
                                        className={`badge badge-sm gap-1 hidden sm:inline-flex ${patreonBadge.colorClass} md:max-w-none md:overflow-visible md:whitespace-normal max-w-[8rem] overflow-hidden text-ellipsis whitespace-nowrap`}
                                        style={patreonBadge.style}
                                      >
                                        <svg
                                          xmlns="http://www.w3.org/2000/svg"
                                          className="h-3 w-3"
                                          viewBox="0 0 20 20"
                                          fill="currentColor"
                                        >
                                          <path
                                            fillRule="evenodd"
                                            d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"
                                            clipRule="evenodd"
                                          />
                                        </svg>
                                        <span className="font-bold md:max-w-none md:overflow-visible md:whitespace-normal max-w-[5.5rem] overflow-hidden text-ellipsis whitespace-nowrap">
                                          {patreonBadge.text}
                                        </span>
                                      </div>
                                    )}
                                  </Link>
                                </div>
                              </div>
                            </td>
                            <td className="text-center hidden sm:table-cell">
                              <div className="badge badge-outline">
                                Lv.{user.stats?.userLevel ?? 1}
                              </div>
                            </td>
                            <td className="text-end">
                              <div className="font-bold text-sm sm:text-lg">
                                {numberWithCommas(displayValue as number)}
                              </div>
                              <div className="text-xs text-base-content/60">
                                {mode === 'global'
                                  ? displayMode === 'hours'
                                    ? 'hrs'
                                    : displayMode === 'chars'
                                      ? 'chars'
                                      : 'XP'
                                  : mediumMetric === 'time'
                                    ? 'hrs'
                                    : mediumMetric === 'episodes'
                                      ? 'ep'
                                      : mediumMetric}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {(mode === 'global' ? hasNextPage : hasNextPageMedium) && (
                <div className="p-6 text-center border-t border-base-300">
                  <button
                    className="btn btn-primary btn-wide"
                    onClick={() =>
                      mode === 'global'
                        ? fetchNextPage()
                        : fetchNextPageMedium()
                    }
                    disabled={
                      !(mode === 'global' ? hasNextPage : hasNextPageMedium) ||
                      (mode === 'global'
                        ? isFetchingNextPage
                        : isFetchingNextPageMedium)
                    }
                  >
                    {(
                      mode === 'global'
                        ? isFetchingNextPage
                        : isFetchingNextPageMedium
                    ) ? (
                      <>
                        <span className="loading loading-spinner loading-sm"></span>
                        Loading more...
                      </>
                    ) : (
                      'Load More Rankings'
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default RankingScreen;

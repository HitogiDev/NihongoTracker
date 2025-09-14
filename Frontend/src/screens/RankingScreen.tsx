import { useInfiniteQuery } from '@tanstack/react-query';
import {
  PiCrownSimpleFill,
  PiTrophyFill,
  PiBookOpenFill,
  PiHeadphonesFill,
  PiLightningFill,
  PiCalendarFill,
  PiChartBarFill,
  PiCalendarBlankFill,
} from 'react-icons/pi';
import { getRankingFn, getMediumRankingFn } from '../api/trackerApi';
import { useEffect, useRef, useState } from 'react';
import { filterTypes } from '../types';
import { Link } from 'react-router-dom';
import { useTimezone } from '../hooks/useTimezone';
import { numberWithCommas } from '../utils/utils';
import { DayPicker } from 'react-day-picker';

function RankingScreen() {
  const [limit] = useState(10);
  const [xpFilter, setXpFilter] = useState<filterTypes>('userXp');
  const [timeFilter, setTimeFilter] = useState<string>('all-time');
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
      icon: <PiLightningFill className="w-4 h-4" />,
    },
    {
      label: 'Reading',
      value: 'readingXp',
      icon: <PiBookOpenFill className="w-4 h-4" />,
    },
    {
      label: 'Listening',
      value: 'listeningXp',
      icon: <PiHeadphonesFill className="w-4 h-4" />,
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
      icon: <PiTrophyFill className="w-4 h-4" />,
    },
    {
      label: 'Today',
      value: 'today',
      icon: <PiCalendarFill className="w-4 h-4" />,
    },
    {
      label: 'This Week',
      value: 'week',
      icon: <PiCalendarFill className="w-4 h-4" />,
    },
    {
      label: 'This Month',
      value: 'month',
      icon: <PiChartBarFill className="w-4 h-4" />,
    },
    {
      label: 'This Year',
      value: 'year',
      icon: <PiCalendarBlankFill className="w-4 h-4" />,
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

  // (units displayed inline per mode)

  // Get the correct label for the selected filter
  const getFilterLabel = () => {
    const option = scopeOptions.find((option) => option.value === xpFilter);
    const metric = metricOptions.find((m) => m.value === displayMode)?.label;
    return `${option?.label || 'Total'} · ${metric}`;
  };

  const getFilterIcon = () => {
    const option = scopeOptions.find((option) => option.value === xpFilter);
    return option?.icon || <PiLightningFill className="w-4 h-4" />;
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
    return option?.icon || <PiTrophyFill className="w-4 h-4" />;
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <span className="text-warning text-xl">🥇</span>;
      case 2:
        return <span className="text-base-content text-xl">🥈</span>;
      case 3:
        return <span className="text-accent text-xl">🥉</span>;
      default:
        return null;
    }
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
            <PiTrophyFill className="w-10 h-10 text-warning" />
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
                  <div className="bg-gradient-to-r from-primary/10 to-secondary/10 p-8 rounded-t-md">
                    <div className="grid grid-cols-3 gap-4 max-w-2xl mx-auto">
                      <div className="text-center order-1">
                        <div className="relative mb-4">
                          <div className="avatar">
                            <div className="w-16 h-16 rounded-full ring ring-base-content/40">
                              {rankedUsers.pages[0][1]?.avatar ? (
                                <img
                                  src={rankedUsers.pages[0][1].avatar}
                                  alt={`${rankedUsers.pages[0][1].username}'s Avatar`}
                                />
                              ) : (
                                <div className="bg-neutral-content flex items-center justify-center h-full">
                                  <span className="text-xl font-bold">
                                    {rankedUsers.pages[0][1]?.username
                                      .charAt(0)
                                      .toUpperCase()}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex justify-center mb-1">
                          <div className="relative">
                            <div className="absolute right-full top-1/2 transform -translate-y-1/2 mr-1">
                              <div className="badge badge-sm bg-base-content text-base-100 font-bold">
                                2nd
                              </div>
                            </div>
                            <Link
                              to={`/user/${rankedUsers.pages[0][1]?.username}`}
                              className="font-bold hover:underline"
                            >
                              {rankedUsers.pages[0][1]?.username}
                            </Link>
                          </div>
                        </div>
                        <div className="text-sm text-base-content/70">
                          Lv.{rankedUsers.pages[0][1]?.stats?.userLevel ?? 1}
                        </div>
                        <div className="text-lg font-bold text-base-content mt-1">
                          {getTopDisplayValue(rankedUsers.pages[0][1])}
                        </div>
                      </div>

                      <div className="text-center order-2">
                        <div className="relative mb-4">
                          <div className="avatar">
                            <div className="w-20 h-20 rounded-full ring ring-warning ring-offset-2">
                              {rankedUsers.pages[0][0]?.avatar ? (
                                <img
                                  src={rankedUsers.pages[0][0].avatar}
                                  alt={`${rankedUsers.pages[0][0].username}'s Avatar`}
                                />
                              ) : (
                                <div className="bg-neutral-content flex items-center justify-center h-full">
                                  <span className="text-2xl font-bold">
                                    {rankedUsers.pages[0][0]?.username
                                      .charAt(0)
                                      .toUpperCase()}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="absolute -top-6 left-1/2 transform -translate-x-1/2">
                            <PiCrownSimpleFill className="text-4xl text-warning" />
                          </div>
                        </div>
                        <div className="flex justify-center mb-1">
                          <div className="relative">
                            <div className="absolute right-full top-1/2 transform -translate-y-1/2 mr-1">
                              <div className="badge badge-sm bg-warning text-warning-content font-bold">
                                1st
                              </div>
                            </div>
                            <Link
                              to={`/user/${rankedUsers.pages[0][0]?.username}`}
                              className="font-bold hover:underline text-lg"
                            >
                              {rankedUsers.pages[0][0]?.username}
                            </Link>
                          </div>
                        </div>
                        <div className="text-sm text-base-content/70">
                          Lv.{rankedUsers.pages[0][0]?.stats?.userLevel ?? 1}
                        </div>
                        <div className="text-xl font-bold text-warning mt-1">
                          {getTopDisplayValue(rankedUsers.pages[0][0])}
                        </div>
                      </div>

                      <div className="text-center order-3">
                        <div className="relative mb-4">
                          <div className="avatar">
                            <div className="w-16 h-16 rounded-full ring ring-accent/50">
                              {rankedUsers.pages[0][2]?.avatar ? (
                                <img
                                  src={rankedUsers.pages[0][2].avatar}
                                  alt={`${rankedUsers.pages[0][2].username}'s Avatar`}
                                />
                              ) : (
                                <div className="bg-neutral-content flex items-center justify-center h-full">
                                  <span className="text-xl font-bold">
                                    {rankedUsers.pages[0][2]?.username
                                      .charAt(0)
                                      .toUpperCase()}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex justify-center mb-1">
                          <div className="relative">
                            <div className="absolute right-full top-1/2 transform -translate-y-1/2 mr-1">
                              <div className="badge badge-sm bg-accent text-accent-content font-bold">
                                3rd
                              </div>
                            </div>
                            <Link
                              to={`/user/${rankedUsers.pages[0][2]?.username}`}
                              className="font-bold hover:underline"
                            >
                              {rankedUsers.pages[0][2]?.username}
                            </Link>
                          </div>
                        </div>
                        <div className="text-sm text-base-content/70">
                          Lv.{rankedUsers.pages[0][2]?.stats?.userLevel ?? 1}
                        </div>
                        <div className="text-lg font-bold text-base-content mt-1">
                          {getTopDisplayValue(rankedUsers.pages[0][2])}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

              {mode === 'medium' &&
                mediumUsers?.pages[0] &&
                mediumUsers.pages[0].length >= 3 && (
                  <div className="bg-gradient-to-r from-primary/10 to-secondary/10 p-8 rounded-t-md">
                    <div className="grid grid-cols-3 gap-4 max-w-2xl mx-auto">
                      <div className="text-center order-1">
                        <div className="relative mb-4">
                          <div className="avatar">
                            <div className="w-16 h-16 rounded-full ring ring-base-content/40">
                              {mediumUsers.pages[0][1]?.avatar ? (
                                <img
                                  src={mediumUsers.pages[0][1].avatar}
                                  alt={`${mediumUsers.pages[0][1].username}'s Avatar`}
                                />
                              ) : (
                                <div className="bg-neutral-content flex items-center justify-center h-full">
                                  <span className="text-xl font-bold">
                                    {mediumUsers.pages[0][1]?.username
                                      .charAt(0)
                                      .toUpperCase()}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex justify-center mb-1">
                          <div className="relative">
                            <div className="absolute right-full top-1/2 transform -translate-y-1/2 mr-1">
                              <div className="badge badge-sm bg-base-content text-base-100 font-bold">
                                2nd
                              </div>
                            </div>
                            <Link
                              to={`/user/${mediumUsers.pages[0][1]?.username}`}
                              className="font-bold hover:underline"
                            >
                              {mediumUsers.pages[0][1]?.username}
                            </Link>
                          </div>
                        </div>
                        <div className="text-sm text-base-content/70">
                          Lv.{mediumUsers.pages[0][1]?.stats?.userLevel ?? 1}
                        </div>
                        <div className="text-lg font-bold text-base-content mt-1">
                          {getTopDisplayValueMedium(mediumUsers.pages[0][1])}
                        </div>
                      </div>

                      <div className="text-center order-2">
                        <div className="relative mb-4">
                          <div className="avatar">
                            <div className="w-20 h-20 rounded-full ring ring-warning ring-offset-2">
                              {mediumUsers.pages[0][0]?.avatar ? (
                                <img
                                  src={mediumUsers.pages[0][0].avatar}
                                  alt={`${mediumUsers.pages[0][0].username}'s Avatar`}
                                />
                              ) : (
                                <div className="bg-neutral-content flex items-center justify-center h-full">
                                  <span className="text-2xl font-bold">
                                    {mediumUsers.pages[0][0]?.username
                                      .charAt(0)
                                      .toUpperCase()}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="absolute -top-6 left-1/2 transform -translate-x-1/2">
                            <PiCrownSimpleFill className="text-4xl text-warning" />
                          </div>
                        </div>
                        <div className="flex justify-center mb-1">
                          <div className="relative">
                            <div className="absolute right-full top-1/2 transform -translate-y-1/2 mr-1">
                              <div className="badge badge-sm bg-warning text-warning-content font-bold">
                                1st
                              </div>
                            </div>
                            <Link
                              to={`/user/${mediumUsers.pages[0][0]?.username}`}
                              className="font-bold hover:underline text-lg"
                            >
                              {mediumUsers.pages[0][0]?.username}
                            </Link>
                          </div>
                        </div>
                        <div className="text-sm text-base-content/70">
                          Lv.{mediumUsers.pages[0][0]?.stats?.userLevel ?? 1}
                        </div>
                        <div className="text-xl font-bold text-warning mt-1">
                          {getTopDisplayValueMedium(mediumUsers.pages[0][0])}
                        </div>
                      </div>

                      <div className="text-center order-3">
                        <div className="relative mb-4">
                          <div className="avatar">
                            <div className="w-16 h-16 rounded-full ring ring-accent/50">
                              {mediumUsers.pages[0][2]?.avatar ? (
                                <img
                                  src={mediumUsers.pages[0][2].avatar}
                                  alt={`${mediumUsers.pages[0][2].username}'s Avatar`}
                                />
                              ) : (
                                <div className="bg-neutral-content flex items-center justify-center h-full">
                                  <span className="text-xl font-bold">
                                    {mediumUsers.pages[0][2]?.username
                                      .charAt(0)
                                      .toUpperCase()}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex justify-center mb-1">
                          <div className="relative">
                            <div className="absolute right-full top-1/2 transform -translate-y-1/2 mr-1">
                              <div className="badge badge-sm bg-accent text-accent-content font-bold">
                                3rd
                              </div>
                            </div>
                            <Link
                              to={`/user/${mediumUsers.pages[0][2]?.username}`}
                              className="font-bold hover:underline"
                            >
                              {mediumUsers.pages[0][2]?.username}
                            </Link>
                          </div>
                        </div>
                        <div className="text-sm text-base-content/70">
                          Lv.{mediumUsers.pages[0][2]?.stats?.userLevel ?? 1}
                        </div>
                        <div className="text-lg font-bold text-base-content mt-1">
                          {getTopDisplayValueMedium(mediumUsers.pages[0][2])}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

              <div className="overflow-x-auto">
                <table className="table w-full">
                  <thead>
                    <tr className="border-b border-base-300">
                      <th className="text-center w-16">Rank</th>
                      <th>User</th>
                      <th className="text-center">Level</th>
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
                                className={`flex items-center justify-center gap-2 ${getRankColor(rank)}`}
                              >
                                {getRankIcon(rank)}
                                <span className="font-bold text-lg">
                                  {rank}
                                </span>
                              </div>
                            </td>
                            <td>
                              <div className="flex items-center gap-3">
                                <div className="avatar">
                                  <div className="w-12 h-12 rounded-full ring ring-base-content/10">
                                    {user.avatar ? (
                                      <img
                                        src={user.avatar}
                                        alt={`${user.username}'s Avatar`}
                                      />
                                    ) : (
                                      <div className="bg-neutral-content flex items-center justify-center h-full">
                                        <span className="text-lg font-bold">
                                          {user.username
                                            .charAt(0)
                                            .toUpperCase()}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <div>
                                  <Link
                                    to={`/user/${user.username}`}
                                    className="font-bold hover:text-primary transition-colors"
                                    title={`View ${user.username}'s profile`}
                                  >
                                    {user.username}
                                  </Link>
                                </div>
                              </div>
                            </td>
                            <td className="text-center">
                              <div className="badge badge-outline">
                                Lv.{user.stats?.userLevel ?? 1}
                              </div>
                            </td>
                            <td className="text-end">
                              <div className="font-bold text-lg">
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

import { Link, useOutletContext } from 'react-router-dom';
import LogCard from '../components/LogCard';
import ProgressBar from '../components/ProgressBar';
import ImmersionGoals from '../components/ImmersionGoals';
import ImmersionHeatmap from '../components/ImmersionHeatmap';
import React, { useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { getUserLogsFn } from '../api/trackerApi';
import { OutletProfileContextType } from '../types';
import { useUserDataStore } from '../store/userData';
import { DayPicker } from 'react-day-picker';
import { useDateFormatting } from '../hooks/useDateFormatting';
import DOMPurify from 'dompurify';
import { marked } from 'marked';

marked.setOptions({
  gfm: true,
  breaks: true,
});
import {
  Search,
  Funnel,
  Clock,
  ChevronDown,
  ListFilter,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';

function ProfileScreen() {
  const limit = 10;
  const { user, username } = useOutletContext<OutletProfileContextType>();
  const { user: loggedUser } = useUserDataStore();
  const { getCurrentTime, getDayBounds, formatDateOnly } = useDateFormatting();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<
    | 'all'
    | 'anime'
    | 'manga'
    | 'reading'
    | 'vn'
    | 'video'
    | 'movie'
    | 'audio'
    | 'other'
  >('all');
  const [dateFilter, setDateFilter] = useState<
    'all' | 'today' | 'week' | 'month' | 'year' | 'custom'
  >('all');
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>(
    undefined
  );
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>(
    undefined
  );
  const [sortBy, setSortBy] = useState<
    'date' | 'xp' | 'episodes' | 'chars' | 'pages' | 'time'
  >('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const aboutHtml = () => {
    if (!user?.about || !user.about.trim()) {
      return '';
    }
    const rawHtml = marked.parse(user.about, { async: false }) as string;
    return DOMPurify.sanitize(rawHtml);
  };

  // Type guard to validate log type
  const isValidLogType = (
    value: string
  ): value is
    | 'anime'
    | 'manga'
    | 'reading'
    | 'vn'
    | 'video'
    | 'movie'
    | 'audio'
    | 'other' => {
    return [
      'anime',
      'manga',
      'reading',
      'vn',
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
      sortBy,
      sortDirection,
    ],
    queryFn: ({ pageParam }) =>
      getUserLogsFn(username as string, {
        limit,
        page: pageParam as number,
        search: searchTerm,
        type: filterType !== 'all' ? filterType : undefined,
        start: dateRange?.startDate?.toISOString(),
        end: dateRange?.endDate?.toISOString(),
        sortBy: sortBy,
        sortDirection: sortDirection,
      }),
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage || lastPage.length < limit) return undefined;
      return allPages ? allPages.length + 1 : 2;
    },
    initialPageParam: 1,
    staleTime: Infinity,
    enabled: !!username,
  });

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
                  <div
                    className="prose prose-sm max-w-none text-base-content/90"
                    dangerouslySetInnerHTML={{ __html: aboutHtml }}
                  />
                ) : (
                  <p className="text-base-content/70 text-sm">
                    {username === loggedUser?.username
                      ? 'Add a short introduction from Settings → Profile Information.'
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
          </div>

          <div className="flex flex-col gap-4 md:gap-5">
            <div className="flex flex-col gap-3">
              <h2 className="card-title self-start">Activity Logs</h2>

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
                    {/* Type Filter Dropdown */}
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
                      </ul>
                    </div>

                    {/* Combined Sort Filter Dropdown */}
                    <div className="dropdown dropdown-end flex-1 sm:flex-none">
                      <div
                        tabIndex={0}
                        role="button"
                        className="btn btn-outline gap-2 w-full sm:w-auto justify-start"
                      >
                        <ListFilter className="w-4 h-4" />
                        Sort:{' '}
                        {sortBy === 'date'
                          ? 'Date'
                          : sortBy === 'xp'
                            ? 'XP'
                            : sortBy === 'episodes'
                              ? 'Episodes'
                              : sortBy === 'chars'
                                ? 'Characters'
                                : sortBy === 'pages'
                                  ? 'Pages'
                                  : 'Time'}{' '}
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
                        {[
                          { value: 'date', label: 'Date' },
                          { value: 'xp', label: 'XP' },
                          { value: 'episodes', label: 'Episodes' },
                          { value: 'chars', label: 'Characters' },
                          { value: 'pages', label: 'Pages' },
                          { value: 'time', label: 'Time' },
                        ].map((option) => (
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
                        className="dropdown-content z-[1000] card card-compact w-64 p-2 shadow-xl bg-base-100 border border-base-300"
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
                          className="dropdown-content z-[1000] card card-compact w-64 p-2 shadow-xl bg-base-100 border border-base-300"
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
                  filterType !== 'all' ||
                  searchTerm) && (
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
                          ✕
                        </button>
                      </div>
                    )}

                    {filterType !== 'all' && (
                      <div className="badge badge-secondary badge-sm gap-1">
                        Type: {filterType}
                        <button
                          className="ml-1 hover:bg-secondary-focus rounded-full"
                          onClick={() => setFilterType('all')}
                          aria-label="Clear type filter"
                        >
                          ✕
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
                          ✕
                        </button>
                      </div>
                    )}

                    {sortBy !== 'date' && (
                      <div className="badge badge-info badge-sm gap-1">
                        Sort:{' '}
                        {sortBy === 'xp'
                          ? 'XP'
                          : sortBy === 'episodes'
                            ? 'Episodes'
                            : sortBy === 'chars'
                              ? 'Characters'
                              : sortBy === 'pages'
                                ? 'Pages'
                                : 'Time'}
                        <button
                          className="ml-1 hover:bg-info-focus rounded-full"
                          onClick={() => setSortBy('date')}
                          aria-label="Clear sort filter"
                        >
                          ✕
                        </button>
                      </div>
                    )}

                    <button
                      className="btn btn-ghost btn-xs text-base-content/60 hover:text-base-content"
                      onClick={() => {
                        setSearchTerm('');
                        setFilterType('all');
                        setDateFilter('all');
                        setCustomStartDate(undefined);
                        setCustomEndDate(undefined);
                        setSortBy('date');
                        setSortDirection('desc');
                      }}
                    >
                      Clear all
                    </button>
                  </div>
                )}
              </div>
            </div>

            {logs?.pages ? (
              logs.pages.map((page, index) => (
                <React.Fragment key={index}>
                  {Array.isArray(page)
                    ? page.map((log) => (
                        <LogCard key={log._id} log={log} user={username} />
                      ))
                    : null}
                </React.Fragment>
              ))
            ) : (
              <div className="card w-full bg-base-100 shadow-sm p-4">
                <p className="text-center">No logs available</p>
              </div>
            )}

            {logs?.pages &&
            logs.pages.every(
              (page) => Array.isArray(page) && page.length === 0
            ) ? (
              <div className="card w-full bg-base-100 shadow-sm p-4">
                <div className="alert alert-info">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    className="stroke-current shrink-0 w-6 h-6"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    ></path>
                  </svg>
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
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProfileScreen;

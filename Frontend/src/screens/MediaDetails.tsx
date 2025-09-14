import { useOutletContext } from 'react-router-dom';
import { OutletMediaContextType, ILog } from '../types';
import ProgressChart from '../components/ProgressChart';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getUserLogsFn,
  compareUserStatsFn,
  IComparisonStats,
} from '../api/trackerApi';
import { numberWithCommas } from '../utils/utils';
import LogCard from '../components/LogCard';
import { useState, useMemo } from 'react';
import { useUserDataStore } from '../store/userData';

const difficultyLevels = [
  ['Beginner', '#4caf50'],
  ['Easy', '#8bc34a'],
  ['Moderate', '#d3b431'],
  ['Hard', '#ff9800'],
  ['Very Hard', '#f44336'],
  ['Expert', '#e91e63'],
];

function MediaDetails() {
  const { mediaDocument, mediaType, username } =
    useOutletContext<OutletMediaContextType>();
  const { user: currentUser } = useUserDataStore();
  const queryClient = useQueryClient();

  const [visibleLogsCount, setVisibleLogsCount] = useState(10);

  // Try to get logs from existing cache first (from ProfileScreen)
  const existingLogsData = queryClient.getQueryData([
    'logs',
    username,
    '', // empty search
    'all', // all types
  ]);

  // Extract logs for this specific media from cached data
  const cachedMediaLogs = useMemo(() => {
    if (!existingLogsData || !mediaDocument?.contentId) return null;

    // Handle both infinite query pages and regular arrays
    const allPages = Array.isArray(existingLogsData)
      ? [existingLogsData]
      : (existingLogsData as { pages?: ILog[][] })?.pages || [];

    const allLogs = allPages.flat().filter((log: ILog) => {
      return (
        log?.mediaId === mediaDocument.contentId &&
        log?.type === mediaDocument.type
      );
    });

    return allLogs.length > 0 ? allLogs : null;
  }, [existingLogsData, mediaDocument?.contentId, mediaDocument?.type]);

  // Only fetch from server if we don't have the data in cache
  const { data: logs, isLoading: logsLoading } = useQuery({
    queryKey: [
      username,
      'logs',
      'media',
      mediaDocument?.contentId,
      mediaDocument?.type,
    ],
    queryFn: () => {
      if (!username || !mediaDocument?.contentId || !mediaDocument?.type) {
        throw new Error('Username, media ID and type are required');
      }
      return getUserLogsFn(username, {
        mediaId: mediaDocument.contentId,
        type: mediaDocument.type,
        limit: 0,
        page: 1,
      });
    },
    enabled:
      !!username &&
      !!mediaDocument?.contentId &&
      !!mediaDocument?.type &&
      !cachedMediaLogs,
    staleTime: 10 * 60 * 1000, // 10 minutes cache
    gcTime: 15 * 60 * 1000, // 15 minutes garbage collection
  });

  // Use cached data if available, otherwise use fetched data
  const finalLogs = cachedMediaLogs || logs;

  // Get current user's logs for comparison (only if viewing another user's profile)
  const isViewingOtherUser = currentUser?.username !== username;

  // Try to get current user's logs from cache
  const currentUserCachedData = isViewingOtherUser
    ? queryClient.getQueryData([
        'logs',
        currentUser?.username,
        '', // empty search
        'all', // all types
      ])
    : null;

  const cachedCurrentUserLogs = useMemo(() => {
    if (
      !currentUserCachedData ||
      !mediaDocument?.contentId ||
      !isViewingOtherUser
    )
      return null;

    const allPages = Array.isArray(currentUserCachedData)
      ? [currentUserCachedData]
      : (currentUserCachedData as { pages?: ILog[][] })?.pages || [];

    const allLogs = allPages.flat().filter((log: ILog) => {
      return (
        log?.mediaId === mediaDocument.contentId &&
        log?.type === mediaDocument.type
      );
    });

    return allLogs.length > 0 ? allLogs : null;
  }, [
    currentUserCachedData,
    mediaDocument?.contentId,
    mediaDocument?.type,
    isViewingOtherUser,
  ]);

  const { data: myLogs, isLoading: myLogsLoading } = useQuery({
    queryKey: [
      currentUser?.username,
      'logs',
      'media',
      mediaDocument?.contentId,
      mediaDocument?.type,
    ],
    queryFn: () => {
      if (
        !currentUser?.username ||
        !mediaDocument?.contentId ||
        !mediaDocument?.type
      ) {
        throw new Error('Username, media ID and type are required');
      }
      return getUserLogsFn(currentUser.username, {
        mediaId: mediaDocument.contentId,
        type: mediaDocument.type,
        limit: 0,
        page: 1,
      });
    },
    enabled:
      isViewingOtherUser &&
      !!currentUser?.username &&
      !!mediaDocument?.contentId &&
      !!mediaDocument?.type &&
      !cachedCurrentUserLogs,
    staleTime: 10 * 60 * 1000, // 10 minutes cache
    gcTime: 15 * 60 * 1000, // 15 minutes garbage collection
  });

  // Use cached data if available, otherwise use fetched data
  const finalMyLogs = cachedCurrentUserLogs || myLogs;

  // Use efficient comparison endpoint when viewing another user
  const { data: comparisonData, isLoading: comparisonLoading } = useQuery({
    queryKey: [
      'comparison',
      currentUser?.username,
      username,
      mediaDocument?.contentId,
      mediaDocument?.type,
    ],
    queryFn: () => {
      if (
        !currentUser?.username ||
        !username ||
        !mediaDocument?.contentId ||
        !mediaDocument?.type
      ) {
        throw new Error('Required data for comparison is missing');
      }
      return compareUserStatsFn(
        currentUser.username,
        username,
        mediaDocument.contentId,
        mediaDocument.type
      );
    },
    enabled:
      isViewingOtherUser &&
      !!currentUser?.username &&
      !!username &&
      !!mediaDocument?.contentId &&
      !!mediaDocument?.type,
    staleTime: 10 * 60 * 1000, // 10 minutes cache
    gcTime: 15 * 60 * 1000, // 15 minutes garbage collection
  });

  // Memoize arrays to prevent recalculation
  const logsArray = useMemo(
    () => (Array.isArray(finalLogs) ? (finalLogs as ILog[]) : []),
    [finalLogs]
  );
  const myLogsArray = useMemo(
    () => (Array.isArray(finalMyLogs) ? (finalMyLogs as ILog[]) : []),
    [finalMyLogs]
  );
  const isLoading =
    logsLoading || (isViewingOtherUser && (myLogsLoading || comparisonLoading));

  // Memoize heavy calculations to prevent re-computation on every render
  const calculations = useMemo(() => {
    // Sort logs by date (most recent first) - moved up to be used in calculations
    const sortedLogs =
      logsArray.length > 0
        ? [...logsArray].sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
          )
        : [];

    const totalXp = logsArray.reduce((acc, log) => acc + log.xp, 0);
    const totalTime = logsArray.reduce((acc, log) => acc + (log.time ?? 0), 0);

    // Calculate reading statistics
    const totalCharsRead = logsArray.reduce(
      (acc, log) => acc + (log.chars ?? 0),
      0
    );
    const totalCharCount = mediaDocument?.jiten?.mainDeck.characterCount || 0;
    const readingPercentage =
      totalCharCount > 0
        ? Math.min((totalCharsRead / totalCharCount) * 100, 100)
        : 0;

    // Calculate reading speed (chars per hour) and estimated time to finish
    const readingSpeed =
      totalTime && totalTime > 0 ? (totalCharsRead / totalTime) * 60 : 0; // chars per hour

    // Calculate recent reading speed from last 10 logs
    const recentLogs = sortedLogs.slice(0, 10);
    const recentCharsRead = recentLogs.reduce(
      (acc, log) => acc + (log.chars ?? 0),
      0
    );
    const recentTime = recentLogs.reduce(
      (acc, log) => acc + (log.time ?? 0),
      0
    );
    const recentReadingSpeed =
      recentTime && recentTime > 0 ? (recentCharsRead / recentTime) * 60 : 0; // chars per hour

    const remainingChars = Math.max(totalCharCount - totalCharsRead, 0);
    const recentEstimatedTimeToFinish =
      recentReadingSpeed > 0 ? remainingChars / recentReadingSpeed : 0; // in hours

    // Calculate my stats for comparison
    const myTotalXp = myLogsArray.reduce((acc, log) => acc + log.xp, 0);
    const myTotalTime = myLogsArray.reduce(
      (acc, log) => acc + (log.time ?? 0),
      0
    );
    const myTotalCharsRead = myLogsArray.reduce(
      (acc, log) => acc + (log.chars ?? 0),
      0
    );
    const myReadingPercentage =
      totalCharCount > 0
        ? Math.min((myTotalCharsRead / totalCharCount) * 100, 100)
        : 0;
    const myReadingSpeed =
      myTotalTime && myTotalTime > 0
        ? (myTotalCharsRead / myTotalTime) * 60
        : 0;

    return {
      sortedLogs,
      totalXp,
      totalTime,
      totalCharsRead,
      totalCharCount,
      readingPercentage,
      readingSpeed,
      recentLogs,
      recentReadingSpeed,
      recentEstimatedTimeToFinish,
      myTotalXp,
      myTotalTime,
      myTotalCharsRead,
      myReadingPercentage,
      myReadingSpeed,
    };
  }, [logsArray, myLogsArray, mediaDocument?.jiten?.mainDeck.characterCount]);

  // Destructure calculations for easier access
  const {
    sortedLogs,
    totalXp,
    totalTime,
    totalCharsRead,
    totalCharCount,
    readingPercentage,
    readingSpeed,
    recentLogs,
    recentReadingSpeed,
    recentEstimatedTimeToFinish,
    myTotalXp,
    myTotalTime,
    myTotalCharsRead,
    myReadingPercentage,
    myReadingSpeed,
  } = calculations;

  // Get difficulty info
  const difficultyLevel = mediaDocument?.jiten?.mainDeck.difficulty;
  const difficultyInfo =
    difficultyLevel !== undefined &&
    difficultyLevel >= 0 &&
    difficultyLevel < difficultyLevels.length
      ? difficultyLevels[Math.floor(difficultyLevel)]
      : null;

  const visibleLogs = sortedLogs.slice(0, visibleLogsCount);
  const hasMoreLogs = sortedLogs.length > visibleLogsCount;

  const handleShowMore = () => {
    setVisibleLogsCount((prev) => Math.min(prev + 10, sortedLogs.length));
  };

  // Show loading state while data is being fetched
  if (isLoading) {
    return (
      <div className="min-h-screen">
        <div className="container mx-auto px-4 py-8 max-w-7xl">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-6">
            {/* Left column skeleton - Media Details Card */}
            <div className="space-y-6 min-w-0">
              <div className="card bg-base-100 shadow-lg">
                <div className="card-body">
                  <div className="skeleton h-6 w-32 mb-4"></div>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="skeleton h-4 w-16"></div>
                      <div className="skeleton h-6 w-20 rounded-full"></div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="skeleton h-4 w-20"></div>
                      <div className="skeleton h-6 w-24 rounded-full"></div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="skeleton h-4 w-16"></div>
                      <div className="skeleton h-4 w-20"></div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="skeleton h-4 w-18"></div>
                      <div className="skeleton h-4 w-16"></div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="skeleton h-4 w-20"></div>
                      <div className="skeleton h-4 w-24"></div>
                    </div>
                    <div className="divider my-4"></div>
                    <div className="skeleton h-4 w-28 mb-3"></div>
                    <div className="flex flex-wrap gap-2">
                      <div className="skeleton h-8 w-16 rounded-lg"></div>
                      <div className="skeleton h-8 w-20 rounded-lg"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right column skeleton - Progress Chart and Activity Logs */}
            <div className="space-y-6 min-w-0">
              {/* Progress Chart skeleton */}
              <div className="card bg-base-100 shadow-lg">
                <div className="card-body">
                  <div className="skeleton h-6 w-40 mb-4"></div>
                  <div className="skeleton h-64 w-full rounded-lg"></div>
                </div>
              </div>

              {/* Activity Logs skeleton */}
              <div className="card bg-base-100 shadow-lg">
                <div className="card-body">
                  <div className="flex justify-between items-center mb-6">
                    <div className="skeleton h-6 w-32"></div>
                    <div className="skeleton h-8 w-24 rounded-lg"></div>
                  </div>
                  <div className="space-y-4">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="card bg-base-200 shadow-sm">
                        <div className="card-body p-4">
                          <div className="flex justify-between items-start mb-3">
                            <div className="skeleton h-5 w-48"></div>
                            <div className="skeleton h-4 w-16"></div>
                          </div>
                          <div className="flex flex-wrap gap-2 mb-3">
                            <div className="skeleton h-6 w-16 rounded-full"></div>
                            <div className="skeleton h-6 w-20 rounded-full"></div>
                          </div>
                          <div className="space-y-2">
                            <div className="skeleton h-4 w-full"></div>
                            <div className="skeleton h-4 w-3/4"></div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Comparison Card Component
  const ComparisonCard = () => {
    if (!isViewingOtherUser) return null;

    // Use efficient comparison data if available, otherwise use calculated data
    const useEfficient =
      comparisonData && comparisonData.user1 && comparisonData.user2;

    // If we don't have comparison data and don't have my logs, don't show
    if (!useEfficient && myLogsArray.length === 0) return null;

    // Get stats from either efficient endpoint or calculated
    const myStats: IComparisonStats = useEfficient
      ? comparisonData.user1.stats
      : {
          totalXp: myTotalXp,
          totalTime: myTotalTime,
          totalChars: myTotalCharsRead,
          readingSpeed: myReadingSpeed,
          totalPages: myLogsArray.reduce(
            (acc, log) => acc + (log.pages ?? 0),
            0
          ),
          totalEpisodes: myLogsArray.reduce(
            (acc, log) => acc + (log.episodes ?? 0),
            0
          ),
          logCount: myLogsArray.length,
          readingPercentage: myReadingPercentage,
        };

    const theirStats: IComparisonStats = useEfficient
      ? comparisonData.user2.stats
      : {
          totalXp,
          totalTime,
          totalChars: totalCharsRead,
          readingSpeed,
          totalPages: logsArray.reduce((acc, log) => acc + (log.pages ?? 0), 0),
          totalEpisodes: logsArray.reduce(
            (acc, log) => acc + (log.episodes ?? 0),
            0
          ),
          logCount: logsArray.length,
          readingPercentage,
        };

    const ComparisonStat = ({
      label,
      myValue,
      theirValue,
      unit = '',
      formatter = (val: number) => numberWithCommas(val),
    }: {
      label: string;
      myValue: number;
      theirValue: number;
      unit?: string;
      formatter?: (val: number) => string;
    }) => {
      const difference = myValue - theirValue;
      const isHigher = difference > 0;
      const isEqual = difference === 0;

      return (
        <div className="stat bg-base-200 rounded-lg p-3">
          <div className="stat-title text-xs">{label}</div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
            <div className="stat-value text-sm sm:text-lg text-primary truncate">
              {formatter(myValue)}
              {unit}
            </div>
            <div className="text-xs hidden sm:block">vs</div>
            <div className="stat-value text-sm sm:text-lg text-base-content/60 truncate">
              {formatter(theirValue)}
              {unit}
            </div>
          </div>
          <div
            className={`stat-desc flex items-center gap-1 text-xs ${
              isEqual
                ? 'text-base-content/60'
                : isHigher
                  ? 'text-success'
                  : 'text-error'
            }`}
          >
            {!isEqual && (
              <svg
                className="w-3 h-3 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d={isHigher ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'}
                />
              </svg>
            )}
            <span className="truncate">
              {isEqual
                ? 'Same'
                : `${formatter(Math.abs(difference))}${unit} ${isHigher ? 'ahead' : 'behind'}`}
            </span>
          </div>
        </div>
      );
    };

    return (
      <div className="card bg-gradient-to-br from-primary/5 to-secondary/5 border border-primary/20 shadow-lg">
        <div className="card-body">
          <h2 className="card-title text-lg mb-4 flex items-center gap-2">
            <svg
              className="w-5 h-5 text-primary"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
            Comparison: You vs {username}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ComparisonStat
              label="Total XP"
              myValue={myStats.totalXp}
              theirValue={theirStats.totalXp}
            />

            <ComparisonStat
              label="Total Time"
              myValue={myStats.totalTime}
              theirValue={theirStats.totalTime}
              unit="m"
              formatter={(val) =>
                val >= 60
                  ? `${Math.floor(val / 60)}h ${val % 60}`
                  : val.toString()
              }
            />

            {(mediaDocument?.type === 'vn' ||
              mediaDocument?.type === 'manga' ||
              mediaDocument?.type === 'reading') &&
              totalCharCount > 0 &&
              myStats.readingPercentage !== null &&
              theirStats.readingPercentage !== null && (
                <>
                  <ComparisonStat
                    label="Characters Read"
                    myValue={myStats.totalChars}
                    theirValue={theirStats.totalChars}
                  />

                  <ComparisonStat
                    label="Completion"
                    myValue={myStats.readingPercentage}
                    theirValue={theirStats.readingPercentage}
                    unit="%"
                    formatter={(val) => val.toFixed(1)}
                  />

                  {myStats.readingSpeed > 0 && theirStats.readingSpeed > 0 && (
                    <ComparisonStat
                      label="Reading Speed"
                      myValue={myStats.readingSpeed}
                      theirValue={theirStats.readingSpeed}
                      unit=" chars/hr"
                      formatter={(val) => Math.round(val).toString()}
                    />
                  )}
                </>
              )}

            {mediaDocument?.type === 'anime' && (
              <ComparisonStat
                label="Episodes Watched"
                myValue={myStats.totalEpisodes}
                theirValue={theirStats.totalEpisodes}
              />
            )}

            {mediaDocument?.type === 'manga' && (
              <ComparisonStat
                label="Pages Read"
                myValue={myStats.totalPages}
                theirValue={theirStats.totalPages}
              />
            )}
          </div>

          <div className="mt-4 text-center">
            <p className="text-sm text-base-content/70">
              You have{' '}
              <span className="font-semibold text-primary">
                {myStats.logCount}
              </span>{' '}
              log{myStats.logCount !== 1 ? 's' : ''} • {username} has{' '}
              <span className="font-semibold text-secondary">
                {theirStats.logCount}
              </span>{' '}
              log{theirStats.logCount !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-6">
          <div className="space-y-6 min-w-0">
            <div className="card bg-base-100 shadow-lg">
              <div className="card-body">
                <h2 className="card-title text-xl mb-4 flex items-center gap-2">
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  Media Details
                </h2>

                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-base-content/70 min-w-20">
                      Type:
                    </span>
                    <div className="badge badge-primary badge-lg uppercase font-medium">
                      {mediaType}
                    </div>
                  </div>

                  {difficultyInfo && (
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-base-content/70 min-w-20">
                        Difficulty:
                      </span>
                      <div
                        className="badge badge-lg gap-2"
                        style={{
                          backgroundColor: difficultyInfo[1],
                          color: 'white',
                        }}
                      >
                        <div className="w-2 h-2 rounded-full bg-white/80"></div>
                        <span>{difficultyInfo[0]}</span>
                      </div>
                    </div>
                  )}

                  {mediaType === 'anime' && (
                    <>
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-base-content/70 min-w-20">
                          Episodes:
                        </span>
                        <span>{mediaDocument?.episodes || 'Unknown'}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-base-content/70 min-w-20">
                          Duration:
                        </span>
                        <span>
                          {mediaDocument?.episodeDuration &&
                          mediaDocument.episodeDuration >= 60
                            ? `${Math.floor(mediaDocument.episodeDuration / 60)}h `
                            : ''}
                          {mediaDocument?.episodeDuration &&
                          mediaDocument.episodeDuration % 60 > 0
                            ? `${mediaDocument.episodeDuration % 60}m`
                            : 'Unknown'}
                        </span>
                      </div>
                    </>
                  )}

                  {mediaType === 'manga' && (
                    <>
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-base-content/70 min-w-20">
                          Volumes:
                        </span>
                        <span>{mediaDocument?.volumes || 'Unknown'}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-base-content/70 min-w-20">
                          Chapters:
                        </span>
                        <span>{mediaDocument?.chapters || 'Unknown'}</span>
                      </div>
                    </>
                  )}

                  {mediaDocument?.jiten?.mainDeck.characterCount ? (
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-base-content/70 min-w-20">
                        Characters:
                      </span>
                      <span>
                        {numberWithCommas(
                          mediaDocument.jiten.mainDeck.characterCount
                        )}
                      </span>
                    </div>
                  ) : null}

                  <div className="divider my-4"></div>

                  <div>
                    <h3 className="font-semibold text-base-content/70 mb-3 flex items-center gap-2">
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.102m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                        />
                      </svg>
                      External Links
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {(mediaDocument?.type === 'anime' ||
                        mediaDocument?.type === 'manga' ||
                        mediaDocument?.type === 'reading') && (
                        <a
                          className="btn btn-outline btn-sm gap-2"
                          href={`https://anilist.co/${
                            mediaDocument?.type === 'anime' ? 'anime' : 'manga'
                          }/${mediaDocument?.contentId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          AniList
                        </a>
                      )}
                      {mediaDocument?.type === 'vn' && (
                        <a
                          className="btn btn-outline btn-sm gap-2"
                          href={`https://vndb.org/${mediaDocument?.contentId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                            />
                          </svg>
                          VNDB
                        </a>
                      )}
                      {mediaDocument?.type === 'video' && (
                        <a
                          className="btn btn-outline btn-sm gap-2"
                          href={`https://www.youtube.com/channel/${mediaDocument?.contentId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                          </svg>
                          YouTube
                        </a>
                      )}
                      {mediaDocument?.jiten?.mainDeck && (
                        <a
                          className="btn btn-outline btn-sm gap-2"
                          href={`https://jiten.moe/decks/media/${mediaDocument.jiten.mainDeck.deckId}/detail`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                            />
                          </svg>
                          Jiten
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="card bg-base-100 shadow-lg">
              <div className="card-body">
                <h2 className="card-title text-xl mb-4 flex items-center gap-2">
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                  {username}'s Progress
                </h2>

                <div className="grid grid-cols-1 gap-4">
                  <div className="card bg-base-100 shadow-lg hover:shadow-xl transition-shadow">
                    <div className="card-body">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-medium text-base-content/70 uppercase tracking-wide">
                            Total XP
                          </h3>
                          <p className="text-3xl font-bold text-primary mt-1">
                            {numberWithCommas(totalXp || 0)}
                          </p>
                        </div>
                        <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                          <svg
                            className="w-6 h-6 text-primary"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M13 10V3L4 14h7v7l9-11h-7z"
                            ></path>
                          </svg>
                        </div>
                      </div>
                    </div>
                  </div>

                  {totalTime > 0 && (
                    <div className="card bg-base-100 shadow-lg hover:shadow-xl transition-shadow">
                      <div className="card-body">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="text-sm font-medium text-base-content/70 uppercase tracking-wide">
                              Total Time
                            </h3>
                            <p className="text-3xl font-bold text-secondary mt-1">
                              {totalTime >= 60
                                ? `${Math.floor(totalTime / 60)}h `
                                : ''}
                              {totalTime % 60 > 0 ? `${totalTime % 60}m` : ''}
                            </p>
                          </div>
                          <div className="w-12 h-12 bg-secondary/10 rounded-lg flex items-center justify-center">
                            <svg
                              className="w-6 h-6 text-secondary"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                              ></path>
                            </svg>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {mediaDocument?.type === 'anime' &&
                    logsArray.length > 0 &&
                    logsArray.some(
                      (log) => log.episodes && log.episodes > 0
                    ) && (
                      <div className="card bg-base-100 shadow-lg hover:shadow-xl transition-shadow">
                        <div className="card-body">
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="text-sm font-medium text-base-content/70 uppercase tracking-wide">
                                Episodes Watched
                              </h3>
                              <p className="text-3xl font-bold text-accent mt-1">
                                {logsArray.reduce(
                                  (acc, log) => acc + (log.episodes ?? 0),
                                  0
                                )}
                              </p>
                            </div>
                            <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center">
                              <svg
                                className="w-6 h-6 text-accent"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth="2"
                                  d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2"
                                ></path>
                              </svg>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                  {mediaDocument?.type === 'manga' &&
                    logsArray.length > 0 &&
                    logsArray.some((log) => log.pages && log.pages > 0) && (
                      <div className="card bg-base-100 shadow-lg hover:shadow-xl transition-shadow">
                        <div className="card-body">
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="text-sm font-medium text-base-content/70 uppercase tracking-wide">
                                Pages Read
                              </h3>
                              <p className="text-3xl font-bold text-accent mt-1">
                                {numberWithCommas(
                                  logsArray.reduce(
                                    (acc, log) => acc + (log.pages ?? 0),
                                    0
                                  )
                                )}
                              </p>
                            </div>
                            <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center">
                              <svg
                                className="w-6 h-6 text-accent"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth="2"
                                  d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2"
                                ></path>
                              </svg>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                  {(mediaDocument?.type === 'vn' ||
                    mediaDocument?.type === 'manga' ||
                    mediaDocument?.type === 'reading') &&
                    totalCharsRead > 0 && (
                      <div className="card bg-base-100 shadow-lg hover:shadow-xl transition-shadow">
                        <div className="card-body">
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="text-sm font-medium text-base-content/70 uppercase tracking-wide">
                                Characters Read
                              </h3>
                              <p className="text-3xl font-bold text-info mt-1">
                                {numberWithCommas(totalCharsRead)}
                              </p>
                            </div>
                            <div className="w-12 h-12 bg-info/10 rounded-lg flex items-center justify-center">
                              <svg
                                className="w-6 h-6 text-info"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth="2"
                                  d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2"
                                ></path>
                              </svg>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                  {(mediaDocument?.type === 'vn' ||
                    mediaDocument?.type === 'manga' ||
                    mediaDocument?.type === 'reading') &&
                    readingSpeed > 0 && (
                      <div className="card bg-base-100 shadow-lg hover:shadow-xl transition-shadow">
                        <div className="card-body">
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="text-sm font-medium text-base-content/70 uppercase tracking-wide">
                                Reading Speed
                              </h3>
                              <p className="text-3xl font-bold text-warning mt-1">
                                {numberWithCommas(Math.round(readingSpeed))}
                              </p>
                              <p className="text-xs text-base-content/60">
                                chars/hour
                              </p>
                            </div>
                            <div className="w-12 h-12 bg-warning/10 rounded-lg flex items-center justify-center">
                              <svg
                                className="w-6 h-6 text-warning"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth="2"
                                  d="M13 10V3L4 14h7v7l9-11h-7z"
                                ></path>
                              </svg>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                </div>

                {(mediaDocument?.type === 'vn' ||
                  mediaDocument?.type === 'manga' ||
                  mediaDocument?.type === 'reading') &&
                  mediaDocument?.jiten?.mainDeck.characterCount &&
                  totalCharCount > 0 && (
                    <div className="mt-6 space-y-4">
                      <div className="divider">Reading Progress</div>

                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">
                            Completion
                          </span>
                          <span className="text-sm font-bold">
                            {readingPercentage.toFixed(1)}%
                          </span>
                        </div>
                        <progress
                          className="progress progress-primary w-full"
                          value={readingPercentage}
                          max="100"
                        ></progress>
                        <div className="flex justify-between text-xs text-base-content/60">
                          <span>{numberWithCommas(totalCharsRead)} chars</span>
                          <span>{numberWithCommas(totalCharCount)} chars</span>
                        </div>
                      </div>

                      {readingSpeed > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {recentReadingSpeed > 0 && recentLogs.length > 0 && (
                            <div className="card bg-base-100 shadow-md">
                              <div className="card-body">
                                <h3 className="text-sm font-medium text-base-content/70 uppercase tracking-wide">
                                  Recent Speed
                                </h3>
                                <p className="text-2xl font-bold mt-1">
                                  {numberWithCommas(
                                    Math.round(recentReadingSpeed)
                                  )}
                                </p>
                                <p className="text-xs text-base-content/60">
                                  chars/hour (last {recentLogs.length} logs)
                                </p>
                              </div>
                            </div>
                          )}

                          {recentEstimatedTimeToFinish > 0 &&
                            readingPercentage < 100 && (
                              <div className="card bg-base-100 shadow-md">
                                <div className="card-body">
                                  <h3 className="text-sm font-medium text-base-content/70 uppercase tracking-wide">
                                    Time to Finish
                                  </h3>
                                  <p className="text-2xl font-bold mt-1">
                                    {recentEstimatedTimeToFinish >= 1
                                      ? Math.round(recentEstimatedTimeToFinish)
                                      : Math.round(
                                          recentEstimatedTimeToFinish * 60
                                        )}
                                  </p>
                                  <p className="text-xs text-base-content/60">
                                    {recentEstimatedTimeToFinish >= 1
                                      ? 'hours'
                                      : 'minutes'}{' '}
                                    (recent pace)
                                  </p>
                                </div>
                              </div>
                            )}
                        </div>
                      )}
                    </div>
                  )}
              </div>
            </div>
          </div>

          <div className="space-y-6 min-w-0">
            <div className="card bg-base-100 shadow-lg">
              <div className="card-body">
                <h2 className="card-title text-xl mb-4 flex items-center gap-2">
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                    />
                  </svg>
                  Progress Chart
                </h2>
                <ProgressChart logs={finalLogs as ILog[]} />
              </div>
            </div>

            <ComparisonCard />

            <div className="card bg-base-100 shadow-lg">
              <div className="card-body">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="card-title text-xl flex items-center gap-2">
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    Recent Activity
                  </h2>
                  {finalLogs && finalLogs.length > 0 && (
                    <div className="badge badge-neutral">
                      {sortedLogs.length} total
                    </div>
                  )}
                </div>

                {finalLogs && finalLogs.length > 0 ? (
                  <div className="space-y-3">
                    {visibleLogs.map((log) => (
                      <LogCard key={log._id} log={log} user={username} />
                    ))}
                    {hasMoreLogs && (
                      <div className="text-center pt-6">
                        <button
                          className="btn btn-outline gap-2"
                          onClick={handleShowMore}
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 14l-7 7m0 0l-7-7m7 7V3"
                            />
                          </svg>
                          Show More ({sortedLogs.length - visibleLogsCount}{' '}
                          remaining)
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="text-base-content/30 mb-6">
                      <svg
                        className="w-20 h-20 mx-auto"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-base-content/70 mb-2">
                      No activity found
                    </h3>
                    <p className="text-base-content/50 max-w-md mx-auto">
                      Start logging your progress to see your activity timeline
                      here. Your journey begins with the first entry!
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MediaDetails;

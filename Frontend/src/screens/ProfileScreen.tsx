import { useOutletContext } from 'react-router-dom';
import LogCard from '../components/LogCard';
import ProgressBar from '../components/ProgressBar';
import DailyGoalsCard from '../components/DailyGoalsCard';
import React, { useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { getUserLogsFn } from '../api/trackerApi';
import { OutletProfileContextType } from '../types';
import { useUserDataStore } from '../store/userData';

function ProfileScreen() {
  const limit = 10;
  const { user, username } = useOutletContext<OutletProfileContextType>();
  const { user: loggedUser } = useUserDataStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<
    'all' | 'anime' | 'manga' | 'reading' | 'vn' | 'video' | 'audio' | 'other'
  >('all');

  // Type guard to validate log type
  const isValidLogType = (
    value: string
  ): value is
    | 'anime'
    | 'manga'
    | 'reading'
    | 'vn'
    | 'video'
    | 'audio'
    | 'other' => {
    return [
      'anime',
      'manga',
      'reading',
      'vn',
      'video',
      'audio',
      'other',
    ].includes(value);
  };

  const {
    data: logs,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['logs', username, searchTerm, filterType],
    queryFn: ({ pageParam }) =>
      getUserLogsFn(username as string, {
        limit,
        page: pageParam as number,
        search: searchTerm,
        type: filterType !== 'all' ? filterType : undefined,
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
            {username === loggedUser?.username && (
              <DailyGoalsCard username={username} />
            )}
          </div>

          <div className="flex flex-col gap-4 md:gap-5">
            <div className="flex flex-col gap-3">
              <h2 className="card-title self-start">Activity Logs</h2>

              <div className="flex flex-col sm:flex-row gap-3">
                <label className="input input-sm input-bordered flex items-center gap-2 flex-1">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 16 16"
                    fill="currentColor"
                    className="w-4 h-4 opacity-70"
                  >
                    <path
                      fillRule="evenodd"
                      d="M9.965 11.026a5 5 0 1 1 1.06-1.06l2.755 2.754a.75.75 0 1 1-1.06 1.06l-2.755-2.754ZM10.5 7a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0Z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <input
                    type="text"
                    className="grow"
                    placeholder="Search logs..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </label>

                <select
                  className="select select-sm select-bordered w-full sm:w-auto"
                  value={filterType}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === 'all' || isValidLogType(value)) {
                      setFilterType(value as typeof filterType);
                    }
                  }}
                >
                  <option value="all">All Types</option>
                  <option value="anime">Anime</option>
                  <option value="manga">Manga</option>
                  <option value="reading">Reading</option>
                  <option value="vn">Visual Novel</option>
                  <option value="video">Video</option>
                  <option value="audio">Audio</option>
                  <option value="other">Other</option>
                </select>
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

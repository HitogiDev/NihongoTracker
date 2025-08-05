import { useOutletContext } from 'react-router-dom';
import { OutletMediaContextType } from '../types';
import ProgressChart from '../components/ProgressChart';
import { useQuery } from '@tanstack/react-query';
import { getUserLogsFn } from '../api/trackerApi';
import { numberWithCommas } from '../utils/utils';
import LogCard from '../components/LogCard';
import { useState } from 'react';

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

  const [visibleLogsCount, setVisibleLogsCount] = useState(10);

  const { data: logs } = useQuery({
    queryKey: [username, 'logs', 'total', mediaDocument?.contentId],
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
    enabled: !!username && !!mediaDocument?.contentId && !!mediaDocument?.type,
    staleTime: Infinity,
  });

  // Ensure logs is always an array before using array methods
  const logsArray = Array.isArray(logs) ? logs : [];

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
  const recentTime = recentLogs.reduce((acc, log) => acc + (log.time ?? 0), 0);
  const recentReadingSpeed =
    recentTime && recentTime > 0 ? (recentCharsRead / recentTime) * 60 : 0; // chars per hour

  const remainingChars = Math.max(totalCharCount - totalCharsRead, 0);
  const recentEstimatedTimeToFinish =
    recentReadingSpeed > 0 ? remainingChars / recentReadingSpeed : 0; // in hours

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

  return (
    <div className="min-h-screen">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-6">
          {/* Left Column - Media Details + User Overview */}
          <div className="space-y-6">
            {/* Media Details Card */}
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

                  {/* Difficulty Display */}
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

                  {mediaDocument?.jiten?.mainDeck.characterCount && (
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
                  )}

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
                          <svg
                            className="w-4 h-4"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                          >
                            <path d="M6.361 2.943 0 21.056h4.942l1.077-3.133H11.4l1.052 3.133H17.9l-6.662-18.113H6.361zm2.894 9.135 1.85-5.386 1.8 5.386H9.255zm8.683-.739c.533-1.013.854-2.19.854-3.57 0-2.506-1.2-4.769-4.069-4.769-1.732 0-2.82.933-3.353 2.066v-1.665h-3.03v8.11h3.03v-4.238c0-1.2.506-1.799 1.4-1.799.932 0 1.33.666 1.33 1.732v4.305h3.03v-5.172c0-.733-.12-1.386-.372-1.866l1.18-.133z" />
                          </svg>
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

            {/* User Overview Card */}
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

                  {/* Reading Speed Card - Show for reading types when we have both chars and time */}
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

                {/* Enhanced Progress Section - Only show when Jiten data is available */}
                {(mediaDocument?.type === 'vn' ||
                  mediaDocument?.type === 'manga' ||
                  mediaDocument?.type === 'reading') &&
                  mediaDocument?.jiten?.mainDeck.characterCount &&
                  totalCharCount > 0 && (
                    <div className="mt-6 space-y-4">
                      <div className="divider">Reading Progress</div>

                      {/* Progress Bar */}
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

                      {/* Reading Statistics with Jiten data */}
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

          {/* Right Column - Progress Chart + Logs */}
          <div className="space-y-6">
            {/* Progress Chart Card */}
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
                <ProgressChart logs={logs} />
              </div>
            </div>

            {/* Logs Section */}
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
                  {logs && logs.length > 0 && (
                    <div className="badge badge-neutral">
                      {sortedLogs.length} total
                    </div>
                  )}
                </div>

                {logs && logs.length > 0 ? (
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

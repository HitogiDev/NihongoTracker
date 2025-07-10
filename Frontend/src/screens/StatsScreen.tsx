import { useQuery } from '@tanstack/react-query';
import { getUserStatsFn } from '../api/trackerApi';
import { useOutletContext } from 'react-router-dom';
import { OutletProfileContextType } from '../types';
import PieChart from '../components/PieChart';
import { useState } from 'react';
import SpeedChart from '../components/SpeedChart';
import ProgressChart from '../components/ProgressChart';
import DailyGoals from '../components/DailyGoals';
import { numberWithCommas } from '../utils/utils';

function StatsScreen() {
  const { username } = useOutletContext<OutletProfileContextType>();
  const [currentType, setCurrentType] = useState<string>('all');
  const [timeRange, setTimeRange] = useState<
    'today' | 'month' | 'year' | 'total'
  >('total');

  const { data: userStats, isLoading } = useQuery({
    queryKey: ['userStats', username, timeRange, currentType],
    queryFn: () =>
      getUserStatsFn(username as string, { timeRange, type: currentType }),
    staleTime: Infinity,
    enabled: !!username,
  });

  const logTypes = [
    'reading',
    'anime',
    'vn',
    'video',
    'manga',
    'audio',
    'movie',
    'tv show',
    'other',
  ];

  // Create chart data from the pre-aggregated stats
  const logCountData = {
    labels:
      userStats?.statsByType.map((stat) =>
        stat.type === 'vn' ? 'Visual Novel' : stat.type
      ) || [],
    datasets: [
      {
        label: 'Count',
        data: userStats?.statsByType.map((stat) => stat.count) || [],
        backgroundColor: [
          'rgba(255, 99, 132, 1)',
          'rgba(54, 162, 235, 1)',
          'rgba(255, 206, 86, 1)',
          'rgba(75, 192, 192, 1)',
          'rgba(153, 102, 255, 1)',
          'rgba(255, 159, 64, 1)',
          'rgba(255, 87, 34, 1)',
          'rgba(76, 175, 80, 1)',
          'rgba(99, 99, 132, 1)',
        ],
        borderColor: [
          'rgba(255, 99, 132, 1)',
          'rgba(54, 162, 235, 1)',
          'rgba(255, 206, 86, 1)',
          'rgba(75, 192, 192, 1)',
          'rgba(153, 102, 255, 1)',
          'rgba(255, 159, 64, 1)',
          'rgba(255, 87, 34, 1)',
          'rgba(76, 175, 80, 1)',
          'rgba(99, 99, 132, 1)',
        ],
        borderWidth: 1,
      },
    ],
  };

  const logTimeData = {
    labels:
      userStats?.statsByType.map((stat) =>
        stat.type === 'vn' ? 'Visual Novel' : stat.type
      ) || [],
    datasets: [
      {
        label: 'Time Spent (hours)',
        data: userStats?.statsByType.map((stat) => stat.totalTimeHours) || [],
        backgroundColor: [
          'rgba(255, 99, 132, 1)',
          'rgba(54, 162, 235, 1)',
          'rgba(255, 206, 86, 1)',
          'rgba(75, 192, 192, 1)',
          'rgba(153, 102, 255, 1)',
          'rgba(255, 159, 64, 1)',
          'rgba(255, 87, 34, 1)',
          'rgba(76, 175, 80, 1)',
          'rgba(99, 99, 132, 1)',
        ],
        borderColor: [
          'rgba(255, 99, 132, 1)',
          'rgba(54, 162, 235, 1)',
          'rgba(255, 206, 86, 1)',
          'rgba(75, 192, 192, 1)',
          'rgba(153, 102, 255, 1)',
          'rgba(255, 159, 64, 1)',
          'rgba(255, 87, 34, 1)',
          'rgba(76, 175, 80, 1)',
          'rgba(99, 99, 132, 1)',
        ],
        borderWidth: 1,
      },
    ],
  };

  const logXpData = {
    labels:
      userStats?.statsByType.map((stat) =>
        stat.type === 'vn' ? 'Visual Novel' : stat.type
      ) || [],
    datasets: [
      {
        label: 'XP',
        data: userStats?.statsByType.map((stat) => stat.totalXp) || [],
        backgroundColor: [
          'rgba(255, 99, 132, 1)',
          'rgba(54, 162, 235, 1)',
          'rgba(255, 206, 86, 1)',
          'rgba(75, 192, 192, 1)',
          'rgba(153, 102, 255, 1)',
          'rgba(255, 159, 64, 1)',
          'rgba(255, 87, 34, 1)',
          'rgba(76, 175, 80, 1)',
          'rgba(99, 99, 132, 1)',
        ],
        borderColor: [
          'rgba(255, 99, 132, 1)',
          'rgba(54, 162, 235, 1)',
          'rgba(255, 206, 86, 1)',
          'rgba(75, 192, 192, 1)',
          'rgba(153, 102, 255, 1)',
          'rgba(255, 159, 64, 1)',
          'rgba(255, 87, 34, 1)',
          'rgba(76, 175, 80, 1)',
          'rgba(99, 99, 132, 1)',
        ],
        borderWidth: 1,
      },
    ],
  };

  // Get the current type stats or use the aggregated totals
  const currentTypeStats =
    currentType === 'all'
      ? userStats?.totals
      : userStats?.statsByType.find((stat) => stat.type === currentType);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-base-100 to-base-200 flex items-center justify-center">
        <div className="text-center">
          <span className="loading loading-spinner loading-lg text-primary"></span>
          <p className="mt-4 text-base-content/70">Loading your stats...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-base-content mb-2">
                {username}'s Statistics
              </h1>
              <p className="text-base-content/70">
                Track your immersion journey and progress
              </p>
            </div>

            {/* Controls */}
            <div className="flex flex-col sm:flex-row gap-3">
              <select
                className="select select-bordered select-primary w-full sm:w-auto"
                value={timeRange}
                onChange={(e) =>
                  setTimeRange(
                    e.target.value as 'today' | 'month' | 'year' | 'total'
                  )
                }
              >
                <option value="today">Today</option>
                <option value="month">This Month</option>
                <option value="year">This Year</option>
                <option value="total">All Time</option>
              </select>

              <div className="dropdown dropdown-end">
                <div tabIndex={0} role="button" className="btn btn-outline">
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
                      d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.414A1 1 0 013 6.707V4z"
                    ></path>
                  </svg>
                  {currentType === 'all'
                    ? 'All Types'
                    : currentType === 'vn'
                      ? 'Visual Novel'
                      : currentType.charAt(0).toUpperCase() +
                        currentType.slice(1)}
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
                  <li>
                    <button
                      className={currentType === 'all' ? 'active' : ''}
                      onClick={() => setCurrentType('all')}
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
                          strokeWidth="2"
                          d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                        ></path>
                      </svg>
                      All Types
                    </button>
                  </li>
                  {logTypes.map((type) => (
                    <li key={type}>
                      <button
                        className={currentType === type ? 'active' : ''}
                        onClick={() => setCurrentType(type)}
                      >
                        {type === 'vn'
                          ? 'Visual Novel'
                          : type.charAt(0).toUpperCase() + type.slice(1)}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Daily Goals Section - Add this before Main Stats Cards */}
        <div className="mb-8">
          <DailyGoals username={username} />
        </div>

        {/* Main Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="card bg-base-100 shadow-lg hover:shadow-xl transition-shadow">
            <div className="card-body">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-base-content/70 uppercase tracking-wide">
                    Total XP
                  </h3>
                  <p className="text-3xl font-bold text-primary mt-1">
                    {currentTypeStats
                      ? numberWithCommas(currentTypeStats.totalXp)
                      : 0}
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
              <p className="text-xs text-base-content/60 mt-2">
                {currentType === 'all'
                  ? `${timeRange === 'total' ? 'All time' : timeRange === 'today' ? "Today's" : timeRange === 'month' ? "This month's" : "This year's"} experience gained`
                  : `${currentType.charAt(0).toUpperCase() + currentType.slice(1)} category experience`}
              </p>
            </div>
          </div>

          <div className="card bg-base-100 shadow-lg hover:shadow-xl transition-shadow">
            <div className="card-body">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-base-content/70 uppercase tracking-wide">
                    Time Spent
                  </h3>
                  <p className="text-3xl font-bold text-secondary mt-1">
                    {currentTypeStats
                      ? numberWithCommas(
                          parseFloat(currentTypeStats.totalTimeHours.toFixed(1))
                        )
                      : 0}
                    <span className="text-lg text-base-content/70 ml-1">
                      hours
                    </span>
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
              <p className="text-xs text-base-content/60 mt-2">
                {currentType === 'all'
                  ? `${timeRange === 'total' ? 'All time' : timeRange === 'today' ? 'Today' : timeRange === 'month' ? 'This month' : 'This year'} immersion time`
                  : `${currentType.charAt(0).toUpperCase() + currentType.slice(1)} immersion time`}
              </p>
            </div>
          </div>

          <div className="card bg-base-100 shadow-lg hover:shadow-xl transition-shadow">
            <div className="card-body">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-base-content/70 uppercase tracking-wide">
                    Log Count
                  </h3>
                  <p className="text-3xl font-bold text-accent mt-1">
                    {currentTypeStats
                      ? numberWithCommas(
                          currentType === 'all'
                            ? userStats?.totals.totalLogs || 0
                            : 'count' in currentTypeStats
                              ? currentTypeStats.count
                              : 0
                        )
                      : 0}
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
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    ></path>
                  </svg>
                </div>
              </div>
              <div className="flex items-center justify-between mt-2">
                <p className="text-xs text-base-content/60">
                  {currentType !== 'all'
                    ? `${currentType.charAt(0).toUpperCase() + currentType.slice(1)} entries`
                    : 'Total log entries'}
                </p>
                {currentType === 'all' &&
                  (userStats?.totals.untrackedCount ?? 0) > 0 && (
                    <span className="badge badge-warning badge-xs">
                      {userStats?.totals.untrackedCount} untracked
                    </span>
                  )}
              </div>
            </div>
          </div>
        </div>

        {/* Reading/Listening Balance - Only for 'all' type */}
        {currentType === 'all' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="card bg-base-100 shadow-lg">
              <div className="card-body">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 bg-info/10 rounded-lg flex items-center justify-center">
                    <svg
                      className="w-4 h-4 text-info"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                      ></path>
                    </svg>
                  </div>
                  <h3 className="font-semibold text-info">Reading</h3>
                </div>
                <p className="text-2xl font-bold">
                  {userStats?.totals.readingHours
                    ? numberWithCommas(
                        parseFloat(userStats.totals.readingHours.toFixed(1))
                      )
                    : 0}
                  <span className="text-sm font-normal text-base-content/70 ml-1">
                    hours
                  </span>
                </p>
                <p className="text-xs text-base-content/60 mt-1">
                  Reading, Manga, Visual Novels
                </p>
              </div>
            </div>

            <div className="card bg-base-100 shadow-lg">
              <div className="card-body">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 bg-success/10 rounded-lg flex items-center justify-center">
                    <svg
                      className="w-4 h-4 text-success"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                      ></path>
                    </svg>
                  </div>
                  <h3 className="font-semibold text-success">Listening</h3>
                </div>
                <p className="text-2xl font-bold">
                  {userStats?.totals.listeningHours
                    ? numberWithCommas(
                        parseFloat(userStats.totals.listeningHours.toFixed(1))
                      )
                    : 0}
                  <span className="text-sm font-normal text-base-content/70 ml-1">
                    hours
                  </span>
                </p>
                <p className="text-xs text-base-content/60 mt-1">
                  Anime, Video, Audio, Movies, TV Shows
                </p>
              </div>
            </div>

            <div className="card bg-base-100 shadow-lg">
              <div className="card-body">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 bg-warning/10 rounded-lg flex items-center justify-center">
                    <svg
                      className="w-4 h-4 text-warning"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                      ></path>
                    </svg>
                  </div>
                  <h3 className="font-semibold text-warning">Balance</h3>
                </div>
                <p className="text-2xl font-bold">
                  {userStats?.totals.readingHours &&
                  userStats?.totals.listeningHours &&
                  userStats.totals.readingHours +
                    userStats.totals.listeningHours >
                    0
                    ? (() => {
                        const total =
                          userStats.totals.readingHours +
                          userStats.totals.listeningHours;
                        const readingRatio = Math.round(
                          (userStats.totals.readingHours / total) * 10
                        );
                        const listeningRatio = 10 - readingRatio;
                        return `${readingRatio}:${listeningRatio}`;
                      })()
                    : '0:0'}
                </p>
                <p className="text-xs text-base-content/60 mt-1">
                  Reading/Listening ratio
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Additional Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {(currentType === 'all' ||
            ['reading', 'manga', 'vn'].includes(currentType)) && (
            <div className="card bg-base-100 shadow-lg">
              <div className="card-body">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                    <svg
                      className="w-4 h-4 text-primary"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2m0 0V3a1 1 0 011 1v14a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1m0 0h10"
                      ></path>
                    </svg>
                  </div>
                  <h3 className="font-semibold">Characters Read</h3>
                </div>
                <p className="text-2xl font-bold text-primary">
                  {(() => {
                    if (currentType === 'all') {
                      return numberWithCommas(
                        userStats?.totals.totalChars || 0
                      );
                    } else {
                      const typeStats = userStats?.statsByType.find(
                        (stat) => stat.type === currentType
                      );
                      return numberWithCommas(typeStats?.totalChars || 0);
                    }
                  })()}
                </p>
                <p className="text-xs text-base-content/60 mt-1">
                  {currentType === 'all'
                    ? 'Characters across all reading types'
                    : `Characters in ${currentType} logs`}
                </p>
              </div>
            </div>
          )}

          <div className="card bg-base-100 shadow-lg">
            <div className="card-body">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 bg-secondary/10 rounded-lg flex items-center justify-center">
                  <svg
                    className="w-4 h-4 text-secondary"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                    ></path>
                  </svg>
                </div>
                <h3 className="font-semibold">Daily Average</h3>
              </div>
              <p className="text-2xl font-bold text-secondary">
                {userStats?.totals.dailyAverageHours
                  ? numberWithCommas(
                      parseFloat(userStats.totals.dailyAverageHours.toFixed(2))
                    )
                  : 0}
                <span className="text-sm font-normal text-base-content/70 ml-1">
                  hours
                </span>
              </p>
              <p className="text-xs text-base-content/60 mt-1">
                {(() => {
                  const periodText = {
                    today: "Today's",
                    month: "This month's",
                    year: "This year's",
                    total: 'All-time',
                  }[timeRange];
                  const typeText =
                    currentType === 'all'
                      ? 'immersion'
                      : `${currentType} immersion`;
                  return `${periodText} daily ${typeText} average`;
                })()}
              </p>
            </div>
          </div>
        </div>

        {/* Charts Section */}
        {currentType === 'all' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            <div className="card bg-base-100 shadow-lg">
              <div className="card-body">
                <h3 className="card-title text-lg mb-4">
                  <svg
                    className="w-5 h-5 text-primary"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                    ></path>
                  </svg>
                  Log Count
                </h3>
                <div className="h-64">
                  <PieChart data={logCountData} />
                </div>
              </div>
            </div>

            <div className="card bg-base-100 shadow-lg">
              <div className="card-body">
                <h3 className="card-title text-lg mb-4">
                  <svg
                    className="w-5 h-5 text-primary"
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
                  Time Distribution
                </h3>
                <div className="h-64">
                  <PieChart data={logTimeData} />
                </div>
              </div>
            </div>

            <div className="card bg-base-100 shadow-lg">
              <div className="card-body">
                <h3 className="card-title text-lg mb-4">
                  <svg
                    className="w-5 h-5 text-primary"
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
                  XP Distribution
                </h3>
                <div className="h-64">
                  <PieChart data={logXpData} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Large Charts */}
        <div className="space-y-6">
          {(currentType === 'all' ||
            currentType === 'reading' ||
            currentType === 'manga' ||
            currentType === 'vn') &&
            userStats?.readingSpeedData && (
              <div className="card bg-base-100 shadow-lg">
                <div className="card-body">
                  <h3 className="card-title text-xl mb-4">
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
                    Reading Speed Over Time
                  </h3>
                  <div className="w-full" style={{ height: '400px' }}>
                    <SpeedChart
                      timeframe={timeRange}
                      readingSpeedData={userStats.readingSpeedData}
                    />
                  </div>
                </div>
              </div>
            )}

          <div className="card bg-base-100 shadow-lg">
            <div className="card-body">
              <h3 className="card-title text-xl mb-4">
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
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  ></path>
                </svg>
                Progress Timeline
              </h3>
              <div className="w-full" style={{ height: '300px' }}>
                <ProgressChart
                  timeframe={timeRange}
                  statsData={userStats?.statsByType}
                  selectedType={currentType}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default StatsScreen;

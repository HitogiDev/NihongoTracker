import { Link } from 'react-router-dom';
import { useUserDataStore } from '../store/userData';
import { useQuery } from '@tanstack/react-query';
import {
  getDashboardHoursFn,
  getRankingFn,
  getRecentLogsFn,
} from '../api/trackerApi';
import { useMemo } from 'react';
import { numberWithCommas } from '../utils/utils';

function Hero() {
  const { user } = useUserDataStore();
  const username = user?.username;

  // Fetch hours for the logged-in user
  const { data: hours, isError: hoursError } = useQuery({
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

  // Fetch ranking for the logged-in user
  const { data: ranking } = useQuery({
    queryKey: ['ranking'],
    queryFn: () =>
      getRankingFn({
        limit: 3,
        page: 1,
        filter: 'userXp',
        timeFilter: 'all-time',
      }).catch(() => []),
    staleTime: Infinity,
    enabled: !!username,
  });

  // Calculate immersion statistics
  const immersionStats = useMemo(() => {
    if (!hours) {
      return {
        currentMonth: { reading: 0, listening: 0, total: 0 },
        lastMonth: { reading: 0, listening: 0, total: 0 },
        changes: { reading: 0, listening: 0, total: 0 },
      };
    }

    // Convert from minutes to hours
    const currentReadingTime = hours.currentMonth.readingTime / 60;
    const currentListeningTime = hours.currentMonth.listeningTime / 60;
    const currentTotal = hours.currentMonth.totalTime / 60;

    const lastReadingTime = hours.previousMonth.readingTime / 60;
    const lastListeningTime = hours.previousMonth.listeningTime / 60;
    const lastTotal = hours.previousMonth.totalTime / 60;

    // Calculate percentage changes
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

  // Get recent logs
  const recentLogs = useMemo(() => {
    if (!logs || !Array.isArray(logs)) return [];

    return logs
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 3)
      .map((log) => ({
        ...log,
        formattedDate: formatRelativeDate(new Date(log.date)),
        formattedTime: formatTime(log.time, log.episodes),
      }));
  }, [logs]);

  // Helper function to format relative dates
  function formatRelativeDate(date: Date) {
    const now = new Date();
    const diffDays = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  }

  // Helper function to format time
  function formatTime(minutes?: number, episodes?: number) {
    if (minutes && minutes > 0) {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return hours > 0 ? `${hours}h ${mins > 0 ? `${mins}m` : ''}` : `${mins}m`;
    } else if (episodes) {
      return `${episodes} ep${episodes > 1 ? 's' : ''}`;
    }
    return 'N/A';
  }
  return (
    <div className="hero min-h-screen bg-gradient-to-br from-base-100 to-base-200 pt-20">
      {!user ? (
        <div className="hero-content text-center">
          <div className="max-w-6xl">
            <div className="mb-16">
              <h1 className="text-6xl md:text-7xl font-bold mb-8 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent leading-normal py-2">
                NihongoTracker
              </h1>
              <p className="text-xl md:text-2xl mb-8 text-base-content/80 max-w-3xl mx-auto">
                Transform your Japanese learning journey with{' '}
                <span className="font-bold text-primary">
                  gamified immersion tracking
                </span>
                .
                <br />
                Compete with friends, visualize progress, and stay motivated.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
                <Link className="btn btn-primary btn-lg" to="/register">
                  <svg
                    className="w-5 h-5 mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                  Start Your Journey
                </Link>
                <Link className="btn btn-outline btn-lg" to="/login">
                  Sign In
                </Link>
              </div>

              <div className="flex flex-wrap justify-center gap-3 mb-12">
                <div className="badge badge-primary badge-lg">
                  📚 Reading Tracker
                </div>
                <div className="badge badge-secondary badge-lg">
                  🎧 Listening Timer
                </div>
                <div className="badge badge-accent badge-lg">
                  📊 Progress Analytics
                </div>
                <div className="badge badge-info badge-lg">🏆 Leaderboards</div>
              </div>
            </div>

            {/* Feature Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
              <div className="card bg-base-100 shadow-xl">
                <div className="card-body text-center">
                  <div className="mx-auto mb-4 p-4 bg-primary/10 rounded-full w-fit">
                    <svg
                      className="w-8 h-8 text-primary"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                      />
                    </svg>
                  </div>
                  <h3 className="card-title justify-center text-xl mb-2">
                    Track Everything
                  </h3>
                  <p className="text-sm text-base-content/70">
                    Log reading, anime, games, and study time. Support for
                    books, manga, visual novels, and more.
                  </p>
                </div>
              </div>

              <div className="card bg-base-100 shadow-xl">
                <div className="card-body text-center">
                  <div className="mx-auto mb-4 p-4 bg-secondary/10 rounded-full w-fit">
                    <svg
                      className="w-8 h-8 text-secondary"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                      />
                    </svg>
                  </div>
                  <h3 className="card-title justify-center text-xl mb-2">
                    Visualize Progress
                  </h3>
                  <p className="text-sm text-base-content/70">
                    Beautiful charts and statistics show your improvement over
                    time. See patterns in your learning.
                  </p>
                </div>
              </div>

              <div className="card bg-base-100 shadow-xl">
                <div className="card-body text-center">
                  <div className="mx-auto mb-4 p-4 bg-accent/10 rounded-full w-fit">
                    <svg
                      className="w-8 h-8 text-accent"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                      />
                    </svg>
                  </div>
                  <h3 className="card-title justify-center text-xl mb-2">
                    Compete & Share
                  </h3>
                  <p className="text-sm text-base-content/70">
                    Join leaderboards, share achievements, and stay motivated
                    with the community.
                  </p>
                </div>
              </div>
            </div>

            {/* Demo Dashboard */}
            <div className="card bg-base-100 shadow-2xl mb-16">
              <div className="card-body p-8">
                <h2 className="card-title text-center justify-center text-2xl mb-6">
                  See Your Progress Come to Life
                </h2>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2">
                    <div className="stats stats-vertical lg:stats-horizontal shadow w-full">
                      <div className="stat">
                        <div className="stat-figure text-primary">
                          <svg
                            className="w-8 h-8"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                            />
                          </svg>
                        </div>
                        <div className="stat-title">Reading This Month</div>
                        <div className="stat-value text-primary">42.5h</div>
                        <div className="stat-desc">
                          ↗︎ 15% more than last month
                        </div>
                      </div>

                      <div className="stat">
                        <div className="stat-figure text-secondary">
                          <svg
                            className="w-8 h-8"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                            />
                          </svg>
                        </div>
                        <div className="stat-title">Listening This Month</div>
                        <div className="stat-value text-secondary">67.2h</div>
                        <div className="stat-desc">
                          ↗︎ 8% more than last month
                        </div>
                      </div>

                      <div className="stat">
                        <div className="stat-figure text-success">
                          <svg
                            className="w-8 h-8"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M13 10V3L4 14h7v7l9-11h-7z"
                            />
                          </svg>
                        </div>
                        <div className="stat-title">Current Streak</div>
                        <div className="stat-value text-success">23</div>
                        <div className="stat-desc">consecutive days</div>
                      </div>
                    </div>
                  </div>

                  <div className="card bg-base-200">
                    <div className="card-body">
                      <h3 className="card-title text-lg">Recent Activity</h3>
                      <div className="space-y-2">
                        <div className="flex items-center gap-3 text-sm">
                          <div className="badge badge-primary badge-sm">
                            Anime
                          </div>
                          <span>Attack on Titan • 24m</span>
                        </div>
                        <div className="flex items-center gap-3 text-sm">
                          <div className="badge badge-secondary badge-sm">
                            Reading
                          </div>
                          <span>よつばと！• 1.2h</span>
                        </div>
                        <div className="flex items-center gap-3 text-sm">
                          <div className="badge badge-accent badge-sm">
                            Game
                          </div>
                          <span>ペルソナ5 • 45m</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Call to Action */}
            <div className="text-center">
              <h2 className="text-3xl font-bold mb-4">
                Ready to Level Up Your Japanese?
              </h2>
              <p className="text-lg text-base-content/70 mb-8 max-w-2xl mx-auto">
                Join the community of learners who are already tracking their
                immersion journey and achieving their goals.
              </p>
              <Link className="btn btn-primary btn-lg" to="/register">
                Create Your Free Account
              </Link>
              <p className="text-sm text-base-content/50 mt-4">
                No payment required • Start tracking immediately
              </p>
            </div>
          </div>
        </div>
      ) : (
        // Content for logged in users (dashboard view)
        <div className="hero-content flex-col lg:flex-row w-full max-w-6xl mx-auto">
          <div className="lg:w-2/3">
            <div className="flex flex-col gap-6">
              <div className="flex justify-between items-center">
                <h1 className="text-4xl font-bold">
                  Welcome back, {user.username}!
                </h1>
                <div className="stats bg-base-100 shadow">
                  <div className="stat">
                    <div className="stat-title">Current Streak</div>
                    <div className="stat-value text-success">
                      {user.stats?.currentStreak ?? 0}
                    </div>
                    <div className="stat-desc">
                      day
                      {user.stats?.currentStreak && user.stats.currentStreak > 1
                        ? 's'
                        : ''}
                    </div>
                  </div>
                </div>
              </div>

              <div className="card bg-base-100 shadow-xl">
                <div className="card-body">
                  <h2 className="card-title">Quick Actions</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                    <Link to="/createlog" className="btn btn-primary">
                      Add Immersion
                    </Link>
                    <Link
                      to={`/user/${user.username}`}
                      className="btn btn-secondary"
                    >
                      View Profile
                    </Link>
                    <Link to="/ranking" className="btn btn-accent">
                      Check Ranking
                    </Link>
                  </div>
                </div>
              </div>

              <div className="card bg-base-100 shadow-xl">
                <div className="card-body">
                  <h2 className="card-title">Recent Activity</h2>
                  <div className="overflow-x-auto">
                    <table className="table table-zebra">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Media</th>
                          <th>Type</th>
                          <th>Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {hoursError ? (
                          <tr>
                            <td colSpan={4} className="text-center text-error">
                              Error loading recent logs
                            </td>
                          </tr>
                        ) : recentLogs.length > 0 ? (
                          recentLogs.map((log) => (
                            <tr key={log._id}>
                              <td>{log.formattedDate}</td>
                              <td>
                                {log.media?.title.contentTitleNative
                                  ? log.media.title.contentTitleNative
                                  : log.description}
                              </td>
                              <td className="capitalize">
                                {log.type === 'vn' ? 'VN' : log.type}
                              </td>
                              <td>{log.formattedTime}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={4} className="text-center">
                              View your detailed logs in your profile page
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div className="card-actions justify-end">
                    <Link
                      to={`/user/${user.username}`}
                      className="btn btn-sm btn-ghost"
                    >
                      View All Logs
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:w-1/3 mt-8 lg:mt-0">
            <div className="card bg-base-100 shadow-xl">
              <div className="card-body">
                <h2 className="card-title">Monthly Progress</h2>
                <span className="text-xs text-base-content/70">
                  Comparing{' '}
                  {new Date().toLocaleDateString('en-US', { month: 'short' })} 1
                  - {new Date().getDate()} vs{' '}
                  {new Date(
                    new Date().getFullYear(),
                    new Date().getMonth() - 1,
                    1
                  ).toLocaleDateString('en-US', { month: 'short' })}{' '}
                  1 -{' '}
                  {Math.min(
                    new Date().getDate(),
                    new Date(
                      new Date().getFullYear(),
                      new Date().getMonth(),
                      0
                    ).getDate()
                  )}{' '}
                  of last month
                </span>
                <div className="stats stats-vertical">
                  <div className="stat">
                    <div className="stat-title">Reading</div>
                    <div className="stat-value text-primary">
                      {immersionStats.currentMonth.reading}h
                    </div>
                    <div className="stat-desc">
                      {immersionStats.changes.reading > 0 ? (
                        <span className="text-success">
                          ↗︎ {immersionStats.changes.reading}% more than same
                          period last month
                        </span>
                      ) : immersionStats.changes.reading < 0 ? (
                        <span className="text-error">
                          ↘︎ {Math.abs(immersionStats.changes.reading)}% less
                          than same period last month
                        </span>
                      ) : (
                        <span className="text-base-content/70">
                          Same as same period last month
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="stat">
                    <div className="stat-title">Listening</div>
                    <div className="stat-value text-secondary">
                      {immersionStats.currentMonth.listening}h
                    </div>
                    <div className="stat-desc">
                      {immersionStats.changes.listening > 0 ? (
                        <span className="text-success">
                          ↗︎ {immersionStats.changes.listening}% more than same
                          period last month
                        </span>
                      ) : immersionStats.changes.listening < 0 ? (
                        <span className="text-error">
                          ↘︎ {Math.abs(immersionStats.changes.listening)}% less
                          than same period last month
                        </span>
                      ) : (
                        <span className="text-base-content/70">
                          Same as same period last month
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="stat">
                    <div className="stat-title">Total Immersion</div>
                    <div className="stat-value">
                      {immersionStats.currentMonth.total}h
                    </div>
                    <div className="stat-desc">
                      {immersionStats.changes.total > 0 ? (
                        <span className="text-success">
                          ↗︎ {immersionStats.changes.total}% more than same
                          period last month
                        </span>
                      ) : immersionStats.changes.total < 0 ? (
                        <span className="text-error">
                          ↘︎ {Math.abs(immersionStats.changes.total)}% less
                          than same period last month
                        </span>
                      ) : (
                        <span className="text-base-content/70">
                          Same as same period last month
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="card-actions justify-end mt-4">
                  <Link
                    to={`/user/${user.username}/stats`}
                    className="btn btn-sm btn-outline"
                  >
                    Detailed Stats
                  </Link>
                </div>
              </div>
            </div>

            <div className="card bg-base-100 shadow-xl mt-6">
              <div className="card-body">
                <h2 className="card-title">Leaderboard</h2>
                <div className="overflow-x-auto">
                  <table className="table table-xs">
                    <thead>
                      <tr>
                        <th>Rank</th>
                        <th>User</th>
                        <th>XP</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ranking?.map((ranking, index) => (
                        <tr
                          key={ranking.username}
                          className={`hover ${ranking.username === user.username ? 'bg-base-200' : ''}`}
                        >
                          <td>{index + 1}</td>
                          <td>
                            <Link to={`/user/${ranking.username}`}>
                              {ranking.username}
                            </Link>
                          </td>
                          <td>
                            {numberWithCommas(ranking.stats?.userXp ?? 0)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="card-actions justify-end">
                  <Link to="/ranking" className="btn btn-sm btn-ghost">
                    View Full Ranking
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Hero;

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
import { useDateFormatting } from '../hooks/useDateFormatting';
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
  MdTrendingUp,
  MdVideoLibrary,
  MdVolumeUp,
} from 'react-icons/md';

// Simplified log type config for icons
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

function Hero() {
  const { user } = useUserDataStore();
  const { formatRelativeDate } = useDateFormatting();
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
        formattedDate: formatRelativeDate(log.date),
        formattedTime: formatTime(log.time, log.episodes),
      }));
  }, [logs, formatRelativeDate]);

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

  return (
    <div className="hero min-h-screen bg-gradient-to-br from-base-100 to-base-200 pt-20">
      {!user ? (
        <div className="hero min-h-screen bg-gradient-to-br from-base-100 via-base-200 to-base-300">
          <div className="hero-content text-center py-16 md:py-24">
            <div className="max-w-4xl">
              <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent leading-tight py-2">
                NihongoTracker
              </h1>
              <p className="text-xl md:text-2xl mb-8 text-base-content/80 max-w-3xl mx-auto">
                Gamify Your Japanese Immersion.
                <br />
                <span className="font-semibold">
                  Track Progress. Stay Motivated.
                </span>
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
                <Link className="btn btn-primary btn-lg" to="/register">
                  Start Your Journey for Free
                </Link>
                <Link className="btn btn-ghost btn-lg" to="/login">
                  I have an account
                </Link>
              </div>

              {/* Features Section */}
              <div className="py-12">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-10 text-left">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-primary/10 rounded-full">
                      <MdBook className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">Track Everything</h3>
                      <p className="text-base-content/70 mt-1">
                        Log reading, listening, and study time. From anime to
                        visual novels, we've got you covered.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-secondary/10 rounded-full">
                      <MdLeaderboard className="w-6 h-6 text-secondary" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">Visualize & Compete</h3>
                      <p className="text-base-content/70 mt-1">
                        See your progress with beautiful charts and climb the
                        leaderboards.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-accent/10 rounded-full">
                      <MdTrendingUp className="w-6 h-6 text-accent" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">Stay Motivated</h3>
                      <p className="text-base-content/70 mt-1">
                        Earn XP, level up, and maintain your immersion streak.
                        Learning Japanese has never been this fun.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        // New logged-in view
        <div className="hero-content w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="w-full space-y-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h1 className="text-3xl md:text-4xl font-bold text-base-content">
                  Welcome back, {user.username}!
                </h1>
                <p className="text-lg text-base-content/70 mt-1">
                  {randomGreeting}
                </p>
              </div>
              <div className="stats bg-base-100 shadow-lg">
                <div className="stat">
                  <div className="stat-title">Current Streak</div>
                  <div className="stat-value text-success">
                    {user.stats?.currentStreak ?? 0}
                  </div>
                  <div className="stat-desc">
                    day{user.stats?.currentStreak !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Link to="/createlog" className="btn btn-primary btn-lg flex-1">
                <MdAdd className="w-6 h-6" />
                Log Immersion
              </Link>
              <Link
                to={`/user/${user.username}`}
                className="btn btn-secondary btn-lg flex-1"
              >
                <MdPerson className="w-6 h-6" />
                View Profile
              </Link>
              <Link to="/ranking" className="btn btn-accent btn-lg flex-1">
                <MdLeaderboard className="w-6 h-6" />
                Leaderboards
              </Link>
            </div>

            {/* Main Dashboard Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left Column */}
              <div className="lg:col-span-2 space-y-8">
                {/* Monthly Progress */}
                <div className="card bg-base-100 shadow-xl">
                  <div className="card-body">
                    <h2 className="card-title">This Month's Immersion</h2>
                    <p className="text-sm text-base-content/60 -mt-2 mb-4">
                      Compared to the same period last month
                    </p>
                    <div className="stats stats-vertical md:stats-horizontal shadow w-full">
                      <div className="stat">
                        <div className="stat-title">Reading</div>
                        <div className="stat-value text-primary">
                          {immersionStats.currentMonth.reading}h
                        </div>
                        <div
                          className={`stat-desc flex items-center gap-1 ${
                            immersionStats.changes.reading > 0
                              ? 'text-success'
                              : immersionStats.changes.reading < 0
                                ? 'text-error'
                                : ''
                          }`}
                        >
                          {immersionStats.changes.reading !== 0 &&
                            (immersionStats.changes.reading > 0 ? (
                              <MdArrowUpward />
                            ) : (
                              <MdArrowDownward />
                            ))}
                          {immersionStats.changes.reading !== 0
                            ? `${Math.abs(immersionStats.changes.reading)}%`
                            : 'No change'}
                        </div>
                      </div>
                      <div className="stat">
                        <div className="stat-title">Listening</div>
                        <div className="stat-value text-secondary">
                          {immersionStats.currentMonth.listening}h
                        </div>
                        <div
                          className={`stat-desc flex items-center gap-1 ${
                            immersionStats.changes.listening > 0
                              ? 'text-success'
                              : immersionStats.changes.listening < 0
                                ? 'text-error'
                                : ''
                          }`}
                        >
                          {immersionStats.changes.listening !== 0 &&
                            (immersionStats.changes.listening > 0 ? (
                              <MdArrowUpward />
                            ) : (
                              <MdArrowDownward />
                            ))}
                          {immersionStats.changes.listening !== 0
                            ? `${Math.abs(immersionStats.changes.listening)}%`
                            : 'No change'}
                        </div>
                      </div>
                      <div className="stat">
                        <div className="stat-title">Total</div>
                        <div className="stat-value">
                          {immersionStats.currentMonth.total}h
                        </div>
                        <div
                          className={`stat-desc flex items-center gap-1 ${
                            immersionStats.changes.total > 0
                              ? 'text-success'
                              : immersionStats.changes.total < 0
                                ? 'text-error'
                                : ''
                          }`}
                        >
                          {immersionStats.changes.total !== 0 &&
                            (immersionStats.changes.total > 0 ? (
                              <MdArrowUpward />
                            ) : (
                              <MdArrowDownward />
                            ))}
                          {immersionStats.changes.total !== 0
                            ? `${Math.abs(immersionStats.changes.total)}%`
                            : 'No change'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Recent Activity */}
                <div className="card bg-base-100 shadow-xl">
                  <div className="card-body">
                    <h2 className="card-title">Recent Activity</h2>
                    <div className="space-y-4 mt-4">
                      {hoursError ? (
                        <div className="alert alert-error">
                          Error loading recent logs.
                        </div>
                      ) : recentLogs.length > 0 ? (
                        recentLogs.map((log) => {
                          const Icon = logTypeIcons[log.type] || MdBook;
                          return (
                            <div
                              key={log._id}
                              className="flex items-center justify-between p-3 bg-base-200 rounded-lg"
                            >
                              <div className="flex items-center gap-4">
                                <Icon className="w-6 h-6 text-primary" />
                                <div>
                                  <p className="font-semibold">
                                    {log.media?.title.contentTitleNative
                                      ? log.media.title.contentTitleNative
                                      : log.description}
                                  </p>
                                  <p className="text-sm text-base-content/60">
                                    {log.formattedTime} • {log.formattedDate}
                                  </p>
                                </div>
                              </div>
                              <div className="badge badge-outline">
                                +{log.xp} XP
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <p className="text-center text-base-content/70 py-4">
                          No recent logs. Time to immerse!
                        </p>
                      )}
                    </div>
                    <div className="card-actions justify-end mt-4">
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

              {/* Right Column */}
              <div className="space-y-8">
                {/* Leaderboard */}
                <div className="card bg-base-100 shadow-xl">
                  <div className="card-body">
                    <h2 className="card-title">Top 3 Ranking</h2>
                    <div className="overflow-x-auto">
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Rank</th>
                            <th>User</th>
                            <th>XP</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ranking?.map((rank, index) => (
                            <tr
                              key={rank.username}
                              className={
                                rank.username === user.username
                                  ? 'bg-primary/10 font-bold'
                                  : ''
                              }
                            >
                              <th>{index + 1}</th>
                              <td>
                                <Link
                                  to={`/user/${rank.username}`}
                                  className="link link-hover"
                                >
                                  {rank.username}
                                </Link>
                              </td>
                              <td>
                                {numberWithCommas(rank.stats?.userXp ?? 0)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="card-actions justify-end mt-4">
                      <Link to="/ranking" className="btn btn-sm btn-ghost">
                        View Full Ranking
                      </Link>
                    </div>
                  </div>
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

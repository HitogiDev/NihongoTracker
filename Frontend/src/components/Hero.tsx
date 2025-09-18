import { Link } from 'react-router-dom';
import { useUserDataStore } from '../store/userData';
import { useQuery } from '@tanstack/react-query';
import {
  getDashboardHoursFn,
  getRankingFn,
  getRecentLogsFn,
} from '../api/trackerApi';
import { useMemo, useRef, useEffect } from 'react';
import { gsap } from 'gsap';
import { numberWithCommas } from '../utils/utils';
import { useDateFormatting } from '../hooks/useDateFormatting';
import ClubRanking from './ClubRanking';
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
import {
  HiArrowRight,
  HiInformationCircle,
  HiCheck,
  HiUsers,
  HiXCircle,
  HiCheckCircle,
  HiClock,
  HiFlag,
  HiSearch,
  HiLightningBolt,
  HiHeart,
  HiEyeOff,
} from 'react-icons/hi';

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

  // Animation refs for landing page
  const heroRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const subtitleRef = useRef<HTMLParagraphElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);

  // GSAP animations for landing page
  useEffect(() => {
    if (
      !user &&
      heroRef.current &&
      titleRef.current &&
      subtitleRef.current &&
      ctaRef.current
    ) {
      const tl = gsap.timeline();

      // Set initial states
      gsap.set([titleRef.current, subtitleRef.current, ctaRef.current], {
        opacity: 0,
        y: 50,
      });

      // Animate elements in sequence
      tl.to(titleRef.current, {
        duration: 1.2,
        opacity: 1,
        y: 0,
        ease: 'back.out(1.7)',
      })
        .to(
          subtitleRef.current,
          {
            duration: 1,
            opacity: 1,
            y: 0,
            ease: 'power3.out',
          },
          '-=0.8'
        )
        .to(
          ctaRef.current,
          {
            duration: 0.8,
            opacity: 1,
            y: 0,
            ease: 'power2.out',
          },
          '-=0.5'
        );

      // Background floating animation
      const floatingElements = heroRef.current.querySelectorAll('.floating-bg');
      floatingElements.forEach((element, index) => {
        gsap.to(element, {
          duration: 2 + index * 0.5,
          y: -20,
          x: 10,
          rotation: 5,
          repeat: -1,
          yoyo: true,
          ease: 'power2.inOut',
          delay: index * 0.3,
        });
      });
    }
  }, [user]);

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
    <div className="min-h-screen bg-gradient-to-br from-base-100 to-base-200">
      {!user ? (
        // Amazing Landing Page for Unlogged Users
        <div
          ref={heroRef}
          className="relative min-h-screen bg-gradient-to-br from-primary/5 via-secondary/5 to-accent/5 overflow-hidden"
        >
          {/* Floating Background Elements */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="floating-bg absolute top-20 left-10 w-20 h-20 bg-primary/10 rounded-full blur-xl"></div>
            <div className="floating-bg absolute top-40 right-20 w-32 h-32 bg-secondary/10 rounded-full blur-xl"></div>
            <div className="floating-bg absolute bottom-40 left-1/4 w-16 h-16 bg-accent/10 rounded-full blur-xl"></div>
            <div className="floating-bg absolute bottom-20 right-1/3 w-24 h-24 bg-primary/10 rounded-full blur-xl"></div>
          </div>

          {/* Main Hero Section */}
          <section className="relative z-10 min-h-screen flex items-center justify-center px-4">
            <div className="max-w-6xl mx-auto text-center">
              <h1
                ref={titleRef}
                className="text-5xl md:text-7xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent mb-6"
              >
                Master Japanese Through
                <br />
                <span className="text-accent">Pure Immersion</span>
              </h1>

              <p
                ref={subtitleRef}
                className="text-xl md:text-2xl text-base-content/80 mb-12 max-w-3xl mx-auto leading-relaxed"
              >
                Track your anime, manga, and Japanese content consumption while
                building real language skills. Join thousands discovering the
                joy of natural language acquisition.
              </p>

              <div
                ref={ctaRef}
                className="flex flex-col sm:flex-row gap-6 justify-center items-center"
              >
                <Link to="/register">
                  <button className="btn btn-primary btn-lg px-12 py-4 text-lg shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105">
                    Start Your Journey
                    <HiArrowRight className="ml-2" />
                  </button>
                </Link>

                <Link to="/about">
                  <button className="btn btn-ghost btn-lg px-8 py-4 text-lg hover:bg-base-200 transition-all duration-300">
                    Learn More
                    <HiInformationCircle className="ml-2" />
                  </button>
                </Link>
              </div>

              {/* Trust Indicators */}
              <div className="mt-16 flex flex-wrap justify-center items-center gap-8 text-base-content/60">
                <div className="flex items-center gap-2">
                  <HiCheck className="text-success text-xl" />
                  <span>Basic Features Free Forever</span>
                </div>
                <div className="flex items-center gap-2">
                  <HiUsers className="text-primary text-xl" />
                  <span>Growing Community</span>
                </div>
                <div className="flex items-center gap-2">
                  <HiEyeOff className="text-accent text-xl" />
                  <span>No Ads, No Distractions</span>
                </div>
              </div>
            </div>
          </section>

          {/* Problem/Solution Section */}
          <section className="relative z-10 py-24 px-4">
            <div className="max-w-6xl mx-auto">
              <div className="grid md:grid-cols-2 gap-16 items-center">
                {/* Problem */}
                <div className="space-y-6 animate-fade-in-up">
                  <div className="badge badge-error badge-lg">The Problem</div>
                  <h2 className="text-3xl md:text-4xl font-bold text-base-content">
                    Traditional Japanese Learning
                    <span className="text-error"> Isn't Working</span>
                  </h2>
                  <ul className="space-y-4 text-lg text-base-content/80">
                    <li className="flex items-start gap-3">
                      <HiXCircle className="text-error text-xl mt-1 flex-shrink-0" />
                      <span>Endless grammar drills that don't stick</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <HiXCircle className="text-error text-xl mt-1 flex-shrink-0" />
                      <span>Textbook phrases you'll never actually use</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <HiXCircle className="text-error text-xl mt-1 flex-shrink-0" />
                      <span>No connection to real Japanese content</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <HiXCircle className="text-error text-xl mt-1 flex-shrink-0" />
                      <span>Progress feels impossible to measure</span>
                    </li>
                  </ul>
                </div>

                {/* Solution */}
                <div className="space-y-6 animate-fade-in-up animation-delay-200">
                  <div className="badge badge-success badge-lg">
                    The Solution
                  </div>
                  <h2 className="text-3xl md:text-4xl font-bold text-base-content">
                    Learn Through
                    <span className="text-success"> What You Love</span>
                  </h2>
                  <ul className="space-y-4 text-lg text-base-content/80">
                    <li className="flex items-start gap-3">
                      <HiCheckCircle className="text-success text-xl mt-1 flex-shrink-0" />
                      <span>Watch anime and read manga you actually enjoy</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <HiCheckCircle className="text-success text-xl mt-1 flex-shrink-0" />
                      <span>Learn naturally through immersion</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <HiCheckCircle className="text-success text-xl mt-1 flex-shrink-0" />
                      <span>Track every minute of progress</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <HiCheckCircle className="text-success text-xl mt-1 flex-shrink-0" />
                      <span>Build real comprehension skills</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {/* Features Section */}
          <section className="relative z-10 py-24 px-4 bg-base-100/50 backdrop-blur-sm">
            <div className="max-w-6xl mx-auto">
              <div className="text-center mb-16">
                <div className="badge badge-primary badge-lg mb-4">
                  Features
                </div>
                <h2 className="text-3xl md:text-5xl font-bold text-base-content mb-6">
                  Everything You Need to
                  <span className="text-primary"> Succeed</span>
                </h2>
                <p className="text-xl text-base-content/70 max-w-3xl mx-auto">
                  Powerful tracking tools designed specifically for
                  immersion-based Japanese learning
                </p>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                {/* Feature 1 */}
                <div className="card bg-base-100 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 animate-fade-in-up">
                  <div className="card-body text-center">
                    <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                      <HiClock className="text-3xl text-primary" />
                    </div>
                    <h3 className="card-title justify-center text-xl mb-3">
                      Smart Time Tracking
                    </h3>
                    <p className="text-base-content/70">
                      Log your anime episodes, manga chapters, and reading time
                      with intelligent duration estimates
                    </p>
                  </div>
                </div>

                {/* Feature 2 */}
                <div className="card bg-base-100 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 animate-fade-in-up animation-delay-100">
                  <div className="card-body text-center">
                    <div className="mx-auto w-16 h-16 bg-secondary/10 rounded-full flex items-center justify-center mb-4">
                      <MdTrendingUp className="text-3xl text-secondary" />
                    </div>
                    <h3 className="card-title justify-center text-xl mb-3">
                      Progress Analytics
                    </h3>
                    <p className="text-base-content/70">
                      Beautiful charts and insights showing your immersion
                      journey and skill development
                    </p>
                  </div>
                </div>

                {/* Feature 3 */}
                <div className="card bg-base-100 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 animate-fade-in-up animation-delay-200">
                  <div className="card-body text-center">
                    <div className="mx-auto w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mb-4">
                      <HiFlag className="text-3xl text-accent" />
                    </div>
                    <h3 className="card-title justify-center text-xl mb-3">
                      Goal Setting
                    </h3>
                    <p className="text-base-content/70">
                      Set daily targets for different types of content and build
                      consistent habits
                    </p>
                  </div>
                </div>

                {/* Feature 4 */}
                <div className="card bg-base-100 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 animate-fade-in-up animation-delay-300">
                  <div className="card-body text-center">
                    <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                      <HiSearch className="text-3xl text-primary" />
                    </div>
                    <h3 className="card-title justify-center text-xl mb-3">
                      Media Discovery
                    </h3>
                    <p className="text-base-content/70">
                      Find new anime and manga with integrated AniList search
                      and recommendations
                    </p>
                  </div>
                </div>

                {/* Feature 5 */}
                <div className="card bg-base-100 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 animate-fade-in-up animation-delay-400">
                  <div className="card-body text-center">
                    <div className="mx-auto w-16 h-16 bg-secondary/10 rounded-full flex items-center justify-center mb-4">
                      <HiLightningBolt className="text-3xl text-secondary" />
                    </div>
                    <h3 className="card-title justify-center text-xl mb-3">
                      Streak Tracking
                    </h3>
                    <p className="text-base-content/70">
                      Build momentum with daily streaks and consistency rewards
                    </p>
                  </div>
                </div>

                {/* Feature 6 */}
                <div className="card bg-base-100 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 animate-fade-in-up animation-delay-500">
                  <div className="card-body text-center">
                    <div className="mx-auto w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mb-4">
                      <HiHeart className="text-3xl text-accent" />
                    </div>
                    <h3 className="card-title justify-center text-xl mb-3">
                      Community Support
                    </h3>
                    <p className="text-base-content/70">
                      Connect with fellow learners and share your immersion
                      journey
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Final CTA Section */}
          <section className="relative z-10 py-24 px-4 bg-gradient-to-r from-primary/10 to-secondary/10">
            <div className="max-w-4xl mx-auto text-center">
              <h2 className="text-3xl md:text-5xl font-bold text-base-content mb-6">
                Ready to Transform Your
                <span className="text-primary"> Japanese Learning?</span>
              </h2>

              <p className="text-xl text-base-content/70 mb-12 max-w-2xl mx-auto">
                Join the immersion revolution. Start tracking your journey today
                and see real progress in weeks, not years.
              </p>

              <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
                <Link to="/register">
                  <button className="btn btn-primary btn-lg px-12 py-4 text-lg shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105">
                    Start Free Today
                    <HiArrowRight className="ml-2" />
                  </button>
                </Link>

                <div className="text-sm text-base-content/60">
                  No credit card required • Basic features free forever
                </div>
              </div>
            </div>
          </section>
        </div>
      ) : (
        // New logged-in view
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-8">
          <div className="w-full space-y-8">
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
                          const fullTitle =
                            log.media?.title?.contentTitleNative ||
                            log.description;
                          return (
                            <div
                              key={log._id}
                              className="flex items-center justify-between p-3 bg-base-200 rounded-lg gap-3"
                            >
                              <div className="flex items-center gap-4 flex-1 min-w-0">
                                <Icon className="w-6 h-6 text-primary flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  {log.media?.contentId && log.media?.type ? (
                                    <div
                                      className="tooltip tooltip-top"
                                      data-tip={fullTitle}
                                    >
                                      <Link
                                        to={`/${encodeURIComponent(log.media.type)}/${log.media.contentId}`}
                                        className="font-semibold text-base-content hover:text-primary transition-colors duration-200 no-underline hover:no-underline block truncate"
                                      >
                                        {fullTitle}
                                      </Link>
                                    </div>
                                  ) : (
                                    <div
                                      className="tooltip tooltip-top"
                                      data-tip={fullTitle}
                                    >
                                      <p className="font-semibold truncate">
                                        {fullTitle}
                                      </p>
                                    </div>
                                  )}
                                  <p className="text-sm text-base-content/60 truncate">
                                    {log.formattedTime} • {log.formattedDate}
                                  </p>
                                </div>
                              </div>
                              <div className="badge badge-outline flex-shrink-0">
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

                {/* Club Ranking */}
                <ClubRanking username={user.username} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Hero;

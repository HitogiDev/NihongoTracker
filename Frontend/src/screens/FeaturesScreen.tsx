import { Link } from 'react-router-dom';
import { useState } from 'react';
import {
  Book,
  CircleStar,
  TrendingUp,
  Users,
  Timer,
  Calendar,
  BarChart,
  Trophy,
  Gauge,
  GitCompare,
  Layers,
  ChartArea,
  ChartLine,
  ClipboardList,
  Settings,
  Newspaper,
  Eye,
  Share2,
  Search,
  CloudUpload,
  MonitorSmartphone,
  Heart,
  ChevronDown,
  ChevronUp,
  // ArrowRight,
} from 'lucide-react';

interface FeatureCategory {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  color: string;
  features: Feature[];
}

interface Feature {
  title: string;
  description: string;
  icon: React.ElementType;
  highlight?: boolean;
  planned?: boolean;
}

function FeaturesScreen() {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  const featureCategories: FeatureCategory[] = [
    {
      id: 'tracking',
      title: 'Smart Immersion Tracking',
      description: 'Comprehensive logging system for all your Japanese content',
      icon: Layers,
      color: 'text-primary',
      features: [
        {
          title: 'Multi-Media Support',
          description:
            'Track anime, manga, visual novels, books, audiobooks, movies, TV shows, and more',
          icon: Book,
        },
        {
          title: 'Automatic Duration Estimates',
          description:
            'Smart time calculation for episodes and reading sessions',
          icon: Timer,
        },
        {
          title: 'Character Count Tracking',
          description:
            'Monitor characters read for visual novels, books, and manga',
          icon: ChartLine,
        },
        {
          title: 'Episode & Page Progress',
          description: 'Keep track of episodes watched and pages read',
          icon: ClipboardList,
        },
        {
          title: 'Media Database Integration',
          description:
            'Automatic matching with AniList, VNDB and our extensive database for easy logging',
          icon: Search,
        },
        {
          title: 'Import/Export Logs',
          description: 'Import from other trackers and export your data',
          icon: CloudUpload,
        },
        {
          title: 'TextHooker Integration',
          description:
            'Track VN reading sessions in real time with character and line analytics synced to your logs',
          icon: Book,
          highlight: true,
        },
      ],
    },
    {
      id: 'analytics',
      title: 'Advanced Analytics & Statistics',
      description: 'Detailed insights into your learning progress and patterns',
      icon: ChartArea,
      color: 'text-secondary',
      features: [
        {
          title: 'Reading Speed Analysis',
          description: 'Track your characters-per-hour improvement over time',
          icon: Gauge,
          highlight: true,
        },
        {
          title: 'Progress Charts & Graphs',
          description: 'Beautiful visualizations of your immersion journey',
          icon: BarChart,
        },
        {
          title: 'Time-Based Statistics',
          description: 'Daily, weekly, monthly, and yearly progress breakdowns',
          icon: Newspaper,
        },
        {
          title: 'Media-Specific Stats',
          description: 'Detailed statistics for each anime, manga, or book',
          icon: Layers,
        },
        {
          title: 'Type-Based Analysis',
          description: 'Compare your progress across different media types',
          icon: GitCompare,
        },
        {
          title: 'Completion Percentages',
          description: "See how much of each media you've completed",
          icon: ChartLine,
        },
      ],
    },
    {
      id: 'gamification',
      title: 'Gamification & Motivation',
      description: 'RPG-style progression system to keep you engaged',
      icon: CircleStar,
      color: 'text-accent',
      features: [
        {
          title: 'XP & Leveling System',
          description:
            'Earn experience points and level up your Japanese skills',
          icon: CircleStar,
          highlight: true,
        },
        {
          title: 'Daily Streak Tracking',
          description: 'Build and maintain consistent immersion habits',
          icon: Calendar,
        },
        {
          title: 'Achievement System',
          description: 'Unlock milestones and celebrate your progress',
          icon: CircleStar,
          planned: true,
        },
        {
          title: 'Daily & Long-term Goals',
          description: 'Set targets for different media types and time periods',
          icon: Calendar,
        },
        {
          title: 'Progress Indicators',
          description: 'Visual feedback on your daily and monthly targets',
          icon: TrendingUp,
        },
        {
          title: 'Motivation Dashboard',
          description: 'See your achievements, streaks, and upcoming goals',
          icon: Heart,
        },
      ],
    },
    {
      id: 'social',
      title: 'Social Features & Competition',
      description: 'Connect with fellow learners and compare progress',
      icon: Users,
      color: 'text-info',
      features: [
        {
          title: 'Global Rankings',
          description:
            'Compete on leaderboards by XP, time, and different metrics',
          icon: Trophy,
          highlight: true,
        },
        {
          title: 'User Comparison',
          description:
            'Compare your stats with other learners on specific media',
          icon: GitCompare,
        },
        {
          title: 'Profile Pages',
          description: 'Showcase your immersion journey and statistics',
          icon: Users,
        },
        {
          title: 'Shared Media Pages',
          description: 'See community stats and recent activity for any media',
          icon: Eye,
        },
        {
          title: 'Log Sharing',
          description:
            'Share interesting logs and discoveries with the community',
          icon: Share2,
        },
        {
          title: 'Recent Activity Feed',
          description: 'See what other learners are reading and watching',
          icon: Newspaper,
        },
      ],
    },
    {
      id: 'clubs',
      title: 'Immersion Clubs',
      description: 'Join or create communities around specific content',
      icon: Users,
      color: 'text-warning',
      features: [
        {
          title: 'Create & Join Clubs',
          description: 'Form groups around anime, manga, or book clubs',
          icon: Users,
        },
        {
          title: 'Club Media Tracking',
          description: 'Collectively track progress on club-selected content',
          icon: Layers,
        },
        {
          title: 'Member Rankings',
          description: 'See how you rank against other club members',
          icon: Trophy,
        },
        {
          title: 'Club Statistics',
          description: 'View aggregated stats for all club members',
          icon: BarChart,
        },
        {
          title: 'Media Voting',
          description: 'Vote on what content the club should read/watch next',
          icon: Heart,
        },
        {
          title: 'Activity Tracking',
          description: 'Monitor club engagement and progress over time',
          icon: TrendingUp,
        },
      ],
    },
    {
      id: 'tools',
      title: 'Productivity Tools',
      description: 'Additional features to enhance your learning experience',
      icon: Settings,
      color: 'text-success',
      features: [
        {
          title: 'Time Calculator',
          description:
            'Convert between different time units and estimate reading times',
          icon: Timer,
        },
        {
          title: 'Media Discovery',
          description:
            'Find new content based on your preferences and difficulty',
          icon: Search,
        },
        {
          title: 'Personal Lists',
          description: 'Create custom lists of media to track and organize',
          icon: ClipboardList,
        },
        {
          title: 'Goal Management',
          description: 'Set up and track both daily and long-term objectives',
          icon: ClipboardList,
        },
        {
          title: 'Data Export',
          description: 'Export your logs and statistics for external analysis',
          icon: CloudUpload,
        },
        {
          title: 'Multi-Device Sync',
          description: 'Access your data seamlessly across all devices',
          icon: MonitorSmartphone,
        },
      ],
    },
  ];

  const toggleCategory = (categoryId: string) => {
    setExpandedCategory(expandedCategory === categoryId ? null : categoryId);
  };

  return (
    <div className="pt-16 bg-base-100 min-h-screen">
      {/* ─── Hero ─── */}
      <section className="py-24 px-4 text-center">
        <div className="max-w-3xl mx-auto">
          <span className="badge badge-primary badge-outline mb-6">
            Complete Feature Set
          </span>
          <h1 className="text-4xl md:text-6xl font-bold text-base-content mb-6 leading-tight">
            Everything you need to{' '}
            <span className="text-primary">master Japanese</span>
          </h1>
          <p className="text-xl text-base-content/60 mb-10 leading-relaxed">
            Every feature is built specifically for Japanese immersion learners.
            From graphs to gamification, and texthooker to clubs, we got you
            covered.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link to="/register" className="pointer-events-none">
              <button
                disabled
                className="btn btn-primary btn-lg btn-disabled gap-2 px-10"
              >
                {/* Start for Free */}
                {/* <ArrowRight size={18} /> */}
                Coming Soon!
              </button>
            </Link>
            <Link to="/ranking">
              <button className="btn btn-ghost btn-lg px-8">
                View Leaderboard
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* ─── Stats strip ─── */}
      <section className="py-10 px-4 bg-base-200/50 border-y border-base-300/50">
        <div className="max-w-3xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          <div>
            <div className="text-3xl font-bold text-primary">35+</div>
            <div className="text-sm text-base-content/50 mt-1">Features</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-secondary">6</div>
            <div className="text-sm text-base-content/50 mt-1">Media Types</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-accent">&infin;</div>
            <div className="text-sm text-base-content/50 mt-1">
              Progress Tracking
            </div>
          </div>
          <div>
            <div className="text-3xl font-bold text-success">100%</div>
            <div className="text-sm text-base-content/50 mt-1">
              Free Core Features
            </div>
          </div>
        </div>
      </section>

      {/* ─── Feature Categories ─── */}
      <section className="py-20 px-4">
        <div className="max-w-5xl mx-auto space-y-4">
          {featureCategories.map((category) => (
            <div
              key={category.id}
              className="rounded-2xl border border-base-300 overflow-hidden bg-base-100 shadow-sm hover:shadow-md transition-shadow duration-300"
            >
              {/* Header */}
              <button
                className="w-full px-6 py-5 flex items-center justify-between gap-4 hover:bg-base-200/40 transition-colors duration-200 text-left"
                onClick={() => toggleCategory(category.id)}
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div
                    className={`p-3 rounded-xl bg-base-200 ${category.color} shrink-0`}
                  >
                    <category.icon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-lg font-bold text-base-content">
                      {category.title}
                    </h3>
                    <p className="text-sm text-base-content/55">
                      {category.description}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="badge badge-outline badge-sm hidden sm:flex">
                    {category.features.length} features
                  </span>
                  {expandedCategory === category.id ? (
                    <ChevronUp className="w-5 h-5 text-base-content/50" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-base-content/50" />
                  )}
                </div>
              </button>

              {/* Feature grid */}
              {expandedCategory === category.id && (
                <div className="px-6 pb-6 border-t border-base-300/60">
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-5">
                    {category.features.map((feature, i) => (
                      <div
                        key={i}
                        className={`flex items-start gap-3 p-4 rounded-xl border ${
                          feature.highlight
                            ? 'border-primary/25 bg-primary/5'
                            : 'border-base-300/60 bg-base-200/30'
                        }`}
                      >
                        <div className="w-8 h-8 rounded-lg bg-base-100 border border-base-300/60 flex items-center justify-center shrink-0 mt-0.5">
                          <feature.icon size={15} className={category.color} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-base-content">
                              {feature.title}
                            </span>
                            {feature.planned && (
                              <span className="badge badge-warning badge-xs">
                                Planned
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-base-content/55 mt-0.5 leading-relaxed">
                            {feature.description}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ─── How it works ─── */}
      <section className="py-20 px-4 bg-base-200/30">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <span className="badge badge-accent badge-outline mb-4">
              The Complete System
            </span>
            <h2 className="text-3xl md:text-4xl font-bold text-base-content">
              How it all works together
            </h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              {
                Icon: Layers,
                color: 'bg-primary/15 text-primary',
                step: '1',
                title: 'Track Everything',
                desc: 'Log anime, manga, books, and any Japanese content with detailed metrics.',
              },
              {
                Icon: ChartArea,
                color: 'bg-secondary/15 text-secondary',
                step: '2',
                title: 'Analyze Progress',
                desc: 'Get insights into your reading speed, time investment, and skill growth.',
              },
              {
                Icon: CircleStar,
                color: 'bg-accent/15 text-accent',
                step: '3',
                title: 'Stay Motivated',
                desc: 'Earn XP, maintain streaks, and achieve goals while building habits.',
              },
              {
                Icon: Users,
                color: 'bg-info/15 text-info',
                step: '4',
                title: 'Connect & Compete',
                desc: 'Join clubs, compare progress, and climb leaderboards.',
              },
            ].map(({ Icon, color, step, title, desc }) => (
              <div key={step} className="text-center">
                <div
                  className={`w-16 h-16 ${color} rounded-full flex items-center justify-center mx-auto mb-4`}
                >
                  <Icon className="w-8 h-8" />
                </div>
                <p className="text-xs font-semibold text-base-content/35 uppercase tracking-widest mb-1">
                  Step {step}
                </p>
                <h3 className="font-bold text-base-content mb-2">{title}</h3>
                <p className="text-sm text-base-content/55 leading-relaxed">
                  {desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="py-28 px-4 bg-gradient-to-b from-base-100 to-base-200/60">
        <div className="max-w-xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-base-content mb-4">
            Ready to start?
          </h2>
          <p className="text-lg text-base-content/55 mb-10">
            Free, start tracking your immersion.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link to="/register" className="pointer-events-none">
              <button
                disabled
                className="btn btn-primary btn-lg btn-disabled px-12"
              >
                Coming Soon!
              </button>
            </Link>
            <Link to="/ranking">
              <button className="btn btn-ghost btn-lg">
                Browse rankings →
              </button>
            </Link>
          </div>
          <p className="mt-8 text-sm text-base-content/50">
            Made with ❤️ by a fellow learner
          </p>
        </div>
      </section>
    </div>
  );
}

export default FeaturesScreen;

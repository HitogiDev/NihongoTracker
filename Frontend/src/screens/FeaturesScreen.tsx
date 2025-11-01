import { Link } from 'react-router-dom';
import { useState } from 'react';
import {
  MdBook,
  MdStars,
  MdTrendingUp,
  MdLeaderboard,
  MdPeople,
  MdTimer,
  MdCalendarToday,
  MdBarChart,
  MdSpeed,
  MdCompareArrows,
  MdGroup,
  MdLibraryBooks,
  MdAnalytics,
  MdShowChart,
  MdAssignment,
  MdSettings,
  MdTimeline,
  MdVisibility,
  MdShare,
  MdSearch,
  MdCloudUpload,
  MdDevices,
  MdFavorite,
  // MdKeyboardArrowRight,
  MdExpandMore,
  MdExpandLess,
} from 'react-icons/md';

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
      icon: MdLibraryBooks,
      color: 'text-primary',
      features: [
        {
          title: 'Multi-Media Support',
          description:
            'Track anime, manga, visual novels, books, audiobooks, movies, TV shows, and more',
          icon: MdBook,
        },
        {
          title: 'Automatic Duration Estimates',
          description:
            'Smart time calculation for episodes and reading sessions',
          icon: MdTimer,
        },
        {
          title: 'Character Count Tracking',
          description:
            'Monitor characters read for visual novels, books, and manga',
          icon: MdShowChart,
        },
        {
          title: 'Episode & Page Progress',
          description: 'Keep track of episodes watched and pages read',
          icon: MdAssignment,
        },
        {
          title: 'Media Database Integration',
          description:
            'Automatic matching with AniList, VNDB and our extensive database for easy logging',
          icon: MdSearch,
        },
        {
          title: 'Import/Export Logs',
          description: 'Import from other trackers and export your data',
          icon: MdCloudUpload,
        },
      ],
    },
    {
      id: 'analytics',
      title: 'Advanced Analytics & Statistics',
      description: 'Detailed insights into your learning progress and patterns',
      icon: MdAnalytics,
      color: 'text-secondary',
      features: [
        {
          title: 'Reading Speed Analysis',
          description: 'Track your characters-per-hour improvement over time',
          icon: MdSpeed,
          highlight: true,
        },
        {
          title: 'Progress Charts & Graphs',
          description: 'Beautiful visualizations of your immersion journey',
          icon: MdBarChart,
        },
        {
          title: 'Time-Based Statistics',
          description: 'Daily, weekly, monthly, and yearly progress breakdowns',
          icon: MdTimeline,
        },
        {
          title: 'Media-Specific Stats',
          description: 'Detailed statistics for each anime, manga, or book',
          icon: MdLibraryBooks,
        },
        {
          title: 'Type-Based Analysis',
          description: 'Compare your progress across different media types',
          icon: MdCompareArrows,
        },
        {
          title: 'Completion Percentages',
          description: "See how much of each media you've completed",
          icon: MdShowChart,
        },
      ],
    },
    {
      id: 'gamification',
      title: 'Gamification & Motivation',
      description: 'RPG-style progression system to keep you engaged',
      icon: MdStars,
      color: 'text-accent',
      features: [
        {
          title: 'XP & Leveling System',
          description:
            'Earn experience points and level up your Japanese skills',
          icon: MdStars,
          highlight: true,
        },
        {
          title: 'Daily Streak Tracking',
          description: 'Build and maintain consistent immersion habits',
          icon: MdCalendarToday,
        },
        {
          title: 'Achievement System',
          description: 'Unlock milestones and celebrate your progress',
          icon: MdStars,
          planned: true,
        },
        {
          title: 'Daily & Long-term Goals',
          description: 'Set targets for different media types and time periods',
          icon: MdCalendarToday,
        },
        {
          title: 'Progress Indicators',
          description: 'Visual feedback on your daily and monthly targets',
          icon: MdTrendingUp,
        },
        {
          title: 'Motivation Dashboard',
          description: 'See your achievements, streaks, and upcoming goals',
          icon: MdFavorite,
        },
      ],
    },
    {
      id: 'social',
      title: 'Social Features & Competition',
      description: 'Connect with fellow learners and compare progress',
      icon: MdPeople,
      color: 'text-info',
      features: [
        {
          title: 'Global Rankings',
          description:
            'Compete on leaderboards by XP, time, and different metrics',
          icon: MdLeaderboard,
          highlight: true,
        },
        {
          title: 'User Comparison',
          description:
            'Compare your stats with other learners on specific media',
          icon: MdCompareArrows,
        },
        {
          title: 'Profile Pages',
          description: 'Showcase your immersion journey and statistics',
          icon: MdPeople,
        },
        {
          title: 'Shared Media Pages',
          description: 'See community stats and recent activity for any media',
          icon: MdVisibility,
        },
        {
          title: 'Log Sharing',
          description:
            'Share interesting logs and discoveries with the community',
          icon: MdShare,
        },
        {
          title: 'Recent Activity Feed',
          description: 'See what other learners are reading and watching',
          icon: MdTimeline,
        },
      ],
    },
    {
      id: 'clubs',
      title: 'Immersion Clubs',
      description: 'Join or create communities around specific content',
      icon: MdGroup,
      color: 'text-warning',
      features: [
        {
          title: 'Create & Join Clubs',
          description: 'Form groups around anime, manga, or book clubs',
          icon: MdGroup,
        },
        {
          title: 'Club Media Tracking',
          description: 'Collectively track progress on club-selected content',
          icon: MdLibraryBooks,
        },
        {
          title: 'Member Rankings',
          description: 'See how you rank against other club members',
          icon: MdLeaderboard,
        },
        {
          title: 'Club Statistics',
          description: 'View aggregated stats for all club members',
          icon: MdBarChart,
        },
        {
          title: 'Media Voting',
          description: 'Vote on what content the club should read/watch next',
          icon: MdFavorite,
        },
        {
          title: 'Activity Tracking',
          description: 'Monitor club engagement and progress over time',
          icon: MdTrendingUp,
        },
      ],
    },
    {
      id: 'tools',
      title: 'Productivity Tools',
      description: 'Additional features to enhance your learning experience',
      icon: MdSettings,
      color: 'text-success',
      features: [
        {
          title: 'Time Calculator',
          description:
            'Convert between different time units and estimate reading times',
          icon: MdTimer,
        },
        {
          title: 'Media Discovery',
          description:
            'Find new content based on your preferences and difficulty',
          icon: MdSearch,
        },
        {
          title: 'Personal Lists',
          description: 'Create custom lists of media to track and organize',
          icon: MdAssignment,
        },
        {
          title: 'Goal Management',
          description: 'Set up and track both daily and long-term objectives',
          icon: MdAssignment,
        },
        {
          title: 'Data Export',
          description: 'Export your logs and statistics for external analysis',
          icon: MdCloudUpload,
        },
        {
          title: 'Multi-Device Sync',
          description: 'Access your data seamlessly across all devices',
          icon: MdDevices,
        },
      ],
    },
  ];

  const toggleCategory = (categoryId: string) => {
    setExpandedCategory(expandedCategory === categoryId ? null : categoryId);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-base-100 via-base-200 to-base-300">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        {/* Floating background elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-4 -right-4 w-24 h-24 bg-primary/5 rounded-full blur-xl animate-bounce-in delay-1000"></div>
          <div className="absolute top-1/4 -left-8 w-32 h-32 bg-secondary/5 rounded-full blur-xl animate-bounce-in delay-1200"></div>
          <div className="absolute bottom-1/3 right-1/4 w-20 h-20 bg-accent/5 rounded-full blur-xl animate-bounce-in delay-1400"></div>
          <div className="absolute top-1/2 left-1/3 w-16 h-16 bg-info/5 rounded-full blur-xl animate-bounce-in delay-800"></div>
          <div className="absolute bottom-1/4 left-1/5 w-28 h-28 bg-warning/5 rounded-full blur-xl animate-bounce-in delay-600"></div>
        </div>

        <div className="relative z-10 py-24 px-4">
          <div className="max-w-6xl mx-auto text-center">
            <div className="badge badge-primary badge-lg mb-6 animate-fade-in-up">
              Complete Feature Set
            </div>
            <h1 className="text-4xl md:text-6xl font-bold text-base-content mb-6 animate-fade-in-up delay-200">
              Everything You Need to
              <span className="text-primary"> Master Japanese</span>
            </h1>
            <p className="text-xl md:text-2xl text-base-content/70 max-w-4xl mx-auto leading-relaxed mb-12 animate-fade-in-up delay-400">
              Discover all the powerful features that make NihongoTracker the
              ultimate companion for your Japanese immersion journey. From smart
              tracking to social competition, we've got every aspect covered.
            </p>

            {/* Quick stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto animate-fade-in-up delay-600">
              <div className="text-center hover-scale">
                <div className="text-3xl font-bold text-primary">35+</div>
                <div className="text-sm text-base-content/60">Features</div>
              </div>
              <div className="text-center hover-scale">
                <div className="text-3xl font-bold text-secondary">6</div>
                <div className="text-sm text-base-content/60">Media Types</div>
              </div>
              <div className="text-center hover-scale">
                <div className="text-3xl font-bold text-accent">∞</div>
                <div className="text-sm text-base-content/60">
                  Progress Tracking
                </div>
              </div>
              <div className="text-center hover-scale">
                <div className="text-3xl font-bold text-info">100%</div>
                <div className="text-sm text-base-content/60">
                  Free Core Features
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Feature Categories */}
      <div className="py-24 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-base-content mb-6 animate-fade-in-up">
              Comprehensive Feature Set
            </h2>
            <p className="text-lg text-base-content/70 max-w-3xl mx-auto animate-fade-in-up delay-200">
              Every feature is designed specifically for Japanese immersion
              learning, built by a learner who understands the journey.
            </p>
          </div>

          <div className="space-y-8 stagger-children">
            {featureCategories.map((category, categoryIndex) => (
              <div
                key={category.id}
                className="card bg-base-100 shadow-xl hover:shadow-2xl transition-all duration-300 hover-lift animate-fade-in-up"
                style={{ animationDelay: `${0.4 + categoryIndex * 0.1}s` }}
              >
                <div className="card-body p-0">
                  {/* Category Header */}
                  <div
                    className="p-8 cursor-pointer hover:bg-base-200/50 transition-colors duration-300"
                    onClick={() => toggleCategory(category.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-6">
                        <div
                          className={`p-4 rounded-xl bg-base-200/50 ${category.color}`}
                        >
                          <category.icon className="w-8 h-8" />
                        </div>
                        <div>
                          <h3 className="text-2xl font-bold text-base-content mb-2">
                            {category.title}
                          </h3>
                          <p className="text-base-content/70 text-lg">
                            {category.description}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="badge badge-outline badge-lg">
                          {category.features.length} features
                        </div>
                        <div className="btn btn-circle btn-ghost">
                          {expandedCategory === category.id ? (
                            <MdExpandLess className="w-6 h-6" />
                          ) : (
                            <MdExpandMore className="w-6 h-6" />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Feature List */}
                  {expandedCategory === category.id && (
                    <div className="px-8 pb-8 animate-slide-down">
                      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 stagger-children">
                        {category.features.map((feature, featureIndex) => (
                          <div
                            key={featureIndex}
                            className={`p-6 rounded-xl border transition-all duration-300 hover:shadow-lg hover:-translate-y-1 hover-lift animate-fade-in-up ${
                              feature.highlight
                                ? 'border-primary/30 bg-primary/5 hover:border-primary/50'
                                : 'border-base-300 bg-base-50 hover:border-base-400'
                            }`}
                            style={{
                              animationDelay: `${featureIndex * 0.05}s`,
                            }}
                          >
                            <div className="flex items-start gap-4">
                              <div
                                className={`p-3 rounded-lg hover-scale ${feature.highlight ? 'bg-primary/20 text-primary' : 'bg-base-200/50 text-base-content/70'}`}
                              >
                                <feature.icon className="w-6 h-6" />
                              </div>
                              <div className="flex-1">
                                <h4 className="font-bold text-base-content mb-2 flex items-center gap-2">
                                  {feature.title}
                                  {feature.highlight && (
                                    <span className="badge badge-primary badge-xs">
                                      Popular
                                    </span>
                                  )}
                                  {feature.planned && (
                                    <span className="badge badge-warning badge-xs">
                                      Planned
                                    </span>
                                  )}
                                </h4>
                                <p className="text-sm text-base-content/70 leading-relaxed">
                                  {feature.description}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* How It All Works Together */}
      <div className="py-24 px-4 bg-base-200/50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <div className="badge badge-accent badge-lg mb-4 animate-fade-in-up">
              The Complete System
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-base-content mb-6 animate-fade-in-up delay-200">
              How It All Works Together
            </h2>
            <p className="text-lg text-base-content/70 max-w-3xl mx-auto animate-fade-in-up delay-400">
              Every feature is designed to work in harmony, creating a
              comprehensive ecosystem for your Japanese learning journey.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 stagger-children">
            <div className="text-center animate-fade-in-up delay-600 hover-lift">
              <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-6 hover-scale">
                <MdLibraryBooks className="w-10 h-10 text-primary" />
              </div>
              <h3 className="text-xl font-bold mb-3">1. Track Everything</h3>
              <p className="text-base-content/70">
                Log your anime, manga, books, and any Japanese content with
                detailed metrics.
              </p>
            </div>

            <div className="text-center animate-fade-in-up delay-800 hover-lift">
              <div className="w-20 h-20 bg-secondary/20 rounded-full flex items-center justify-center mx-auto mb-6 hover-scale">
                <MdAnalytics className="w-10 h-10 text-secondary" />
              </div>
              <h3 className="text-xl font-bold mb-3">2. Analyze Progress</h3>
              <p className="text-base-content/70">
                Get detailed insights into your reading speed, time investment,
                and skill development.
              </p>
            </div>

            <div className="text-center animate-fade-in-up delay-1000 hover-lift">
              <div className="w-20 h-20 bg-accent/20 rounded-full flex items-center justify-center mx-auto mb-6 hover-scale">
                <MdStars className="w-10 h-10 text-accent" />
              </div>
              <h3 className="text-xl font-bold mb-3">3. Stay Motivated</h3>
              <p className="text-base-content/70">
                Earn XP, maintain streaks, and achieve goals while building
                consistent habits.
              </p>
            </div>

            <div className="text-center animate-fade-in-up delay-1200 hover-lift">
              <div className="w-20 h-20 bg-info/20 rounded-full flex items-center justify-center mx-auto mb-6 hover-scale">
                <MdPeople className="w-10 h-10 text-info" />
              </div>
              <h3 className="text-xl font-bold mb-3">4. Connect & Compete</h3>
              <p className="text-base-content/70">
                Join clubs, compare progress, and climb leaderboards with fellow
                learners.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="py-24 px-4 bg-gradient-to-r from-primary/10 to-secondary/10">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-5xl font-bold text-base-content mb-6 animate-fade-in-up">
            Ready to Experience
            <span className="text-primary"> All These Features?</span>
          </h2>

          <p className="text-xl text-base-content/70 mb-12 max-w-2xl mx-auto animate-fade-in-up delay-200">
            Join hundreds of Japanese learners who are already using these
            powerful features to accelerate their journey. Start tracking your
            immersion today.
          </p>

          <div className="flex flex-col sm:flex-row gap-6 justify-center items-center animate-fade-in-up delay-400">
            <Link to="/register">
              <button
                disabled
                className="btn btn-disabled btn-primary btn-lg px-12 py-4 text-lg shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 hover-glow animate-pulse-glow"
              >
                Coming Soon!
                {/*<MdKeyboardArrowRight className="ml-2 w-6 h-6" />*/}
              </button>
            </Link>

            <Link to="/login">
              <button className="btn btn-ghost btn-lg px-8 py-4 text-lg hover:bg-base-200 transition-all duration-300 hover-scale">
                Already Have an Account?
              </button>
            </Link>
          </div>

          <div className="flex flex-wrap justify-center items-center gap-6 mt-12 text-base-content/60 animate-fade-in-up delay-600 stagger-children">
            <span className="flex items-center gap-2 hover-scale animate-fade-in">
              <div className="w-2 h-2 bg-success rounded-full"></div>
              Core Features Free Forever
            </span>
            <span className="flex items-center gap-2 hover-scale animate-fade-in">
              <div className="w-2 h-2 bg-primary rounded-full"></div>
              No Ads or Tracking
            </span>
            <span className="flex items-center gap-2 hover-scale animate-fade-in">
              <div className="w-2 h-2 bg-secondary rounded-full"></div>
              Built for Immersion Learners
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default FeaturesScreen;

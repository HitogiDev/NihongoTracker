import { Link } from 'react-router-dom';
import {
  MdFavorite,
  MdPeople,
  MdLightbulb,
  MdSecurity,
  MdMonetizationOn,
  MdTrendingUp,
  MdGamepad,
  MdBook,
  MdMovie,
  MdPlayArrow,
} from 'react-icons/md';

function AboutScreen() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-base-100 via-base-200 to-base-300 pt-16">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-6xl mx-auto">
          {/* Hero Section */}
          <div className="text-center mb-20 animate-fade-in-up">
            <h1 className="text-5xl md:text-6xl font-bold text-primary mb-6">
              Hi there, fellow Japanese learner! 👋
            </h1>
            <p className="text-xl md:text-2xl text-base-content/80 max-w-3xl mx-auto leading-relaxed">
              I'm a solo developer and Japanese learner who got tired of using
              spreadsheets and Discord bots and built something{' '}
              <span className="font-semibold text-primary">actually fun</span>{' '}
              for tracking immersion.
            </p>
          </div>

          {/* Our Story */}
          <div className="mb-20 animate-fade-in-up delay-200">
            <div className="card bg-base-100 shadow-2xl">
              <div className="card-body p-8 md:p-12">
                <h2 className="text-3xl md:text-4xl font-bold text-center mb-8 text-primary">
                  <MdFavorite className="inline w-8 h-8 mr-2" />
                  My Story
                </h2>
                <div className="prose prose-lg max-w-none text-center">
                  <p className="text-xl text-base-content/90 mb-6">
                    Remember when you started learning Japanese? The excitement
                    of understanding your first anime without subtitles? I do
                    too. I also remember the pain of trying to track my
                    progress. All the spreadsheets, bots, and apps I tried
                    lacked features I needed or made tracking feel like a chore.
                  </p>
                  <p className="text-lg text-base-content/80 mb-6">
                    So I built NihongoTracker - not as a business, but as a love
                    letter to the Japanese learning community. It's the tool I
                    wished I had when I started my own immersion journey.
                  </p>
                  <div className="bg-primary/10 rounded-xl p-6 text-base-content/90">
                    <p className="text-lg font-medium mb-2">
                      "Learning Japanese should feel like an adventure, not a
                      spreadsheet."
                    </p>
                    <p className="text-sm text-base-content/70">
                      - Me, probably at 3 AM while coding this
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Our Values */}
          <div className="mb-20 animate-fade-in-up delay-400">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-12 text-primary">
              What I Believe In
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              <div className="card bg-base-100 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2">
                <div className="card-body text-center">
                  <div className="w-16 h-16 bg-success/20 rounded-full flex items-center justify-center mb-4 mx-auto">
                    <MdMonetizationOn className="w-8 h-8 text-success" />
                  </div>
                  <h3 className="text-xl font-bold mb-3">
                    Core Features Free Forever
                  </h3>
                  <p className="text-base-content/80">
                    Learning Japanese is expensive enough. Your progress tracker
                    shouldn't be. The essential features are free forever, with
                    optional donation-supported enhancements that don't affect
                    basic functionality.
                  </p>
                </div>
              </div>

              <div className="card bg-base-100 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2">
                <div className="card-body text-center">
                  <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mb-4 mx-auto">
                    <MdSecurity className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold mb-3">
                    No Ads, No Distractions
                  </h3>
                  <p className="text-base-content/80">
                    Focus on your learning without ads, popups, or tracking. The
                    only tracking being done is your own progress!
                  </p>
                </div>
              </div>

              <div className="card bg-base-100 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2">
                <div className="card-body text-center">
                  <div className="w-16 h-16 bg-secondary/20 rounded-full flex items-center justify-center mb-4 mx-auto">
                    <MdPeople className="w-8 h-8 text-secondary" />
                  </div>
                  <h3 className="text-xl font-bold mb-3">Learner First</h3>
                  <p className="text-base-content/80">
                    I'm a learner too. Every feature is built with real
                    learners' needs in mind, not corporate metrics or investor
                    demands.
                  </p>
                </div>
              </div>

              <div className="card bg-base-100 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2">
                <div className="card-body text-center">
                  <div className="w-16 h-16 bg-accent/20 rounded-full flex items-center justify-center mb-4 mx-auto">
                    <MdLightbulb className="w-8 h-8 text-accent" />
                  </div>
                  <h3 className="text-xl font-bold mb-3">Keep It Simple</h3>
                  <p className="text-base-content/80">
                    No overwhelming dashboards or confusing features. Just the
                    tools you need to track and stay motivated.
                  </p>
                </div>
              </div>

              <div className="card bg-base-100 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2">
                <div className="card-body text-center">
                  <div className="w-16 h-16 bg-warning/20 rounded-full flex items-center justify-center mb-4 mx-auto">
                    <MdGamepad className="w-8 h-8 text-warning" />
                  </div>
                  <h3 className="text-xl font-bold mb-3">Make It Fun</h3>
                  <p className="text-base-content/80">
                    Learning should feel like playing an RPG, not doing
                    homework. Streaks, XP, and levels make progress addictive.
                  </p>
                </div>
              </div>

              <div className="card bg-base-100 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2">
                <div className="card-body text-center">
                  <div className="w-16 h-16 bg-info/20 rounded-full flex items-center justify-center mb-4 mx-auto">
                    <MdTrendingUp className="w-8 h-8 text-info" />
                  </div>
                  <h3 className="text-xl font-bold mb-3">Actually Helpful</h3>
                  <p className="text-base-content/80">
                    Every feature exists to help you learn better, not to
                    impress investors, collect data, or generate ad revenue.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* What Makes Us Different */}
          <div className="mb-20 animate-fade-in-up delay-600">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-12 text-primary">
              Why This Is Different
            </h2>
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 bg-error/20 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-error font-bold text-sm leading-none">
                      ×
                    </span>
                  </div>
                  <div>
                    <h4 className="font-bold text-lg text-base-content">
                      Other Tools
                    </h4>
                    <p className="text-base-content/70">
                      Built for productivity or general habits, not language
                      immersion
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 bg-error/20 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-error font-bold text-sm leading-none">
                      ×
                    </span>
                  </div>
                  <div>
                    <h4 className="font-bold text-lg text-base-content">
                      Spreadsheets
                    </h4>
                    <p className="text-base-content/70">
                      Boring, manual, and don't understand your learning journey
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 bg-error/20 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-error font-bold text-sm leading-none">
                      ×
                    </span>
                  </div>
                  <div>
                    <h4 className="font-bold text-lg text-base-content">
                      Premium Apps
                    </h4>
                    <p className="text-base-content/70">
                      Expensive monthly fees for features you'll never use
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 bg-success/20 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-success font-bold text-sm leading-none">
                      ✓
                    </span>
                  </div>
                  <div>
                    <h4 className="font-bold text-lg text-primary">
                      NihongoTracker
                    </h4>
                    <p className="text-base-content/70">
                      Built specifically for immersion learning by a learner who
                      gets it
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 bg-success/20 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-success font-bold text-sm leading-none">
                      ✓
                    </span>
                  </div>
                  <div>
                    <h4 className="font-bold text-lg text-primary">
                      Gamified & Fun
                    </h4>
                    <p className="text-base-content/70">
                      Progress feels rewarding with XP, streaks, and
                      achievements
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 bg-success/20 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-success font-bold text-sm leading-none">
                      ✓
                    </span>
                  </div>
                  <div>
                    <h4 className="font-bold text-lg text-primary">
                      Core Features Free
                    </h4>
                    <p className="text-base-content/70">
                      Essential functionality free forever, optional
                      donation-supported enhancements available
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* What You Can Track */}
          <div className="mb-20 animate-fade-in-up delay-800">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-12 text-primary">
              Track Your Entire Japanese Journey
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="card bg-base-100 shadow-lg hover:shadow-xl transition-all duration-300">
                <div className="card-body text-center p-6">
                  <MdMovie className="w-12 h-12 text-primary mx-auto mb-3" />
                  <h3 className="font-bold text-lg mb-2">Anime & Dramas</h3>
                  <p className="text-sm text-base-content/70">
                    Episodes, seasons, movies - all your visual immersion
                  </p>
                </div>
              </div>
              <div className="card bg-base-100 shadow-lg hover:shadow-xl transition-all duration-300">
                <div className="card-body text-center p-6">
                  <MdBook className="w-12 h-12 text-secondary mx-auto mb-3" />
                  <h3 className="font-bold text-lg mb-2">Reading</h3>
                  <p className="text-sm text-base-content/70">
                    Manga, light novels, books, and web novels
                  </p>
                </div>
              </div>
              <div className="card bg-base-100 shadow-lg hover:shadow-xl transition-all duration-300">
                <div className="card-body text-center p-6">
                  <MdGamepad className="w-12 h-12 text-accent mx-auto mb-3" />
                  <h3 className="font-bold text-lg mb-2">Visual Novels</h3>
                  <p className="text-sm text-base-content/70">
                    Characters read, routes completed, hours played
                  </p>
                </div>
              </div>
              <div className="card bg-base-100 shadow-lg hover:shadow-xl transition-all duration-300">
                <div className="card-body text-center p-6">
                  <MdPlayArrow className="w-12 h-12 text-info mx-auto mb-3" />
                  <h3 className="font-bold text-lg mb-2">Audio Content</h3>
                  <p className="text-sm text-base-content/70">
                    Podcasts, audiobooks, and listening practice
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* CTA Section */}
          <div className="text-center bg-gradient-to-r from-primary/10 to-secondary/10 rounded-2xl p-8 md:p-12 animate-fade-in-up delay-1000">
            <h2 className="text-3xl md:text-4xl font-bold mb-6 text-base-content">
              Ready to Join the Community?
            </h2>
            <p className="text-lg md:text-xl text-base-content/80 mb-8 max-w-3xl mx-auto">
              Thousands of Japanese learners are already tracking their progress
              and staying motivated. Your immersion journey starts with a single
              click.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/register"
                className="btn btn-primary btn-lg shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300"
              >
                <MdPlayArrow className="w-6 h-6" />
                Start Your Journey - Free!
              </Link>
              <Link
                to="/features"
                className="btn btn-ghost btn-lg hover:bg-base-200 transform hover:-translate-y-1 transition-all duration-300"
              >
                Explore All Features
              </Link>
            </div>

            <div className="flex flex-wrap justify-center items-center gap-6 mt-8 text-base-content/60">
              <span className="flex items-center gap-2">
                <div className="w-2 h-2 bg-success rounded-full"></div>
                Core Features Free
              </span>
              <span className="flex items-center gap-2">
                <div className="w-2 h-2 bg-primary rounded-full"></div>
                No Ads or Tracking
              </span>
              <span className="flex items-center gap-2">
                <div className="w-2 h-2 bg-secondary rounded-full"></div>
                Made by a Fellow Learner
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AboutScreen;

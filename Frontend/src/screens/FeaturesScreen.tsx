import { Link } from 'react-router-dom';

function FeaturesScreen() {
  return (
    <div className="bg-base-200 min-h-screen pt-16">
      <div className="hero py-20 bg-base-300">
        <div className="hero-content text-center">
          <div className="max-w-3xl">
            <h1 className="text-5xl font-bold">Track Your Japanese Journey</h1>
            <p className="py-6 text-lg">
              NihongoTracker is your ultimate companion for Japanese language
              immersion. Track your progress, compete with friends, and
              visualize your growth through engaging statistics and gamification
              elements.
            </p>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-center mb-16">Core Features</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <div className="card bg-base-100 hover:shadow-xl transition-shadow">
            <div className="card-body">
              <div className="flex justify-center mb-4">
                <div className="bg-primary text-primary-content p-4 rounded-lg">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    className="w-8 h-8 stroke-current"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
                    ></path>
                  </svg>
                </div>
              </div>
              <h2 className="card-title justify-center">Immersion Tracking</h2>
              <p className="text-center">
                Log your time spent reading, listening, and engaging with
                Japanese media. NihongoTracker automatically calculates your
                total immersion hours and helps you maintain a consistent
                learning schedule.
              </p>
            </div>
          </div>

          <div className="card bg-base-100 hover:shadow-xl transition-shadow">
            <div className="card-body">
              <div className="flex justify-center mb-4">
                <div className="bg-secondary text-secondary-content p-4 rounded-lg">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    className="w-8 h-8 stroke-current"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                    ></path>
                  </svg>
                </div>
              </div>
              <h2 className="card-title justify-center">Media Organization</h2>
              <p className="text-center">
                Keep track of anime, manga, visual novels, books, and other
                media you've consumed. Automatically match your media with our
                extensive database for easy logging and progress tracking.
              </p>
            </div>
          </div>

          <div className="card bg-base-100 hover:shadow-xl transition-shadow">
            <div className="card-body">
              <div className="flex justify-center mb-4">
                <div className="bg-accent text-accent-content p-4 rounded-lg">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    className="w-8 h-8 stroke-current"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                    ></path>
                  </svg>
                </div>
              </div>
              <h2 className="card-title justify-center">
                Statistics & Analytics
              </h2>
              <p className="text-center">
                Visualize your progress with detailed charts and metrics. Track
                your reading speed, total immersion hours, and see how your
                skills evolve over time with custom date ranges and filters.
              </p>
            </div>
          </div>

          <div className="card bg-base-100 hover:shadow-xl transition-shadow">
            <div className="card-body">
              <div className="flex justify-center mb-4">
                <div className="bg-success text-success-content p-4 rounded-lg">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    className="w-8 h-8 stroke-current"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    ></path>
                  </svg>
                </div>
              </div>
              <h2 className="card-title justify-center">Gamification & XP</h2>
              <p className="text-center">
                Earn experience points (XP) for every minute spent immersing
                yourself in Japanese. Level up your overall language skills and
                specific areas like reading and listening to stay motivated.
              </p>
            </div>
          </div>

          <div className="card bg-base-100 hover:shadow-xl transition-shadow">
            <div className="card-body">
              <div className="flex justify-center mb-4">
                <div className="bg-info text-info-content p-4 rounded-lg">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    className="w-8 h-8 stroke-current"
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
              <h2 className="card-title justify-center">Social Competition</h2>
              <p className="text-center">
                Compete with friends on the leaderboard to see who can
                accumulate the most XP. Track rankings by time period and
                category to push yourself further in your language learning
                journey.
              </p>
            </div>
          </div>

          <div className="card bg-base-100 hover:shadow-xl transition-shadow">
            <div className="card-body">
              <div className="flex justify-center mb-4">
                <div className="bg-warning text-warning-content p-4 rounded-lg">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    className="w-8 h-8 stroke-current"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M3 19.5h18M5 17l3.5-3.5m0 0l3 3L18 10"
                    ></path>
                  </svg>
                </div>
              </div>
              <h2 className="card-title justify-center">
                Reading Speed Metrics
              </h2>
              <p className="text-center">
                Monitor your Japanese reading speed improvement over time with
                character-per-hour tracking. Compare your reading speed across
                different media types to see your growth and identify areas for
                improvement.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-base-300 py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">How It Works</h2>

          <div className="steps steps-vertical lg:steps-horizontal">
            <div className="step step-primary">
              <div className="mt-6">
                <h3 className="text-xl font-bold mb-2">Log Activities</h3>
                <p className="max-w-xs text-center">
                  Track your time spent reading manga, watching anime, or any
                  Japanese content.
                </p>
              </div>
            </div>
            <div className="step step-primary">
              <div className="mt-6">
                <h3 className="text-xl font-bold mb-2">Earn XP</h3>
                <p className="max-w-xs text-center">
                  Get experience points based on your immersion time and
                  engagement.
                </p>
              </div>
            </div>
            <div className="step step-primary">
              <div className="mt-6">
                <h3 className="text-xl font-bold mb-2">Level Up</h3>
                <p className="max-w-xs text-center">
                  Watch your skills progress as you gain levels in reading and
                  listening.
                </p>
              </div>
            </div>
            <div className="step step-primary">
              <div className="mt-6">
                <h3 className="text-xl font-bold mb-2">Analyze Progress</h3>
                <p className="max-w-xs text-center">
                  View detailed statistics and track your improvement over time.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-16">
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title text-2xl">Your Journey Visualized</h2>
            <p>
              NihongoTracker transforms your daily Japanese immersion into
              actionable data and insights. Watch as your streak builds day
              after day, and see exactly how much progress you've made over
              weeks and months.
            </p>

            <div className="stats shadow my-4">
              <div className="stat">
                <div className="stat-title">Reading Speed</div>
                <div className="stat-value text-primary">+25%</div>
                <div className="stat-desc">Avg. improvement after 3 months</div>
              </div>
              <div className="stat">
                <div className="stat-title">Immersion Time</div>
                <div className="stat-value text-accent">215h</div>
                <div className="stat-desc">Monthly average by active users</div>
              </div>
            </div>

            <p>
              Set goals, maintain streaks, and see tangible results as you
              continue your language learning journey.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-base-300 py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">
            Ready to Gamify Your Japanese Learning?
          </h2>
          <p className="max-w-2xl mx-auto mb-8 text-lg">
            Join thousands of learners who are tracking their progress,
            competing with friends, and mastering Japanese through consistent
            immersion.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link to="/register" className="btn btn-primary btn-lg">
              Sign Up Free
            </Link>
            <Link to="/login" className="btn btn-outline btn-lg">
              Log In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default FeaturesScreen;

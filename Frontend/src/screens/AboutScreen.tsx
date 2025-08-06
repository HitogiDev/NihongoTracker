function AboutScreen() {
  return (
    <div className="min-h-screen bg-base-100 pt-16">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          {/* Hero Section */}
          <div className="text-center mb-12">
            <h1 className="text-5xl font-bold text-primary mb-6">
              About NihongoTracker
            </h1>
            <p className="text-xl text-base-content/80 max-w-2xl mx-auto">
              Your comprehensive Japanese learning companion designed to track
              and enhance your immersion journey.
            </p>
          </div>

          {/* Main Content */}
          <div className="grid lg:grid-cols-2 gap-12 mb-16">
            <div className="card bg-base-200 shadow-xl">
              <div className="card-body">
                <h2 className="card-title text-2xl text-primary mb-4">
                  🎯 Our Mission
                </h2>
                <p className="text-base-content/90 leading-relaxed">
                  NihongoTracker empowers Japanese language learners through
                  comprehensive immersion tracking. We believe that consistent
                  exposure to authentic Japanese content is key to achieving
                  fluency, and our platform makes it easy to monitor your
                  progress across all media types.
                </p>
              </div>
            </div>

            <div className="card bg-base-200 shadow-xl">
              <div className="card-body">
                <h2 className="card-title text-2xl text-primary mb-4">
                  📊 Track Everything
                </h2>
                <ul className="space-y-2 text-base-content/90">
                  <li className="flex items-center gap-2">
                    <span className="badge badge-primary badge-sm">📺</span>
                    Anime episodes and watch time
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="badge badge-primary badge-sm">📚</span>
                    Manga chapters and reading progress
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="badge badge-primary badge-sm">🎮</span>
                    Visual novels and character count
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="badge badge-primary badge-sm">🎬</span>
                    Movies and dramas
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="badge badge-primary badge-sm">📖</span>
                    Books and light novels
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="badge badge-primary badge-sm">🎵</span>
                    Audio content and podcasts
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Data Sources Section */}
          <div className="mb-16">
            <h2 className="text-3xl font-bold text-center mb-8 text-primary">
              🔗 Powered by Trusted Sources
            </h2>
            <div className="grid md:grid-cols-3 gap-8">
              <div className="card bg-gradient-to-br from-blue-500/10 to-blue-600/10 border border-blue-500/20 shadow-lg">
                <div className="card-body text-center">
                  <div className="w-16 h-16 rounded-full bg-blue-500/20 flex items-center justify-center mb-4 mx-auto">
                    <span className="text-3xl font-bold text-blue-600">AL</span>
                  </div>
                  <h3 className="card-title justify-center text-xl mb-2">
                    AniList
                  </h3>
                  <p className="text-base-content/80 text-sm">
                    Comprehensive anime and manga database providing detailed
                    information, episode counts, and metadata for accurate
                    tracking.
                  </p>
                  <div className="badge badge-outline badge-primary mt-2">
                    Anime & Manga
                  </div>
                </div>
              </div>

              <div className="card bg-gradient-to-br from-teal-500/10 to-cyan-600/10 border border-teal-500/20 shadow-lg">
                <div className="card-body text-center">
                  <div className="w-16 h-16 rounded-full bg-teal-500/20 flex items-center justify-center mb-4 mx-auto">
                    <span className="text-2xl font-bold text-teal-700">VN</span>
                  </div>
                  <h3 className="card-title justify-center text-xl mb-2">
                    VNDB
                  </h3>
                  <p className="text-base-content/80 text-sm">
                    The Visual Novel Database offers extensive information about
                    visual novels, helping you track your reading progress and
                    discover new titles.
                  </p>
                  <div className="badge badge-outline badge-primary mt-2">
                    Visual Novels
                  </div>
                </div>
              </div>

              <div className="card bg-gradient-to-br from-green-500/10 to-green-600/10 border border-green-500/20 shadow-lg">
                <div className="card-body text-center">
                  <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mb-4 mx-auto">
                    <span className="text-2xl font-bold text-green-600">
                      TV
                    </span>
                  </div>
                  <h3 className="card-title justify-center text-xl mb-2">
                    TVDB
                  </h3>
                  <p className="text-base-content/80 text-sm">
                    TheTVDB provides comprehensive information about TV shows,
                    dramas, and series to enhance your immersion tracking.
                  </p>
                  <div className="badge badge-outline badge-primary mt-2">
                    TV Shows & Dramas
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Features Section */}
          <div className="mb-16">
            <h2 className="text-3xl font-bold text-center mb-8 text-primary">
              ✨ Key Features
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="flex items-start gap-4 p-6 bg-base-200 rounded-lg">
                <div className="badge badge-primary badge-lg">📈</div>
                <div>
                  <h3 className="font-semibold text-lg mb-2">
                    Progress Tracking
                  </h3>
                  <p className="text-base-content/80">
                    Monitor your daily goals, weekly progress, and long-term
                    learning journey with detailed statistics and
                    visualizations.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-6 bg-base-200 rounded-lg">
                <div className="badge badge-primary badge-lg">🏆</div>
                <div>
                  <h3 className="font-semibold text-lg mb-2">
                    Community Ranking
                  </h3>
                  <p className="text-base-content/80">
                    Compare your progress with other learners and stay motivated
                    through friendly competition.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-6 bg-base-200 rounded-lg">
                <div className="badge badge-primary badge-lg">🎯</div>
                <div>
                  <h3 className="font-semibold text-lg mb-2">Goal Setting</h3>
                  <p className="text-base-content/80">
                    Set and track daily, weekly, and monthly immersion goals to
                    maintain consistent learning habits.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-6 bg-base-200 rounded-lg">
                <div className="badge badge-primary badge-lg">📱</div>
                <div>
                  <h3 className="font-semibold text-lg mb-2">Quick Logging</h3>
                  <p className="text-base-content/80">
                    Easily log your immersion activities with our streamlined
                    interface designed for minimal friction.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Call to Action */}
          <div className="text-center bg-gradient-to-r from-primary/10 to-secondary/10 rounded-2xl p-8">
            <h2 className="text-2xl font-bold mb-4">
              Ready to Start Your Journey?
            </h2>
            <p className="text-base-content/80 mb-6 max-w-2xl mx-auto">
              Join thousands of Japanese learners who are tracking their
              immersion and achieving their language goals with NihongoTracker.
            </p>
            <div className="flex gap-4 justify-center flex-wrap">
              <a href="/register" className="btn btn-primary btn-lg">
                Get Started Free
              </a>
              <a href="/features" className="btn btn-outline btn-lg">
                Explore Features
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AboutScreen;

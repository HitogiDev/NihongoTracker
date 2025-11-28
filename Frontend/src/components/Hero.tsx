import { Link } from 'react-router-dom';
import { useRef, useEffect } from 'react';
import { gsap } from 'gsap';
import { MdTrendingUp } from 'react-icons/md';
import {
  // HiArrowRight,
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

function Hero() {
  // Animation refs for landing page
  const heroRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const subtitleRef = useRef<HTMLParagraphElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);

  // GSAP animations for landing page
  useEffect(() => {
    if (
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
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-base-100 to-base-200">
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
              building real language skills. Join thousands discovering the joy
              of natural language acquisition.
            </p>

            <div
              ref={ctaRef}
              className="flex flex-col sm:flex-row gap-6 justify-center items-center"
            >
              <Link to="/register">
                <button
                  disabled
                  className="btn btn-disabled btn-primary btn-lg px-12 py-4 text-lg shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105"
                >
                  Coming Soon!
                  {/*<HiArrowRight className="ml-2" />*/}
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
                <div className="badge badge-success badge-lg">The Solution</div>
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
              <div className="badge badge-primary badge-lg mb-4">Features</div>
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
                    Beautiful charts and insights showing your immersion journey
                    and skill development
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
                    Find new anime and manga with integrated AniList search and
                    recommendations
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
                <button
                  disabled
                  className="btn btn-disabled btn-primary btn-lg px-12 py-4 text-lg shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105"
                >
                  Start Free Today
                  {/*<HiArrowRight className="ml-2" />*/}
                </button>
              </Link>

              <div className="text-sm text-base-content/60">
                No credit card required • Basic features free forever
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default Hero;

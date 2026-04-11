import { Link } from 'react-router-dom';
import { useRef, useEffect, useState } from 'react';
import { gsap } from 'gsap';
import { TypeAnimation } from 'react-type-animation';
import {
  Check,
  ArrowRight,
  Tv2,
  BookOpen,
  Gamepad2,
  BookImage,
  Headphones,
  BookMarked,
  Play,
} from 'lucide-react';

const resolveIsDarkTheme = (theme: string | null | undefined) => {
  const selectedTheme = theme || 'system';

  if (selectedTheme === 'system') {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    return true;
  }

  return selectedTheme !== 'light';
};

function ScreenshotWindow({
  src,
  url,
  alt,
  isDark,
  onOpen,
}: {
  src: string;
  url: string;
  alt: string;
  isDark: boolean;
  onOpen: (imgSrc: string) => void;
}) {
  const activeSrc = isDark ? src : src.replace('-v2.png', '-light-v2.png');
  return (
    <div
      className="rounded-2xl overflow-hidden shadow-xl border border-base-300 hover:shadow-2xl transition-shadow duration-500 cursor-zoom-in"
      onClick={() => onOpen(activeSrc)}
    >
      <div className="bg-base-300 px-3 py-2.5 flex items-center gap-2">
        <div className="flex gap-1.5 shrink-0">
          <div className="w-2.5 h-2.5 rounded-full bg-error/60" />
          <div className="w-2.5 h-2.5 rounded-full bg-warning/60" />
          <div className="w-2.5 h-2.5 rounded-full bg-success/60" />
        </div>
        <div className="flex-1 bg-base-200 rounded-full px-3 py-0.5 text-xs text-base-content/40 text-center max-w-[240px] mx-auto truncate">
          {url}
        </div>
      </div>
      <img src={activeSrc} alt={alt} className="w-full block" loading="lazy" />
    </div>
  );
}

function Hero() {
  const containerRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const subtitleRef = useRef<HTMLParagraphElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const heroImgRef = useRef<HTMLDivElement>(null);
  const [isDark, setIsDark] = useState(() =>
    resolveIsDarkTheme(localStorage.getItem('theme'))
  );
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  useEffect(() => {
    const onThemeChange = (e: CustomEvent) => {
      setIsDark(resolveIsDarkTheme(e.detail as string | null | undefined));
    };
    window.addEventListener('themeChange', onThemeChange as EventListener);
    return () => {
      window.removeEventListener('themeChange', onThemeChange as EventListener);
    };
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const onSystemThemeChange = () => {
      const selectedTheme = localStorage.getItem('theme') || 'system';

      if (selectedTheme === 'system') {
        setIsDark(mediaQuery.matches);
      }
    };

    mediaQuery.addEventListener('change', onSystemThemeChange);

    return () => {
      mediaQuery.removeEventListener('change', onSystemThemeChange);
    };
  }, []);

  // Hero entrance animation
  useEffect(() => {
    const els = [
      titleRef.current,
      subtitleRef.current,
      ctaRef.current,
      heroImgRef.current,
    ].filter(Boolean) as HTMLElement[];

    gsap.set(els, { opacity: 0, y: 40 });
    gsap.to(els, {
      opacity: 1,
      y: 0,
      duration: 0.9,
      stagger: 0.15,
      ease: 'power3.out',
      delay: 0.1,
    });
  }, []);

  // Scroll-triggered reveal for feature sections
  useEffect(() => {
    if (!containerRef.current) return;
    const items =
      containerRef.current.querySelectorAll<HTMLElement>('.scroll-reveal');

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            gsap.fromTo(
              entry.target,
              { opacity: 0, y: 48 },
              { opacity: 1, y: 0, duration: 0.75, ease: 'power3.out' }
            );
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08 }
    );

    items.forEach((el) => {
      gsap.set(el, { opacity: 0, y: 48 });
      observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  const closeLightbox = () => setLightboxSrc(null);

  return (
    <>
      {lightboxSrc && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={closeLightbox}
        >
          <button
            className="absolute top-4 right-4 btn btn-circle btn-sm btn-ghost text-white/80 hover:text-white"
            onClick={closeLightbox}
            aria-label="Close"
          >
            ✕
          </button>
          <img
            src={lightboxSrc}
            alt="Screenshot"
            className="max-w-full max-h-[90vh] rounded-xl shadow-2xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
      <style>{`
        @keyframes gradient-flow {
          0%   { background-position: 0% 50%; }
          50%  { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .gradient-text-animated {
          background: linear-gradient(
            90deg,
            var(--color-primary),
            var(--color-secondary),
            var(--color-primary)
          );
          background-size: 200% 200%;
          animation: gradient-flow 10s ease infinite;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          padding-bottom: 0.2em;
          display: inline-block;
        }
      `}</style>

      <div ref={containerRef} className="pt-16 bg-base-100">
        {/* ─── Hero ─── */}
        <section className="relative min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center px-4 py-20 overflow-hidden">
          {/* Subtle bg blobs */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute top-1/4 -left-32 w-[500px] h-[500px] bg-primary/5 rounded-full blur-3xl" />
            <div className="absolute bottom-1/4 -right-32 w-[500px] h-[500px] bg-secondary/5 rounded-full blur-3xl" />
          </div>

          <div className="relative z-10 max-w-4xl mx-auto text-center mb-14">
            <h1
              ref={titleRef}
              className="gradient-text-animated text-5xl sm:text-6xl md:text-7xl font-bold mb-6 leading-tight"
            >
              NihongoTracker
            </h1>

            <p
              ref={subtitleRef}
              className="text-xl md:text-2xl text-base-content/65 mb-10 max-w-2xl mx-auto leading-relaxed"
            >
              The best way to{' '}
              <TypeAnimation
                sequence={[
                  'track',
                  1800,
                  'gamify',
                  1800,
                  'celebrate',
                  1800,
                  'share',
                  1800,
                ]}
                speed={20}
                deletionSpeed={40}
                repeat={Infinity}
                className="font-semibold text-primary"
              />{' '}
              your Japanese immersion
            </p>

            <div
              ref={ctaRef}
              className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-5"
            >
              <Link to="/register">
                <button className="btn btn-primary btn-lg gap-2 px-10">
                  Start Tracking
                  <ArrowRight size={18} />
                </button>
              </Link>
              <Link to="/features">
                <button className="btn btn-ghost btn-lg px-8">
                  See all features
                </button>
              </Link>
            </div>

            <p className="text-sm text-base-content/35">
              Start tracking today · Core features free forever
            </p>
          </div>

          {/* Hero screenshot */}
          <div
            ref={heroImgRef}
            className="relative z-10 w-full max-w-5xl mx-auto px-4"
          >
            <div className="rounded-2xl overflow-hidden shadow-2xl border border-base-300">
              <div className="bg-base-300 px-4 py-2.5 flex items-center gap-2">
                <div className="flex gap-1.5 shrink-0">
                  <div className="w-3 h-3 rounded-full bg-error/60" />
                  <div className="w-3 h-3 rounded-full bg-warning/60" />
                  <div className="w-3 h-3 rounded-full bg-success/60" />
                </div>
                <div className="flex-1 bg-base-200 rounded-full px-3 py-0.5 text-xs text-base-content/40 text-center max-w-xs mx-auto">
                  nihongotracker.app
                </div>
              </div>
              <img
                src={
                  isDark
                    ? '/screenshots/dashboard-v2.png'
                    : '/screenshots/dashboard-light-v2.png'
                }
                alt="NihongoTracker Dashboard"
                className="w-full block cursor-zoom-in"
                loading="eager"
                onClick={() =>
                  setLightboxSrc(
                    isDark
                      ? '/screenshots/dashboard-v2.png'
                      : '/screenshots/dashboard-light-v2.png'
                  )
                }
              />
            </div>
          </div>
        </section>

        {/* ─── Media type strip ─── */}
        <section className="py-14 px-4 bg-base-200/50 border-y border-base-300/50">
          <div className="max-w-3xl mx-auto text-center scroll-reveal">
            <p className="text-xs font-semibold text-base-content/40 uppercase tracking-widest mb-5">
              Track every type of immersion
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              {[
                { Icon: Tv2, label: 'Anime' },
                { Icon: BookOpen, label: 'Manga' },
                { Icon: BookImage, label: 'Visual Novels' },
                { Icon: Headphones, label: 'Audio & Podcasts' },
                { Icon: BookMarked, label: 'Books & Reading' },
                { Icon: Play, label: 'Video' },
                { Icon: Gamepad2, label: 'Video Games' },
              ].map(({ Icon, label }) => (
                <span
                  key={label}
                  className="flex items-center gap-2 bg-base-100 rounded-full px-4 py-2 border border-base-300 text-sm font-medium text-base-content/75"
                >
                  <Icon size={14} className="text-primary" />
                  {label}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ─── Feature: Log Tracking ─── */}
        <section className="py-24 px-4 bg-base-100">
          <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12 lg:gap-20 items-center">
            <div className="scroll-reveal space-y-5 order-2 md:order-1">
              <span className="badge badge-primary badge-outline">
                Log Tracking
              </span>
              <h2 className="text-3xl md:text-4xl font-bold text-base-content leading-tight">
                Log in an instant
              </h2>
              <p className="text-lg text-base-content/60 leading-relaxed">
                Search a title, fill in the details, hit save. No more writing
                long Discord commands or manually writing the whole title every
                time, so you can go back to what matters: enjoying your
                immersion!
              </p>
              <ul className="space-y-3 text-base-content/70">
                <li className="flex items-center gap-3">
                  <Check size={16} className="text-success shrink-0" />
                  Anime, manga, VNs, audio, light novels & more
                </li>
                <li className="flex items-center gap-3">
                  <Check size={16} className="text-success shrink-0" />
                  AniList & VNDB integration for instant metadata
                </li>
                <li className="flex items-center gap-3">
                  <Check size={16} className="text-success shrink-0" />
                  XP and streaks calculated automatically
                </li>
              </ul>
            </div>
            <div className="scroll-reveal order-1 md:order-2">
              <ScreenshotWindow
                src="/screenshots/log-tracking-v2.png"
                url="nihongotracker.app/log"
                alt="Log Tracking"
                isDark={isDark}
                onOpen={setLightboxSrc}
              />
            </div>
          </div>
        </section>

        {/* ─── Feature: Statistics ─── */}
        <section className="py-24 px-4 bg-base-200/30">
          <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12 lg:gap-20 items-center">
            <div className="scroll-reveal">
              <ScreenshotWindow
                src="/screenshots/user-stats-v2.png"
                url="nihongotracker.app/hitogi/stats"
                alt="Statistics"
                isDark={isDark}
                onOpen={setLightboxSrc}
              />
            </div>
            <div className="scroll-reveal space-y-5">
              <span className="badge badge-secondary badge-outline">
                Statistics
              </span>
              <h2 className="text-3xl md:text-4xl font-bold text-base-content leading-tight">
                See exactly how far
                <br />
                you've come
              </h2>
              <p className="text-lg text-base-content/60 leading-relaxed">
                Detailed charts and breakdowns show your growth over time.
                Immersion hours by media type, reading speed trends, XP history,
                and activity heatmap.
              </p>
              <ul className="space-y-3 text-base-content/70">
                <li className="flex items-center gap-3">
                  <Check size={16} className="text-success shrink-0" />
                  Overall, listening & reading level progress
                </li>
                <li className="flex items-center gap-3">
                  <Check size={16} className="text-success shrink-0" />
                  Activity heatmap, streaks & daily averages
                </li>
                <li className="flex items-center gap-3">
                  <Check size={16} className="text-success shrink-0" />
                  Filter by time range, medium, or tags
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* ─── Feature: Leaderboards ─── */}
        <section className="py-24 px-4 bg-base-100">
          <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12 lg:gap-20 items-center">
            <div className="scroll-reveal space-y-5 order-2 md:order-1">
              <span className="badge badge-accent badge-outline">
                Leaderboards
              </span>
              <h2 className="text-3xl md:text-4xl font-bold text-base-content leading-tight">
                A little friendly
                <br />
                competition
              </h2>
              <p className="text-lg text-base-content/60 leading-relaxed">
                See how you rank against other learners globally or by medium.
                Monthly rankings reset every month — there's always a fresh
                chance to climb.
              </p>
              <ul className="space-y-3 text-base-content/70">
                <li className="flex items-center gap-3">
                  <Check size={16} className="text-success shrink-0" />
                  Global & per-medium rankings
                </li>
                <li className="flex items-center gap-3">
                  <Check size={16} className="text-success shrink-0" />
                  Monthly & all-time leaderboards
                </li>
                <li className="flex items-center gap-3">
                  <Check size={16} className="text-success shrink-0" />
                  Filters for time range, medium, and listening/reading
                </li>
              </ul>
            </div>
            <div className="scroll-reveal order-1 md:order-2">
              <ScreenshotWindow
                src="/screenshots/leaderboards-v2.png"
                url="nihongotracker.app/ranking"
                alt="Leaderboards"
                isDark={isDark}
                onOpen={setLightboxSrc}
              />
            </div>
          </div>
        </section>

        {/* ─── Feature: TextHooker ─── */}
        <section className="py-24 px-4 bg-base-200/30">
          <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12 lg:gap-20 items-center">
            <div className="scroll-reveal">
              <ScreenshotWindow
                src="/screenshots/texthooker-v2.png"
                url="nihongotracker.app/texthooker"
                alt="TextHooker Dashboard"
                isDark={isDark}
                onOpen={setLightboxSrc}
              />
            </div>
            <div className="scroll-reveal space-y-5">
              <span className="badge badge-primary badge-outline">
                TextHooker
              </span>
              <h2 className="text-3xl md:text-4xl font-bold text-base-content leading-tight">
                Built for visual
                <br />
                novel readers
              </h2>
              <p className="text-lg text-base-content/60 leading-relaxed">
                The integrated texthooker makes it easy to log your sessions
                with the click of a button, no more manual logging after a long
                reading session. You can also create a room to share the
                texthooker in real-time with other users, perfect for roudoku
                sessions.
              </p>
              <ul className="space-y-3 text-base-content/70">
                <li className="flex items-center gap-3">
                  <Check size={16} className="text-success shrink-0" />
                  Multiplayer texthooker rooms for shared reading sessions
                </li>
                <li className="flex items-center gap-3">
                  <Check size={16} className="text-success shrink-0" />
                  Full session history per title
                </li>
                <li className="flex items-center gap-3">
                  <Check size={16} className="text-success shrink-0" />
                  Easy one-click reading session logging
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* ─── Feature: Clubs ─── */}
        <section className="py-24 px-4 bg-base-100">
          <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12 lg:gap-20 items-center">
            <div className="scroll-reveal space-y-5 order-2 md:order-1">
              <span className="badge badge-primary badge-outline">Clubs</span>
              <h2 className="text-3xl md:text-4xl font-bold text-base-content leading-tight">
                Learn better
                <br />
                together
              </h2>
              <p className="text-lg text-base-content/60 leading-relaxed">
                Join or create an immersion club. Compete on club leaderboards,
                share your accomplishments, and find people who are into the
                same things you are. Submit and vote on polls to decide the
                media to consume together next!
              </p>
              <ul className="space-y-3 text-base-content/70">
                <li className="flex items-center gap-3">
                  <Check size={16} className="text-success shrink-0" />
                  Vote to decide what media to consume together next
                </li>
                <li className="flex items-center gap-3">
                  <Check size={16} className="text-success shrink-0" />
                  Public and private clubs with tags
                </li>
                <li className="flex items-center gap-3">
                  <Check size={16} className="text-success shrink-0" />
                  Find clubs by genre, style, or level
                </li>
              </ul>
            </div>
            <div className="scroll-reveal order-1 md:order-2">
              <ScreenshotWindow
                src="/screenshots/clubs-v2.png"
                url="nihongotracker.app/clubs"
                alt="Clubs"
                isDark={isDark}
                onOpen={setLightboxSrc}
              />
            </div>
          </div>
        </section>

        {/* ─── CTA ─── */}
        <section className="py-28 px-4 bg-gradient-to-b from-base-100 to-base-200/60">
          <div className="max-w-xl mx-auto text-center scroll-reveal">
            <h2 className="text-4xl md:text-5xl font-bold text-base-content mb-4">
              Ready to start?
            </h2>
            <p className="text-lg text-base-content/55 mb-10">
              Free, start tracking your immersion.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link to="/register">
                <button className="btn btn-primary btn-lg px-12">
                  Join Now
                </button>
              </Link>
              <Link to="/features">
                <button className="btn btn-ghost btn-lg">
                  See all features →
                </button>
              </Link>
            </div>
            <p className="mt-8 text-sm text-base-content/50">
              Made with ❤️ by a fellow learner
            </p>
          </div>
        </section>
      </div>
    </>
  );
}

export default Hero;

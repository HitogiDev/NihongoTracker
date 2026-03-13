import Header from './components/Header';
import { Outlet, useLocation } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Footer from './components/Footer';
import { useEffect, useLayoutEffect } from 'react';

const APP_NAME = 'NihongoTracker';

function getTitle(pathname: string) {
  const segments = pathname.split('/').filter(Boolean);

  if (segments.length === 0) return `Home • ${APP_NAME}`;

  if (segments[0] === 'login') return `Login • ${APP_NAME}`;
  if (segments[0] === 'register') return `Register • ${APP_NAME}`;
  if (segments[0] === 'forgot-password') return `Forgot Password • ${APP_NAME}`;
  if (segments[0] === 'reset-password') return `Reset Password • ${APP_NAME}`;
  if (segments[0] === 'verify-email') return `Verify Email • ${APP_NAME}`;

  if (segments[0] === 'settings') return `Settings • ${APP_NAME}`;

  if (segments[0] === 'ranking') return `Ranking • ${APP_NAME}`;

  if (segments[0] === 'clubs') {
    if (segments[1] === 'create') return `Create Club • ${APP_NAME}`;
    if (segments.length === 1) return `Clubs • ${APP_NAME}`;
    if (segments[2] === 'media') {
      const sub = segments[4];
      const section =
        sub === 'activity'
          ? 'Activity'
          : sub === 'reviews'
            ? 'Reviews'
            : sub === 'rankings'
              ? 'Rankings'
              : 'Media';
      return `${section} • Club • ${APP_NAME}`;
    }
    return `Club • ${APP_NAME}`;
  }

  if (segments[0] === 'calculator') return `Calculator • ${APP_NAME}`;
  if (segments[0] === 'features') return `Features • ${APP_NAME}`;
  if (segments[0] === 'about') return `About • ${APP_NAME}`;
  if (segments[0] === 'support') return `Support • ${APP_NAME}`;
  if (segments[0] === 'privacy') return `Privacy Policy • ${APP_NAME}`;
  if (segments[0] === 'terms') return `Terms of Service • ${APP_NAME}`;
  if (segments[0] === 'changelog') return `Changelog • ${APP_NAME}`;

  if (segments[0] === 'admin') return `Admin • ${APP_NAME}`;

  if (segments[0] === 'shared-log') return `Shared Log • ${APP_NAME}`;

  const mediaTypes = [
    'anime',
    'manga',
    'reading',
    'vn',
    'video',
    'movie',
    'tv show',
    'audio',
  ];
  if (mediaTypes.includes(segments[0])) {
    return `${segments[0].charAt(0).toUpperCase() + segments[0].slice(1)} Details • ${APP_NAME}`;
  }

  if (segments[0] === 'user') {
    const username = segments[1] || 'User';
    const sectionKey = segments[2];
    const sectionLabel =
      sectionKey === 'stats'
        ? 'Stats'
        : sectionKey === 'list'
          ? 'Immersion List'
          : sectionKey === 'goals'
            ? 'Goals'
            : 'Profile';
    return `${username}'s ${sectionLabel.toLocaleLowerCase()} • ${APP_NAME}`;
  }
  if (segments[0] === 'goals') return `Goals • ${APP_NAME}`;
  if (segments[0] === 'log') return `Create Log • ${APP_NAME}`;
  if (segments[0] === 'matchmedia') return `Match Media • ${APP_NAME}`;
  return APP_NAME;
}

function TitleManager() {
  const { pathname } = useLocation();

  useEffect(() => {
    document.title = getTitle(pathname);
  }, [pathname]);

  return null;
}

function ScrollToTop() {
  const { pathname, search, hash } = useLocation();

  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }

    return () => {
      if ('scrollRestoration' in window.history) {
        window.history.scrollRestoration = 'auto';
      }
    };
  }, []);

  useLayoutEffect(() => {
    // Reset both window/document scroll and any app-level scroll container.
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;

    const main = document.querySelector('main');
    if (main) {
      main.scrollTop = 0;
    }
  }, [pathname, search, hash]);

  return null;
}

function App() {
  return (
    <>
      <TitleManager />
      <ScrollToTop />
      <Header />
      <ToastContainer autoClose={2000} position="bottom-right" />
      <main className="flex-1 bg-base-200">
        <Outlet />
      </main>
      <Footer />
    </>
  );
}

export default App;

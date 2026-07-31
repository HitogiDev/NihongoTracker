import Header from './components/Header';
import { Outlet, useLocation } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Footer from './components/Footer';
import { useEffect, useLayoutEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { ParseKeys } from 'i18next';

const APP_NAME = 'NihongoTracker';

const MEDIA_TYPES = new Set([
  'anime',
  'manga',
  'reading',
  'vn',
  'game',
  'video',
  'movie',
  'tv show',
  'audio',
]);

type MediaTabSection = 'overview' | 'reviews' | 'social';

interface ParsedMediaTabRoute {
  key: string;
  section: MediaTabSection;
}

function parseMediaTabRoute(pathname: string): ParsedMediaTabRoute | null {
  const segments = pathname
    .split('/')
    .filter(Boolean)
    .map((segment) => decodeURIComponent(segment));

  if (segments.length < 2) {
    return null;
  }

  const mediaType = segments[0];
  const mediaId = segments[1];

  if (!MEDIA_TYPES.has(mediaType) || !mediaId) {
    return null;
  }

  if (segments.length === 2) {
    return {
      key: `${mediaType}/${mediaId}`,
      section: 'overview',
    };
  }

  if (segments.length === 3) {
    if (segments[2] === 'reviews' || segments[2] === 'social') {
      return {
        key: `${mediaType}/${mediaId}`,
        section: segments[2],
      };
    }

    return {
      key: `${mediaType}/${mediaId}/${segments[2]}`,
      section: 'overview',
    };
  }

  if (
    segments.length === 4 &&
    (segments[3] === 'reviews' || segments[3] === 'social')
  ) {
    return {
      key: `${mediaType}/${mediaId}/${segments[2]}`,
      section: segments[3],
    };
  }

  return null;
}

type TitleKey = ParseKeys<['nav', 'common']>;

/**
 * URL segment → translation key. Spelled out as literals rather than built with
 * template strings so every key is type-checked and the i18next extractor can
 * see them.
 */
const MEDIA_TYPE_TITLE_KEYS: Record<string, TitleKey> = {
  anime: 'common:mediaTypes.anime',
  manga: 'common:mediaTypes.manga',
  reading: 'common:mediaTypes.reading',
  vn: 'common:mediaTypes.vn',
  game: 'common:mediaTypes.game',
  video: 'common:mediaTypes.video',
  movie: 'common:mediaTypes.movie',
  'tv show': 'common:mediaTypes.tvShow',
  audio: 'common:mediaTypes.audio',
};

const CLUB_SECTION_TITLE_KEYS: Record<string, TitleKey> = {
  activity: 'titles.sections.activity',
  reviews: 'titles.sections.reviews',
  rankings: 'titles.sections.rankings',
};

const USER_SECTION_TITLE_KEYS: Record<string, TitleKey> = {
  stats: 'titles.sections.stats',
  list: 'titles.sections.immersionList',
  lists: 'titles.sections.lists',
  goals: 'titles.sections.goals',
  moderation: 'titles.sections.moderation',
};

interface TitleDescriptor {
  /** Key inside the `nav:titles` bundle, or null for the bare app name. */
  key: TitleKey | null;
  /**
   * Nested keys are resolved by the caller — i18next only expands `$t()` inside
   * translation values, not inside interpolation parameters.
   */
  sectionKey?: TitleKey;
  typeKey?: TitleKey;
  username?: string;
}

/**
 * Resolves a pathname to a translation key rather than a finished string, so
 * the document title follows the active language.
 */
function getTitleDescriptor(pathname: string): TitleDescriptor {
  const segments = pathname.split('/').filter(Boolean);

  if (segments.length === 0) return { key: 'titles.home' };

  if (segments[0] === 'login') return { key: 'titles.login' };
  if (segments[0] === 'register') return { key: 'titles.register' };
  if (segments[0] === 'forgot-password')
    return { key: 'titles.forgotPassword' };
  if (segments[0] === 'reset-password') return { key: 'titles.resetPassword' };
  if (segments[0] === 'verify-email') return { key: 'titles.verifyEmail' };

  if (segments[0] === 'settings') return { key: 'titles.settings' };
  if (segments[0] === 'media-request') return { key: 'titles.requestMedia' };
  if (segments[0] === 'notifications') return { key: 'titles.notifications' };

  if (segments[0] === 'ranking') return { key: 'titles.ranking' };

  if (segments[0] === 'clubs') {
    if (segments[1] === 'create') return { key: 'titles.createClub' };
    if (segments.length === 1) return { key: 'titles.clubs' };
    if (segments[2] === 'media') {
      return {
        key: 'titles.clubSection',
        sectionKey:
          CLUB_SECTION_TITLE_KEYS[segments[4]] ?? 'titles.sections.media',
      };
    }
    return { key: 'titles.club' };
  }

  if (segments[0] === 'lists') {
    return { key: segments.length > 1 ? 'titles.list' : 'titles.lists' };
  }

  if (segments[0] === 'calculator') return { key: 'titles.calculator' };
  if (segments[0] === 'features') return { key: 'titles.features' };
  if (segments[0] === 'about') return { key: 'titles.about' };
  if (segments[0] === 'support') return { key: 'titles.support' };
  if (segments[0] === 'privacy') return { key: 'titles.privacy' };
  if (segments[0] === 'terms') return { key: 'titles.terms' };
  if (segments[0] === 'changelog') return { key: 'titles.changelog' };

  if (segments[0] === 'admin') return { key: 'titles.admin' };

  if (segments[0] === 'shared-log') return { key: 'titles.sharedLog' };

  const typeKey = MEDIA_TYPE_TITLE_KEYS[segments[0]];
  if (typeKey) {
    return { key: 'titles.mediaDetails', typeKey };
  }

  if (segments[0] === 'user') {
    return {
      key: 'titles.userSection',
      username: segments[1] || 'User',
      sectionKey:
        USER_SECTION_TITLE_KEYS[segments[2]] ?? 'titles.sections.profile',
    };
  }
  if (segments[0] === 'goals') return { key: 'titles.goals' };
  if (segments[0] === 'log') return { key: 'titles.createLog' };
  if (segments[0] === 'matchmedia') return { key: 'titles.matchMedia' };
  return { key: null };
}

function TitleManager() {
  const { pathname } = useLocation();
  const { t, i18n } = useTranslation(['nav', 'common']);

  useEffect(() => {
    const { key, sectionKey, typeKey, username } = getTitleDescriptor(pathname);

    if (!key) {
      document.title = APP_NAME;
      return;
    }

    const params: Record<string, string> = {};
    if (sectionKey) params.section = t(sectionKey);
    if (typeKey) params.type = t(typeKey);
    if (username) params.username = username;

    // The keys are already checked as ParseKeys above; widening here only
    // relaxes the per-key interpolation signature, which cannot be expressed
    // over a union of keys.
    const translate = t as (
      key: TitleKey,
      params?: Record<string, string>
    ) => string;

    document.title = `${translate(key, params)} • ${APP_NAME}`;
    // i18n.language is a dependency so the title is recomputed on switch
  }, [pathname, t, i18n.language]);

  return null;
}

function ScrollToTop() {
  const { pathname, search, hash } = useLocation();
  const previousPathnameRef = useRef(pathname);

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
    const previousPathname = previousPathnameRef.current;
    const previousMediaTab = parseMediaTabRoute(previousPathname);
    const currentMediaTab = parseMediaTabRoute(pathname);

    const isSwitchingBetweenMediaTabs =
      previousMediaTab &&
      currentMediaTab &&
      previousMediaTab.key === currentMediaTab.key &&
      previousMediaTab.section !== currentMediaTab.section;

    if (isSwitchingBetweenMediaTabs) {
      previousPathnameRef.current = pathname;
      return;
    }

    // Reset both window/document scroll and any app-level scroll container.
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;

    const main = document.querySelector('main');
    if (main) {
      main.scrollTop = 0;
    }

    previousPathnameRef.current = pathname;
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

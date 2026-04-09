import { useEffect, useState } from 'react';
import { useUserDataStore } from '../store/userData';

const defaultTheme = 'system';
const freeThemes = ['system', 'light', 'dark'];

const patreonThemes = [
  'winter',
  'cupcake',
  'bumblebee',
  'emerald',
  'corporate',
  'valentine',
  'garden',
  'cmyk',
  'retro',
  'forest',
  'synthwave',
  'halloween',
  'dracula',
  'night',
  'dim',
  'sunset',
  'abyss',
];

const themes = [...freeThemes, ...patreonThemes];

const normalizeTheme = (theme: string | null | undefined) => {
  if (!theme) {
    return defaultTheme;
  }

  return theme;
};

const resolveTheme = (theme: string) => {
  if (theme === 'system') {
    if (
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
    ) {
      return 'dark';
    }

    return 'light';
  }

  return theme;
};

// Global theme management to prevent conflicts
let globalTheme: string | null = null;

// Initialize theme immediately (before React renders)
const getInitialTheme = () => {
  if (typeof window !== 'undefined') {
    // Check if we already have a global theme set
    if (globalTheme) return globalTheme;

    const saved = localStorage.getItem('theme');
    const theme = normalizeTheme(saved);
    globalTheme = theme;
    return theme;
  }
  return defaultTheme;
};

// Set theme on document immediately
const initialTheme = getInitialTheme();
if (typeof document !== 'undefined') {
  document.documentElement.setAttribute(
    'data-theme',
    resolveTheme(initialTheme)
  );
}

export default function ThemeSwitcher() {
  const { user } = useUserDataStore();
  const hasPatreonAccess =
    (user?.patreon?.isActive && user?.patreon?.tier) ||
    user?.roles?.includes('admin');

  const [theme, setTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      return normalizeTheme(localStorage.getItem('theme'));
    }
    return defaultTheme;
  });

  // Track the theme when entering settings (for reverting on exit)
  const [originalTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      return normalizeTheme(localStorage.getItem('theme'));
    }
    return defaultTheme;
  });

  // Update theme and save to localStorage
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', resolveTheme(theme));
    localStorage.setItem('theme', theme);
    globalTheme = theme; // Update global reference
  }, [theme]);

  // Keep system theme synced with OS preference changes
  useEffect(() => {
    if (theme !== 'system') {
      return;
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const applySystemTheme = () => {
      document.documentElement.setAttribute(
        'data-theme',
        resolveTheme('system')
      );
      window.dispatchEvent(
        new CustomEvent('themeChange', { detail: 'system' })
      );
    };

    mediaQuery.addEventListener('change', applySystemTheme);

    return () => {
      mediaQuery.removeEventListener('change', applySystemTheme);
    };
  }, [theme]);

  // Revert to original theme on unmount if user selected premium theme without access
  useEffect(() => {
    return () => {
      if (!hasPatreonAccess && !freeThemes.includes(theme)) {
        // Revert to original theme if it was a free theme, otherwise default to system
        const revertTheme = freeThemes.includes(originalTheme)
          ? originalTheme
          : defaultTheme;
        document.documentElement.setAttribute(
          'data-theme',
          resolveTheme(revertTheme)
        );
        localStorage.setItem('theme', revertTheme);
        globalTheme = revertTheme;
      }
    };
  }, [hasPatreonAccess, theme, originalTheme]);

  // Sync theme between tabs and components
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'theme' && e.newValue && e.newValue !== theme) {
        const nextTheme = normalizeTheme(e.newValue);
        setTheme(nextTheme);
        document.documentElement.setAttribute(
          'data-theme',
          resolveTheme(nextTheme)
        );
        globalTheme = nextTheme;
      }
    };

    // Also listen for custom theme events
    const onThemeChange = (e: CustomEvent) => {
      const nextTheme = normalizeTheme(e.detail as string | null | undefined);

      if (nextTheme !== theme) {
        setTheme(nextTheme);
        globalTheme = nextTheme;
      }
    };

    window.addEventListener('storage', onStorage);
    window.addEventListener('themeChange', onThemeChange as EventListener);

    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('themeChange', onThemeChange as EventListener);
    };
  }, [theme]);

  const handleThemeChange = (newTheme: string) => {
    const nextTheme = normalizeTheme(newTheme);
    setTheme(nextTheme);
    globalTheme = nextTheme;
    // Dispatch custom event to notify other components
    window.dispatchEvent(new CustomEvent('themeChange', { detail: nextTheme }));
  };

  return (
    <div className="dropdown w-full">
      <div tabIndex={0} role="button" className="btn w-full">
        Tema: {theme.charAt(0).toUpperCase() + theme.slice(1)}
        <svg
          width="12px"
          height="12px"
          className="inline-block h-2 w-2 fill-current opacity-60"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 2048 2048"
        >
          <path d="M1799 349l242 241-1017 1017L7 590l242-241 775 775 775-775z"></path>
        </svg>
      </div>
      <ul
        tabIndex={0}
        className="dropdown-content bg-base-300 rounded-box z-50 w-52 p-2 shadow-2xl overflow-y-auto max-h-72"
      >
        {themes.map((t) => {
          const isLocked = !hasPatreonAccess && patreonThemes.includes(t);
          return (
            <li key={t}>
              <label
                className={`flex items-center gap-2 cursor-pointer p-2 hover:bg-base-200 rounded ${isLocked ? 'opacity-50' : ''}`}
              >
                <input
                  type="radio"
                  name="theme-controller"
                  className="theme-controller"
                  value={t}
                  checked={theme === t}
                  onChange={() => handleThemeChange(t)}
                  disabled={isLocked}
                />
                <span className="capitalize flex-1">{t}</span>
                {isLocked && (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4 text-warning"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

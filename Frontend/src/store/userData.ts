import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ILoginResponse } from '../types';

const FREE_THEMES = new Set(['light', 'dark', 'system']);
const FREE_TEXTHOOKER_THEMES = new Set(['', 'light', 'dark', 'system']);

const resolveThemeForDocument = (theme: string) => {
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

const resetThemesForLoggedOutUser = () => {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  const currentTheme = localStorage.getItem('theme');
  const nextTheme =
    currentTheme && FREE_THEMES.has(currentTheme) ? currentTheme : 'system';

  localStorage.setItem('theme', nextTheme);
  document.documentElement.setAttribute(
    'data-theme',
    resolveThemeForDocument(nextTheme)
  );
  window.dispatchEvent(new CustomEvent('themeChange', { detail: nextTheme }));

  const currentTextHookerTheme = localStorage.getItem('texthooker_theme');
  const nextTextHookerTheme =
    currentTextHookerTheme && FREE_TEXTHOOKER_THEMES.has(currentTextHookerTheme)
      ? currentTextHookerTheme
      : 'system';

  localStorage.setItem('texthooker_theme', nextTextHookerTheme);
};

type userDataState = {
  user: ILoginResponse | null;
  setUser: (user: ILoginResponse) => void;
  logout: () => void;
  handleTokenExpiration: () => void;
};

function mergeUserState(
  currentUser: ILoginResponse | null,
  incomingUser: ILoginResponse
): ILoginResponse {
  if (!currentUser) {
    return incomingUser;
  }

  return {
    ...currentUser,
    ...incomingUser,
    settings: incomingUser.settings
      ? {
          ...currentUser.settings,
          ...incomingUser.settings,
        }
      : currentUser.settings,
    patreon: incomingUser.patreon
      ? {
          ...currentUser.patreon,
          ...incomingUser.patreon,
        }
      : currentUser.patreon,
  };
}

export const useUserDataStore = create(
  persist<userDataState>(
    (set) => ({
      user: null,
      setUser: (user: ILoginResponse) => {
        // Preserve current theme when setting user data
        const currentTheme = localStorage.getItem('theme') || 'system';
        set((state) => ({ user: mergeUserState(state.user, user) }));

        // Restore theme if it was changed during user update
        if (typeof document !== 'undefined') {
          const resolvedTheme = resolveThemeForDocument(currentTheme);
          const documentTheme =
            document.documentElement.getAttribute('data-theme');

          if (documentTheme !== resolvedTheme) {
            document.documentElement.setAttribute('data-theme', resolvedTheme);
          }
        }
      },
      logout: () => {
        set({ user: null });
        resetThemesForLoggedOutUser();
        useUserDataStore.persist.clearStorage();
      },
      handleTokenExpiration: () => {
        set({ user: null });
        resetThemesForLoggedOutUser();
        useUserDataStore.persist.clearStorage();

        if (typeof window !== 'undefined') {
          const protectedRoutes = ['/log', '/matchmedia', '/settings'];
          const currentPath = window.location.pathname;

          const isProtectedRoute = protectedRoutes.some(
            (route) =>
              currentPath === route || currentPath.startsWith(route + '/')
          );

          if (isProtectedRoute && currentPath !== '/login') {
            window.location.href = '/login';
          }
        }
      },
    }),
    {
      name: 'userData',
    }
  )
);

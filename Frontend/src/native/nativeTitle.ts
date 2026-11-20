import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { create } from 'zustand';

/** Screen titles from loaded data, keyed by the path that set them. */
export const useNativeTitleStore = create<{ titles: Record<string, string> }>(
  () => ({ titles: {} }),
);

/**
 * Show `title` in the native header for the current path, in place of the generic route title.
 * Pass undefined while the data loads. The generic title stays until a value arrives.
 */
export function useNativeTitle(title: string | undefined | null) {
  const { pathname } = useLocation();
  useEffect(() => {
    const value = title?.trim();
    if (!value) return undefined;
    useNativeTitleStore.setState((state) => ({
      titles: { ...state.titles, [pathname]: value },
    }));
    return () => {
      useNativeTitleStore.setState((state) => {
        const titles = { ...state.titles };
        delete titles[pathname];
        return { titles };
      });
    };
  }, [pathname, title]);
}

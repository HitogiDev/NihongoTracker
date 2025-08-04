import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ILoginResponse } from '../types';

type userDataState = {
  user: ILoginResponse | null;
  setUser: (user: ILoginResponse) => void;
  logout: () => void;
  handleTokenExpiration: () => void;
};

export const useUserDataStore = create(
  persist<userDataState>(
    (set) => ({
      user: null,
      setUser: (user: ILoginResponse) => {
        // Preserve current theme when setting user data
        const currentTheme = localStorage.getItem('theme');
        set({ user: user });

        // Restore theme if it was changed during user update
        if (currentTheme && typeof document !== 'undefined') {
          const documentTheme =
            document.documentElement.getAttribute('data-theme');
          if (documentTheme !== currentTheme) {
            document.documentElement.setAttribute('data-theme', currentTheme);
          }
        }
      },
      logout: () => {
        set({ user: null });
        // Limpiar el store persistido
        useUserDataStore.persist.clearStorage();
      },
      handleTokenExpiration: () => {
        // Función específica para manejar la expiración del token
        set({ user: null });
        useUserDataStore.persist.clearStorage();

        // Redirigir a login si no estamos ya ahí
        if (
          typeof window !== 'undefined' &&
          window.location.pathname !== '/login'
        ) {
          window.location.href = '/login';
        }
      },
    }),
    {
      name: 'userData',
    }
  )
);

import { createContext, ReactNode } from 'react';
import { useUserDataStore } from '../store/userData';

interface TimezoneContextType {
  timezone: string;
}

export const TimezoneContext = createContext<TimezoneContextType>({
  timezone: 'UTC',
});

interface TimezoneProviderProps {
  children: ReactNode;
}

export function TimezoneProvider({ children }: TimezoneProviderProps) {
  const { user } = useUserDataStore();
  const timezone = user?.settings?.timezone || 'UTC';

  return (
    <TimezoneContext.Provider value={{ timezone }}>
      {children}
    </TimezoneContext.Provider>
  );
}

import { ReactNode } from 'react';
import { useUserDataStore } from '../store/userData';
import { TimezoneContext } from './timezoneContext';

interface TimezoneProviderProps {
  children: ReactNode;
}

export function TimezoneProvider({ children }: TimezoneProviderProps) {
  const { user } = useUserDataStore();
  const timezone = user?.settings?.timezone || 'UTC';

  return <TimezoneContext value={{ timezone }}>{children}</TimezoneContext>;
}

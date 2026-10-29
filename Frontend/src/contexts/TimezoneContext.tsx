import { ReactNode } from 'react';
import { useUserDataStore } from '../store/userData';
import { TimezoneContext } from './timezoneContext';

interface TimezoneProviderProps {
  children: ReactNode;
}

export function TimezoneProvider({ children }: TimezoneProviderProps) {
  const { user } = useUserDataStore();
  const timezone = user?.settings?.timezone || 'UTC';
  const dayStartHour = user?.settings?.dayStartHour ?? 0;

  return (
    <TimezoneContext value={{ timezone, dayStartHour }}>
      {children}
    </TimezoneContext>
  );
}

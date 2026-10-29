import { createContext } from 'react';

export interface TimezoneContextType {
  timezone: string;
  /** Local hour when the user's day starts. Earlier activity counts toward the previous day. */
  dayStartHour: number;
}

export const TimezoneContext = createContext<TimezoneContextType>({
  timezone: 'UTC',
  dayStartHour: 0,
});

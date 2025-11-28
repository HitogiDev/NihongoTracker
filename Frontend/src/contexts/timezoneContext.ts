import { createContext } from 'react';

export interface TimezoneContextType {
  timezone: string;
}

export const TimezoneContext = createContext<TimezoneContextType>({
  timezone: 'UTC',
});

import { useContext } from 'react';
import { TimezoneContext } from '../contexts/timezoneContext';

export const useTimezone = () => {
  return useContext(TimezoneContext);
};

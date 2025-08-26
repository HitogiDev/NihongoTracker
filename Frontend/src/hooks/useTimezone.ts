import { useContext } from 'react';
import { TimezoneContext } from '../contexts/TimezoneContext';

export const useTimezone = () => {
  return useContext(TimezoneContext);
};

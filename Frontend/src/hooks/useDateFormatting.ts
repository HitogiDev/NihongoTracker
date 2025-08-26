import { useTimezone } from './useTimezone';
import {
  formatDateInTimezone,
  formatRelativeDateInTimezone,
  convertToUserTimezone,
  isSameDayInTimezone,
  getCurrentTimeInTimezone,
  getDayBoundsInTimezone,
} from '../utils/timezone';

export const useDateFormatting = () => {
  const { timezone } = useTimezone();

  const formatDate = (
    date: Date | string,
    options?: Intl.DateTimeFormatOptions
  ) => formatDateInTimezone(date, timezone, options);

  const formatRelativeDate = (date: Date | string) =>
    formatRelativeDateInTimezone(date, timezone);

  const convertToUserTime = (date: Date | string) =>
    convertToUserTimezone(date, timezone);

  const isSameDay = (date1: Date | string, date2: Date | string) =>
    isSameDayInTimezone(date1, date2, timezone);

  const getCurrentTime = () => getCurrentTimeInTimezone(timezone);

  const getDayBounds = (date: Date | string) =>
    getDayBoundsInTimezone(date, timezone);

  const formatDateOnly = (date: Date | string) =>
    formatDateInTimezone(date, timezone, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

  const formatDateTime = (date: Date | string) =>
    formatDateInTimezone(date, timezone, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  const formatTime = (date: Date | string) =>
    formatDateInTimezone(date, timezone, {
      hour: '2-digit',
      minute: '2-digit',
    });

  return {
    timezone,
    formatDate,
    formatRelativeDate,
    convertToUserTime,
    isSameDay,
    getCurrentTime,
    getDayBounds,
    formatDateOnly,
    formatDateTime,
    formatTime,
  };
};

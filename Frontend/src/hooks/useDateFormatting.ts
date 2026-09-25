import { useTranslation } from 'react-i18next';
import { useTimezone } from './useTimezone';
import {
  formatDateInTimezone,
  formatRelativeDateInTimezone,
  convertToUserTimezone,
  isSameDayInTimezone,
  getCurrentTimeInTimezone,
  getDayBoundsInTimezone,
} from '../utils/timezone';

export function useDateFormatting() {
  const { timezone } = useTimezone();
  // Subscribing to the language matters even though the formatters read the
  // i18next singleton themselves: without it, a component that formats dates
  // but never calls `t` would keep rendering stale text after a switch.
  const { i18n } = useTranslation();

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

  const formatNumber = (value: number, options?: Intl.NumberFormatOptions) => {
    try {
      return new Intl.NumberFormat(i18n.language || 'en', options).format(
        value
      );
    } catch {
      return new Intl.NumberFormat('en', options).format(value);
    }
  };

  return {
    timezone,
    language: i18n.language,
    formatNumber,
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
}

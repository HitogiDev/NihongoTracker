import i18n from '../i18n';

/**
 * The active UI language. This module is inherently locale-aware, so it reads
 * the i18next singleton directly rather than taking a locale parameter — that
 * keeps the ~40 existing call sites correct without touching any of them.
 */
export const getLocale = (): string => i18n.language || 'en';

/**
 * Timezone utility functions for handling user timezone preferences
 */

const FALLBACK_TIMEZONE = 'UTC';

// Get list of common timezones
export const getTimezones = (): { label: string; value: string }[] => {
  // Get common timezones manually since Intl.supportedValuesOf may not be available
  const timezones = [
    'UTC',
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'America/Anchorage',
    'America/Honolulu',
    'America/Toronto',
    'America/Vancouver',
    'America/Mexico_City',
    'America/Sao_Paulo',
    'America/Buenos_Aires',
    'Europe/London',
    'Europe/Paris',
    'Europe/Berlin',
    'Europe/Rome',
    'Europe/Madrid',
    'Europe/Amsterdam',
    'Europe/Brussels',
    'Europe/Vienna',
    'Europe/Zurich',
    'Europe/Stockholm',
    'Europe/Oslo',
    'Europe/Copenhagen',
    'Europe/Helsinki',
    'Europe/Warsaw',
    'Europe/Prague',
    'Europe/Budapest',
    'Europe/Athens',
    'Europe/Istanbul',
    'Europe/Moscow',
    'Asia/Tokyo',
    'Asia/Shanghai',
    'Asia/Seoul',
    'Asia/Hong_Kong',
    'Asia/Singapore',
    'Asia/Bangkok',
    'Asia/Jakarta',
    'Asia/Manila',
    'Asia/Kolkata',
    'Asia/Dubai',
    'Asia/Tehran',
    'Asia/Karachi',
    'Asia/Dhaka',
    'Asia/Yangon',
    'Australia/Sydney',
    'Australia/Melbourne',
    'Australia/Brisbane',
    'Australia/Perth',
    'Australia/Adelaide',
    'Pacific/Auckland',
    'Pacific/Fiji',
    'Pacific/Honolulu',
    'Africa/Cairo',
    'Africa/Lagos',
    'Africa/Nairobi',
    'Africa/Johannesburg',
  ];

  // Create a map of timezone names to their formatted display names
  const timezoneMap = new Map<string, string>();

  timezones.forEach((tz: string) => {
    try {
      const now = new Date();
      // Try to get a shorter timezone name first
      const shortFormatter = new Intl.DateTimeFormat('en', {
        timeZone: tz,
        timeZoneName: 'short',
      });

      const longFormatter = new Intl.DateTimeFormat('en', {
        timeZone: tz,
        timeZoneName: 'long',
      });

      const shortParts = shortFormatter.formatToParts(now);
      const longParts = longFormatter.formatToParts(now);

      const shortName = shortParts.find(
        (part) => part.type === 'timeZoneName'
      )?.value;
      const longName = longParts.find(
        (part) => part.type === 'timeZoneName'
      )?.value;

      // Use short name if available and different from timezone ID, otherwise use long name
      const timeZoneName =
        shortName && shortName !== tz ? shortName : longName || tz;

      // Get the offset for sorting
      const offset = getTimezoneOffset(tz);
      const offsetStr = formatTimezoneOffset(offset);

      // Format: "America/New_York" -> "EST (UTC-5)" or fallback to "Eastern Standard Time (UTC-5)"
      const label = `${timeZoneName} (${offsetStr})`;
      timezoneMap.set(tz, label);
    } catch (error) {
      // Fallback for invalid timezones
      timezoneMap.set(tz, tz);
    }
  });

  // Convert to array and sort by offset then by name
  const timezoneArray = Array.from(timezoneMap.entries()).map(
    ([value, label]) => ({
      value,
      label,
      offset: getTimezoneOffset(value),
    })
  );

  timezoneArray.sort((a, b) => {
    // Sort by offset first, then by label
    if (a.offset !== b.offset) {
      return a.offset - b.offset;
    }
    return a.label.localeCompare(b.label);
  });

  return timezoneArray.map(({ value, label }) => ({ value, label }));
};

// Get common/popular timezones for easier selection
export const getCommonTimezones = (): { label: string; value: string }[] => {
  const commonTzs = [
    'UTC',
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'Europe/London',
    'Europe/Paris',
    'Europe/Berlin',
    'Europe/Rome',
    'Europe/Madrid',
    'Asia/Tokyo',
    'Asia/Shanghai',
    'Asia/Seoul',
    'Asia/Kolkata',
    'Asia/Dubai',
    'Australia/Sydney',
    'Australia/Melbourne',
    'Pacific/Auckland',
  ];

  return commonTzs.map((tz: string) => {
    try {
      const now = new Date();
      const formatter = new Intl.DateTimeFormat('en', {
        timeZone: tz,
        timeZoneName: 'long',
      });

      const parts = formatter.formatToParts(now);
      const timeZoneName =
        parts.find((part) => part.type === 'timeZoneName')?.value || tz;
      const offset = getTimezoneOffset(tz);
      const offsetStr = formatTimezoneOffset(offset);

      return {
        value: tz,
        label: `${timeZoneName} (${offsetStr})`,
      };
    } catch (error) {
      return {
        value: tz,
        label: tz,
      };
    }
  });
};

// Get timezone offset in minutes
export const getTimezoneOffset = (timezone: string): number => {
  try {
    const now = new Date();
    const utcDate = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
    const tzDate = new Date(
      now.toLocaleString('en-US', { timeZone: timezone })
    );
    return (utcDate.getTime() - tzDate.getTime()) / (1000 * 60);
  } catch (error) {
    return 0;
  }
};

// Format timezone offset as string (e.g., "UTC+5", "UTC-3")
export const formatTimezoneOffset = (offsetMinutes: number): string => {
  const hours = Math.floor(Math.abs(offsetMinutes) / 60);
  const minutes = Math.abs(offsetMinutes) % 60;
  const sign = offsetMinutes <= 0 ? '+' : '-';

  if (minutes === 0) {
    return `UTC${sign}${hours}`;
  } else {
    return `UTC${sign}${hours}:${minutes.toString().padStart(2, '0')}`;
  }
};

// Convert a UTC date to user's timezone
export const convertToUserTimezone = (
  date: Date | string,
  timezone?: string
): Date => {
  const utcDate = typeof date === 'string' ? new Date(date) : date;

  if (!timezone || timezone === 'UTC') {
    return utcDate;
  }

  try {
    // Create a new date in the user's timezone
    const userTimeString = utcDate.toLocaleString('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

    return new Date(userTimeString);
  } catch (error) {
    console.warn('Failed to convert to user timezone:', error);
    return utcDate;
  }
};

// Format a date for display in user's timezone
export const formatDateInTimezone = (
  date: Date | string,
  timezone?: string,
  options?: Intl.DateTimeFormatOptions
): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;

  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
    ...options,
  };

  if (!timezone || timezone === 'UTC') {
    return dateObj.toLocaleDateString(getLocale(), {
      ...defaultOptions,
      timeZone: 'UTC',
    });
  }

  try {
    return dateObj.toLocaleDateString(getLocale(), {
      ...defaultOptions,
      timeZone: timezone,
    });
  } catch (error) {
    console.warn('Failed to format date in timezone:', error);
    return dateObj.toLocaleDateString(getLocale(), defaultOptions);
  }
};

const relativeTime = (value: number, unit: Intl.RelativeTimeFormatUnit) => {
  try {
    return new Intl.RelativeTimeFormat(getLocale(), {
      numeric: 'auto',
    }).format(value, unit);
  } catch {
    return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(
      value,
      unit
    );
  }
};

// Format relative time in user's timezone (e.g., "2 hours ago", "yesterday")
export const formatRelativeDateInTimezone = (
  date: Date | string,
  timezone?: string
): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();

  // Convert both dates to the user's timezone for comparison
  const userDate = convertToUserTimezone(dateObj, timezone);
  const userNow = convertToUserTimezone(now, timezone);

  const diffMs = userNow.getTime() - userDate.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  // Intl.RelativeTimeFormat handles grammar and pluralisation per language, so
  // "hace 2 horas" / "ayer" come for free instead of needing a key each.
  // Only "just now" needs one: a zero delta renders as "this minute", which
  // reads wrong.
  if (diffMinutes < 1) {
    return i18n.t('common:time.justNow');
  } else if (diffMinutes < 60) {
    return relativeTime(-diffMinutes, 'minute');
  } else if (diffHours < 24) {
    return relativeTime(-diffHours, 'hour');
  } else if (diffDays < 7) {
    return relativeTime(-diffDays, 'day');
  } else {
    return formatDateInTimezone(dateObj, timezone, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }
};

/**
 * Day/time bucketing in the user's configured timezone.
 *
 * A log stores one instant, but every day-based reader (streaks, heatmap,
 * rankings) buckets it by the calendar day that instant falls on *in the user's
 * configured timezone*. Write paths therefore have to build instants in the
 * same frame. Using the browser's local timezone instead is what made backdated
 * logs land a day early (missing the heatmap cell and leaving the streak hole
 * unfilled) and made editing an evening log's date a silent no-op: the day was
 * read back in UTC while the replacement was built in local time, so for a log
 * whose UTC day and local day differ the "new" instant equalled the old one.
 */
function zonedParts(
  date: Date,
  timeZone: string
): { year: number; month: number; day: number; hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    // h23 keeps midnight as "00" — hour12:false reports it as "24" in some engines.
    hourCycle: 'h23',
  }).formatToParts(date);

  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? '0');

  return {
    year: value('year'),
    month: value('month'),
    day: value('day'),
    hour: value('hour'),
    minute: value('minute'),
  };
}

/** Offset of `timeZone` at the given instant, in milliseconds. */
function zoneOffsetMs(date: Date, timeZone: string): number {
  const { year, month, day, hour, minute } = zonedParts(date, timeZone);
  const asIfUtc = Date.UTC(year, month - 1, day, hour, minute);
  // Seconds/ms don't shift across timezones, so compare on whole minutes.
  return asIfUtc - Math.floor(date.getTime() / 60000) * 60000;
}

/** The calendar day (YYYY-MM-DD) an instant falls on in the given timezone. */
export const getDayKeyInTimezone = (
  date: Date | string,
  timezone?: string
): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(dateObj.getTime())) return '';
  try {
    const { year, month, day } = zonedParts(dateObj, timezone || FALLBACK_TIMEZONE);
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  } catch {
    return dateObj.toISOString().split('T')[0];
  }
};

/** The wall-clock time (HH:mm) an instant shows in the given timezone. */
export const getTimeInTimezone = (
  date: Date | string,
  timezone?: string
): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(dateObj.getTime())) return '';
  try {
    const { hour, minute } = zonedParts(dateObj, timezone || FALLBACK_TIMEZONE);
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  } catch {
    return '';
  }
};

/**
 * The instant at which the given wall clock (`YYYY-MM-DD` + `HH:mm`) reads in
 * `timezone` — the inverse of the two helpers above.
 */
export const zonedDayTimeToUtc = (
  dayKey: string,
  time: string,
  timezone?: string
): Date => {
  const [year, month, day] = dayKey.split('-').map(Number);
  const [hour, minute] = (time || '00:00').split(':').map(Number);
  const wallClock = Date.UTC(year, month - 1, day, hour || 0, minute || 0);
  const zone = timezone || FALLBACK_TIMEZONE;

  try {
    // Treat the wall clock as UTC, then step back by the zone's offset. The
    // offset is re-read at the resulting instant because a DST boundary between
    // the two can make the first guess an hour off.
    const firstGuess = wallClock - zoneOffsetMs(new Date(wallClock), zone);
    const corrected = wallClock - zoneOffsetMs(new Date(firstGuess), zone);
    return new Date(corrected);
  } catch {
    return new Date(year, (month || 1) - 1, day, hour || 0, minute || 0);
  }
};

/**
 * Turn a calendar day picked in a date picker into the instant to store.
 *
 * Date pickers hand back local midnight of the chosen day, which is an instant
 * in the *browser's* timezone — re-read in the user's configured timezone it
 * can be the previous or next day, so a backdated log missed the heatmap cell
 * and the streak hole it was meant to fill. Anchor the day in the user's own
 * timezone instead: at the current time when they picked today, otherwise at
 * midday, which no timezone or DST shift can push onto an adjacent day.
 */
export const pickedDayToUtc = (picked: Date, timezone?: string): Date => {
  const dayKey = `${picked.getFullYear()}-${String(picked.getMonth() + 1).padStart(2, '0')}-${String(picked.getDate()).padStart(2, '0')}`;
  const zone = timezone || FALLBACK_TIMEZONE;
  const now = new Date();

  if (getDayKeyInTimezone(now, zone) === dayKey) return now;
  return zonedDayTimeToUtc(dayKey, '12:00', zone);
};

// Get user's detected timezone
export const getUserTimezone = (): string => {
  try {
    return (
      Intl.DateTimeFormat().resolvedOptions().timeZone || FALLBACK_TIMEZONE
    );
  } catch (error) {
    return FALLBACK_TIMEZONE;
  }
};

// Get current date/time in user's timezone
export const getCurrentTimeInTimezone = (timezone?: string): Date => {
  if (!timezone || timezone === 'UTC') {
    return new Date();
  }

  try {
    const now = new Date();
    const timeString = now.toLocaleString('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

    return new Date(timeString);
  } catch (error) {
    return new Date();
  }
};

// Check if two dates are on the same day in a given timezone
export const isSameDayInTimezone = (
  date1: Date | string,
  date2: Date | string,
  timezone?: string
): boolean => {
  const d1 = convertToUserTimezone(date1, timezone);
  const d2 = convertToUserTimezone(date2, timezone);

  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
};

// Get start and end of day in user's timezone
export const getDayBoundsInTimezone = (
  date: Date | string,
  timezone?: string
): { start: Date; end: Date } => {
  const userDate = convertToUserTimezone(date, timezone);

  // Start of day in user's timezone
  const start = new Date(userDate);
  start.setHours(0, 0, 0, 0);

  // End of day in user's timezone
  const end = new Date(userDate);
  end.setHours(23, 59, 59, 999);

  return { start, end };
};

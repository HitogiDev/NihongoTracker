/**
 * Timezone utility functions for handling user timezone preferences
 */

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

      // Format: "America/New_York" -> "EST (GMT-5)" or fallback to "Eastern Standard Time (GMT-5)"
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

// Format timezone offset as string (e.g., "GMT+5", "GMT-3")
export const formatTimezoneOffset = (offsetMinutes: number): string => {
  const hours = Math.floor(Math.abs(offsetMinutes) / 60);
  const minutes = Math.abs(offsetMinutes) % 60;
  const sign = offsetMinutes <= 0 ? '+' : '-';

  if (minutes === 0) {
    return `GMT${sign}${hours}`;
  } else {
    return `GMT${sign}${hours}:${minutes.toString().padStart(2, '0')}`;
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
    return dateObj.toLocaleDateString('en-US', {
      ...defaultOptions,
      timeZone: 'UTC',
    });
  }

  try {
    return dateObj.toLocaleDateString('en-US', {
      ...defaultOptions,
      timeZone: timezone,
    });
  } catch (error) {
    console.warn('Failed to format date in timezone:', error);
    return dateObj.toLocaleDateString('en-US', defaultOptions);
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

  if (diffMinutes < 1) {
    return 'Just now';
  } else if (diffMinutes < 60) {
    return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else {
    return formatDateInTimezone(dateObj, timezone, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }
};

// Get user's detected timezone
export const getUserTimezone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch (error) {
    return 'UTC';
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

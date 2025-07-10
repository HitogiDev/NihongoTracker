import { ILog } from '../types';

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

export const validateUsername = (username: string): string => {
  if (!username.trim()) return 'Username is required';
  if (username.length < 3) return 'Username must be at least 3 characters';
  if (username.length > 20) return 'Username must be less than 20 characters';
  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    return 'Username can only contain letters, numbers, hyphens, and underscores';
  }
  return '';
};

export const validatePassword = (password: string): string | null => {
  if (password.length < 8) {
    return 'Password must be at least 8 characters long';
  }
  return null;
};

export const validatePasswordMatch = (
  password: string,
  confirmPassword: string
): string => {
  if (!confirmPassword && password) return 'Please confirm your password';
  if (password !== confirmPassword) return 'Passwords do not match';
  return '';
};

export const validateEmail = (email: string): string => {
  if (!email.trim()) return '';
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) return 'Please enter a valid email address';
  return '';
};

export const validateDiscordId = (discordId: string): string => {
  if (!discordId.trim()) return '';
  if (!/^\d{17,19}$/.test(discordId.trim())) {
    return 'Discord ID must be 17-19 digits';
  }
  return '';
};

export const validateLogData = (
  logData: {
    type: ILog['type'] | null;
    mediaName: string;
    watchedEpisodes: number;
    hours: number;
    minutes: number;
    readChars: number;
    readPages: number;
  },
  touched: Record<string, boolean> = {}
): ValidationResult => {
  const errors: Record<string, string> = {};

  // Type validation - only show if touched
  if (touched.type && !logData.type) {
    errors.type = 'Please select a log type';
  }

  // Media name validation - only show if touched
  if (touched.mediaName) {
    if (!logData.mediaName.trim()) {
      errors.mediaName = 'Please enter a title or description';
    } else if (logData.mediaName.length > 200) {
      errors.mediaName = 'Title must be less than 200 characters';
    }
  }

  // Type-specific validation - only show if relevant fields are touched
  if (logData.type === 'anime' && touched.episodes) {
    if (logData.watchedEpisodes <= 0) {
      errors.episodes =
        'Please enter the number of episodes watched (must be greater than 0)';
    } else if (logData.watchedEpisodes > 1000) {
      errors.episodes = 'Episode count seems unreasonably high (max: 1000)';
    }
  }

  // Movie validation - require time input
  if (logData.type === 'movie' && touched.time) {
    const totalMinutes = logData.hours * 60 + logData.minutes;
    if (totalMinutes <= 0) {
      errors.time = 'Please enter the movie duration (must be greater than 0)';
    } else if (totalMinutes > 1000) {
      errors.time =
        'Movie duration seems unreasonably high (max: 1000 minutes)';
    }
  }

  const totalMinutes = logData.hours * 60 + logData.minutes;

  // Time validation - only show if time fields are touched
  if (
    (touched.hours || touched.minutes) &&
    ['video', 'movie', 'audio', 'other'].includes(logData.type || '')
  ) {
    if (totalMinutes <= 0) {
      errors.time = 'Please enter the time spent (must be greater than 0)';
    } else if (totalMinutes > 1440) {
      errors.time = 'Time seems unreasonably high (max: 24 hours)';
    }
  }

  // Type-specific time requirements - only show if time is touched and type requires it
  if (
    (touched.hours || touched.minutes) &&
    (logData.type === 'video' || logData.type === 'audio') &&
    totalMinutes <= 0
  ) {
    errors.time = 'Please enter the time spent (must be greater than 0)';
  }

  // Reading activity validation - only show if relevant fields are touched
  if (logData.type === 'reading' || logData.type === 'vn') {
    if (
      (touched.chars || touched.hours || touched.minutes) &&
      logData.readChars <= 0 &&
      totalMinutes <= 0
    ) {
      errors.activity = 'Please enter either characters read or time spent';
    }
  }

  if (logData.type === 'manga') {
    if (
      (touched.pages || touched.chars || touched.hours || touched.minutes) &&
      logData.readPages <= 0 &&
      logData.readChars <= 0 &&
      totalMinutes <= 0
    ) {
      errors.activity =
        'Please enter pages read, characters read, or time spent';
    }
  }

  // Reasonable limits validation - only show if touched
  if (touched.chars && logData.readChars > 1000000) {
    errors.chars = 'Character count seems unreasonably high (max: 1,000,000)';
  }

  if (touched.pages && logData.readPages > 10000) {
    errors.pages = 'Page count seems unreasonably high (max: 10,000)';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

export const validateQuickLogData = (logData: {
  type: ILog['type'] | null;
  description: string;
  episodes: number;
  chars: number;
  pages: number;
  hours: number;
  minutes: number;
}): ValidationResult => {
  const errors: Record<string, string> = {};

  if (!logData.type) {
    errors.type = 'Please select a log type';
  }

  if (!logData.description.trim()) {
    errors.description = 'Please enter a description';
  }

  const totalMinutes = logData.hours * 60 + logData.minutes;

  if (logData.type === 'anime' && logData.episodes <= 0) {
    errors.episodes = 'Please enter the number of episodes watched';
  }

  if (
    (logData.type === 'video' || logData.type === 'audio') &&
    totalMinutes <= 0
  ) {
    errors.time = 'Please enter the time spent';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

export const validateUpdateLogData = (logData: {
  description: string;
  type: ILog['type'];
  hours: number;
  minutes: number;
  episodes: number;
  chars: number;
  pages: number;
}): ValidationResult => {
  const errors: Record<string, string> = {};

  if (!logData.description.trim()) {
    errors.description = 'Description is required';
  }

  if (logData.hours > 24) {
    errors.hours = 'Hours cannot exceed 24';
  }

  if (logData.minutes > 59) {
    errors.minutes = 'Minutes cannot exceed 59';
  }

  const totalMinutes = logData.hours * 60 + logData.minutes;
  if (totalMinutes > 1440) {
    errors.time = 'Total time cannot exceed 24 hours';
  }

  if (logData.type === 'anime' && logData.episodes > 1000) {
    errors.episodes = 'Episode count seems unreasonably high (max: 1000)';
  }

  if (logData.chars > 1000000) {
    errors.chars = 'Character count seems unreasonably high (max: 1,000,000)';
  }

  if (logData.pages > 10000) {
    errors.pages = 'Page count seems unreasonably high (max: 10,000)';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

export const validateGoalTarget = (type: string, target: number): string => {
  if (target <= 0) return 'Target must be greater than 0';

  switch (type) {
    case 'time':
      if (target > 1440)
        return 'Daily time target cannot exceed 24 hours (1440 minutes)';
      break;
    case 'chars':
      if (target > 100000)
        return 'Daily character target seems unreasonably high (max: 100,000)';
      break;
    case 'episodes':
      if (target > 50)
        return 'Daily episode target seems unreasonably high (max: 50)';
      break;
    case 'pages':
      if (target > 500)
        return 'Daily page target seems unreasonably high (max: 500)';
      break;
  }

  return '';
};

export const validateSharedLogData = (logData: {
  description: string;
  episodes: number;
  time: number;
  chars: number;
  pages: number;
}): ValidationResult => {
  const errors: Record<string, string> = {};

  if (!logData.description.trim()) {
    errors.description = 'Description is required';
  }

  if (logData.episodes < 0) {
    errors.episodes = 'Episodes cannot be negative';
  }

  if (logData.time < 0) {
    errors.time = 'Time cannot be negative';
  }

  if (logData.chars < 0) {
    errors.chars = 'Characters cannot be negative';
  }

  if (logData.pages < 0) {
    errors.pages = 'Pages cannot be negative';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

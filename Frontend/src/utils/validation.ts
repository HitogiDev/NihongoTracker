import type { ParseKeys } from 'i18next';
import { ILog } from '../types';

/**
 * Validators return translation keys, not sentences — this module is pure and
 * has no access to the active language. Callers translate with
 * `useValidationText()`. An empty string still means "valid".
 */
export type ValidationKey = ParseKeys<'validation'> | '';

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, ValidationKey>;
}

export const validateUsername = (username: string): ValidationKey => {
  if (!username.trim()) return 'username.required';
  if (username.length < 1) return 'username.minLength';
  if (username.length > 20) return 'username.maxLength';
  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    return 'username.charset';
  }
  return '';
};

export const validateEmail = (email: string): ValidationKey => {
  if (!email.trim()) return '';
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) return 'email.invalid';
  return '';
};

export const validateLogin = (usernameOrEmail: string): ValidationKey => {
  if (!usernameOrEmail.trim()) return 'login.required';

  // Check if it looks like an email (contains @)
  if (usernameOrEmail.includes('@')) {
    // Validate as email
    const emailError = validateEmail(usernameOrEmail);
    if (emailError) return emailError;
  } else {
    // Validate as username
    const usernameError = validateUsername(usernameOrEmail);
    if (usernameError) return usernameError;
  }

  return '';
};

export const validatePassword = (password: string): ValidationKey | null => {
  if (password.length < 8) {
    return 'password.minLength';
  }
  return null;
};

export const validatePasswordMatch = (
  password: string,
  confirmPassword: string
): ValidationKey => {
  if (!confirmPassword && password) return 'password.confirmRequired';
  if (password !== confirmPassword) return 'password.mismatch';
  return '';
};

export const validateDiscordId = (discordId: string): ValidationKey => {
  if (!discordId.trim()) return '';
  if (!/^\d{17,19}$/.test(discordId.trim())) {
    return 'discordId.format';
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
  const errors: Record<string, ValidationKey> = {};

  if (touched.type && !logData.type) {
    errors.type = 'log.typeRequired';
  }

  if (touched.mediaName) {
    if (!logData.mediaName.trim()) {
      errors.mediaName = 'log.titleRequired';
    } else if (logData.mediaName.length > 200) {
      errors.mediaName = 'log.titleMaxLength';
    }
  }

  if (logData.type === 'anime' && touched.episodes) {
    if (logData.watchedEpisodes <= 0) {
      errors.episodes = 'log.episodesRequired';
    } else if (logData.watchedEpisodes > 1000) {
      errors.episodes = 'log.episodesTooHigh';
    }
  }

  // Movie validation - require time input
  if (logData.type === 'movie' && touched.time) {
    const totalMinutes = logData.hours * 60 + logData.minutes;
    if (totalMinutes <= 0) {
      errors.time = 'log.movieDurationRequired';
    } else if (totalMinutes > 1440) {
      errors.time = 'log.movieDurationTooHigh';
    }
  }

  const totalMinutes = logData.hours * 60 + logData.minutes;

  if (
    (touched.hours || touched.minutes) &&
    ['video', 'movie', 'audio', 'other', 'game'].includes(logData.type || '')
  ) {
    if (totalMinutes <= 0) {
      errors.time = 'log.timeRequired';
    } else if (totalMinutes > 1440) {
      errors.time = 'log.timeTooHigh';
    }
  }

  if (
    (touched.hours || touched.minutes) &&
    (logData.type === 'video' || logData.type === 'audio') &&
    totalMinutes <= 0
  ) {
    errors.time = 'log.timeRequired';
  }

  if (
    logData.type === 'reading' ||
    logData.type === 'vn' ||
    logData.type === 'game'
  ) {
    if (
      (touched.chars || touched.hours || touched.minutes) &&
      logData.readChars <= 0 &&
      totalMinutes <= 0
    ) {
      errors.activity = 'log.charsOrTime';
    }
  }

  if (logData.type === 'manga') {
    if (
      (touched.pages || touched.chars || touched.hours || touched.minutes) &&
      logData.readPages <= 0 &&
      logData.readChars <= 0 &&
      totalMinutes <= 0
    ) {
      errors.activity = 'log.pagesCharsOrTime';
    }
  }

  if (touched.chars && logData.readChars > 1000000) {
    errors.chars = 'log.charsTooHigh';
  }

  if (touched.pages && logData.readPages > 10000) {
    errors.pages = 'log.pagesTooHigh';
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
  const errors: Record<string, ValidationKey> = {};

  if (!logData.type) {
    errors.type = 'log.typeRequired';
  }

  if (!logData.description.trim()) {
    errors.description = 'log.descriptionRequired';
  }

  const totalMinutes = logData.hours * 60 + logData.minutes;
  const hasActivity =
    logData.episodes > 0 ||
    logData.chars > 0 ||
    logData.pages > 0 ||
    totalMinutes > 0;

  if (logData.type === 'anime' && logData.episodes <= 0) {
    errors.episodes = 'log.episodesRequiredShort';
  }

  if (
    (logData.type === 'video' || logData.type === 'audio') &&
    totalMinutes <= 0
  ) {
    errors.time = 'log.timeRequiredShort';
  }

  if (
    logData.type === 'manga' &&
    logData.pages <= 0 &&
    logData.chars <= 0 &&
    totalMinutes <= 0
  ) {
    errors.activity = 'log.pagesCharsOrTime';
  }

  if (
    logData.type === 'reading' &&
    logData.pages <= 0 &&
    logData.chars <= 0 &&
    totalMinutes <= 0
  ) {
    errors.activity = 'log.pagesCharsOrTime';
  }

  if (logData.type === 'vn' && logData.chars <= 0 && totalMinutes <= 0) {
    errors.activity = 'log.charsOrTimeShort';
  }

  if (logData.type === 'game' && logData.chars <= 0 && totalMinutes <= 0) {
    errors.activity = 'log.charsOrTimeShort';
  }

  if (logData.type && !hasActivity) {
    errors.activity = 'log.noProgress';
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
  volume: number;
  chars: number;
  pages: number;
}): ValidationResult => {
  const errors: Record<string, ValidationKey> = {};

  if (!logData.description.trim()) {
    errors.description = 'log.descriptionMissing';
  }

  if (logData.hours > 24) {
    errors.hours = 'log.hoursMax';
  }

  if (logData.minutes > 59) {
    errors.minutes = 'log.minutesMax';
  }

  const totalMinutes = logData.hours * 60 + logData.minutes;
  if (totalMinutes > 1440) {
    errors.time = 'log.totalTimeMax';
  }

  if (logData.type === 'anime' && logData.episodes > 1000) {
    errors.episodes = 'log.episodesTooHigh';
  }

  if (logData.chars > 1000000) {
    errors.chars = 'log.charsTooHigh';
  }

  if (logData.pages > 10000) {
    errors.pages = 'log.pagesTooHigh';
  }

  if (logData.volume > 10000) {
    errors.volume = 'log.volumeTooHigh';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

export const validateGoalTarget = (
  type: string,
  target: number
): ValidationKey => {
  if (target <= 0) return 'goal.targetPositive';

  switch (type) {
    case 'time':
      if (target > 1440) return 'goal.timeMax';
      break;
    case 'chars':
      if (target > 100000) return 'goal.charsMax';
      break;
    case 'episodes':
      if (target > 50) return 'goal.episodesMax';
      break;
    case 'pages':
      if (target > 500) return 'goal.pagesMax';
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
  const errors: Record<string, ValidationKey> = {};

  if (!logData.description.trim()) {
    errors.description = 'log.descriptionMissing';
  }

  if (logData.episodes < 0) {
    errors.episodes = 'log.episodesNegative';
  }

  if (logData.time < 0) {
    errors.time = 'log.timeNegative';
  }

  if (logData.chars < 0) {
    errors.chars = 'log.charsNegative';
  }

  if (logData.pages < 0) {
    errors.pages = 'log.pagesNegative';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

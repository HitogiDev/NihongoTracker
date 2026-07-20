import { Types } from 'mongoose';
import Log from '../models/log.model.js';
import { MediaBase } from '../models/media.model.js';
import { ILog, IXpBreakdown } from '../types.js';

/**
 * XP engine (formula v2).
 *
 * Philosophy: time is the base currency — one immersion hour earns the same
 * base XP regardless of reading speed. Characters act as validation (cap
 * implausible time claims) and as a time estimator when time is missing,
 * converted through the user's own reading speed. A difficulty multiplier
 * (Jiten data, phase 2) grants a bounded bonus for content that is
 * challenging relative to the user's level in the log's category; it never
 * penalizes (floor 1.0) and its ceiling is the same at every level.
 */

export const XP_FORMULA_VERSION = 2;

/** Base earn rate: 135 XP per immersion hour. */
export const XP_PER_HOUR = 135;
export const XP_PER_MINUTE = XP_PER_HOUR / 60;

/** Reference reading speed (chars/hour). Break-even point of the v1 formula. */
export const FALLBACK_READING_SPEED_CPH = 9450;
/** Clamp for a user's personal speed estimate (chars/hour). */
export const MIN_PERSONAL_SPEED_CPH = 3000;
export const MAX_PERSONAL_SPEED_CPH = 30000;
/**
 * Validation floor: when a log carries both time and chars, credited time is
 * capped at chars / MIN_PLAUSIBLE_SPEED_CPH so "2 hours, 500 chars" claims
 * don't earn 2 hours of XP. Low enough not to punish genuinely slow readers.
 */
export const MIN_PLAUSIBLE_SPEED_CPH = 2000;

/** Rough chars-per-page estimate used when a log only carries pages. */
export const CHARS_PER_PAGE = 250;
/** Minutes credited per episode when an anime/tv show log has no time. */
export const EPISODE_MINUTES = 24;
/** Game time is partially non-language gameplay unless chars prove otherwise. */
export const GAME_TIME_FACTOR = 0.75;

/** Difficulty bonus: max +30%, reachable at every level (normalized gap). */
export const MAX_DIFFICULTY_BONUS = 0.3;
/** Jiten's native difficulty scale tops out around 6 ("Expert"). */
export const JITEN_MAX_DIFFICULTY = 6;
/** Curve constant for comfort difficulty: Dc(L) = 100 * L / (L + K). */
export const COMFORT_CURVE_K = 25;

/**
 * Consumed-difficulty signal (Krashen i+1): the comfort point is raised to
 * the hours-weighted p75 of the difficulty the user actually consumed in the
 * category recently. max() with the level-based comfort makes it a ratchet —
 * consuming hard content raises your comfort, consuming easy content never
 * lowers it below what your level implies (no sandbagging).
 */
export const CONSUMED_DIFFICULTY_WINDOW_DAYS = 90;
export const CONSUMED_DIFFICULTY_MIN_HOURS = 10;
export const CONSUMED_DIFFICULTY_PERCENTILE = 0.75;

// Must mirror services/calculateLevel.ts (xpVar / xpDiff).
const LEVEL_XP_VAR = 0.07;
const LEVEL_XP_DIFF = 1.75;

export const LISTENING_TYPES: ILog['type'][] = [
  'anime',
  'video',
  'movie',
  'tv show',
  'audio',
];
export const READING_TYPES: ILog['type'][] = [
  'reading',
  'manga',
  'vn',
  'game',
];

export type LogCategory = 'reading' | 'listening' | null;

export function getLogCategory(type: ILog['type']): LogCategory {
  if (READING_TYPES.includes(type)) return 'reading';
  if (LISTENING_TYPES.includes(type)) return 'listening';
  return null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Continuous (un-floored) level for a category XP total. Matches the curve in
 * services/calculateLevel.ts but without Math.floor, so the difficulty
 * multiplier decays smoothly instead of jumping at level-ups.
 */
export function continuousLevel(xp: number): number {
  if (!xp || xp <= 0) return 0;
  return Math.pow(xp, 1 / LEVEL_XP_DIFF) * LEVEL_XP_VAR;
}

/**
 * Difficulty (0-100) a user of the given category level handles comfortably.
 * Saturates below 100 so top-difficulty content stays challenging forever.
 */
export function comfortDifficulty(categoryLevel: number): number {
  const level = Math.max(0, categoryLevel);
  return (100 * level) / (level + COMFORT_CURVE_K);
}

/** Native Jiten difficulty (0-6) → the engine's 0-100 scale. */
export function normalizeJitenDifficulty(
  difficulty: number | null | undefined
): number | null {
  if (difficulty === null || difficulty === undefined || difficulty < 0) {
    return null;
  }
  return clamp((difficulty / JITEN_MAX_DIFFICULTY) * 100, 0, 100);
}

/**
 * Weighted percentile: smallest value whose cumulative weight reaches the
 * given fraction of the total. Null when there are no positive weights.
 */
export function weightedPercentile(
  samples: { value: number; weight: number }[],
  percentile: number
): number | null {
  const valid = samples.filter((s) => s.weight > 0);
  if (!valid.length) return null;
  const sorted = [...valid].sort((a, b) => a.value - b.value);
  const total = sorted.reduce((sum, s) => sum + s.weight, 0);
  const target = total * percentile;
  let cumulative = 0;
  for (const sample of sorted) {
    cumulative += sample.weight;
    if (cumulative >= target) return sample.value;
  }
  return sorted[sorted.length - 1].value;
}

/**
 * Effective comfort point: the max of what the user's level implies and the
 * difficulty they demonstrably consume (p75, hours-weighted). The max() is
 * what prevents sandbagging — comfort can be raised by consuming harder
 * content but never pushed below the level-based floor.
 */
export function effectiveComfort(
  categoryLevel: number,
  consumedDifficulty?: number | null
): number {
  const levelComfort = comfortDifficulty(categoryLevel);
  if (consumedDifficulty === null || consumedDifficulty === undefined) {
    return levelComfort;
  }
  return Math.max(levelComfort, clamp(consumedDifficulty, 0, 100));
}

function multiplierFromComfort(
  difficulty: number | null | undefined,
  comfort: number
): number {
  if (difficulty === null || difficulty === undefined) return 1;
  const d = clamp(difficulty, 0, 100);
  const room = 100 - comfort;
  if (room <= 0) return 1;
  const normalizedGap = clamp((d - comfort) / room, 0, 1);
  return 1 + MAX_DIFFICULTY_BONUS * normalizedGap;
}

/**
 * Multiplier for content difficulty relative to the user's comfort point.
 * The gap is normalized by the remaining difficulty space above comfort, so
 * the max bonus (1 + MAX_DIFFICULTY_BONUS) is reachable at every level.
 * Content at or below comfort — or with no difficulty data — is neutral
 * (1.0): the bonus only rewards, never punishes.
 */
export function difficultyMultiplier(
  difficulty: number | null | undefined,
  categoryLevel: number,
  consumedDifficulty?: number | null
): number {
  return multiplierFromComfort(
    difficulty,
    effectiveComfort(categoryLevel, consumedDifficulty)
  );
}

export interface IXpComputationInput {
  type: ILog['type'];
  time?: number | null;
  chars?: number | null;
  pages?: number | null;
  episodes?: number | null;
}

export interface IXpComputationContext {
  /** User's personal reading speed (chars/hour); null → fallback constant. */
  personalSpeedCph?: number | null;
  /** Jiten difficulty of the media, normalized 0-100; null → neutral. */
  difficulty?: number | null;
  /** Continuous level in the log's category at computation time. */
  categoryLevel?: number;
  /**
   * Hours-weighted p75 of the difficulty consumed recently in the category
   * (0-100); null when there's not enough tagged history.
   */
  consumedDifficulty?: number | null;
  /**
   * Fixed comfort point (0-100) — used when editing a log to reuse the
   * comfort snapshotted at creation instead of recomputing it.
   */
  comfortAt?: number | null;
}

export interface IXpComputationResult {
  xp: number;
  breakdown: IXpBreakdown;
}

function isPositive(value?: number | null): value is number {
  return typeof value === 'number' && value > 0;
}

function estimateMinutesFromChars(
  chars: number,
  personalSpeedCph?: number | null
): number {
  const speed = isPositive(personalSpeedCph)
    ? clamp(personalSpeedCph, MIN_PERSONAL_SPEED_CPH, MAX_PERSONAL_SPEED_CPH)
    : FALLBACK_READING_SPEED_CPH;
  return (chars / speed) * 60;
}

/**
 * Minutes of immersion this log gets credit for, plus whether the credited
 * time is backed by chars (affects the game gameplay-dilution factor).
 */
function creditedMinutes(
  input: IXpComputationInput,
  context: IXpComputationContext
): { minutes: number; charsBacked: boolean } {
  const { type } = input;
  const category = getLogCategory(type);

  // 'other' intentionally earns 0 XP regardless of time — not every logged
  // activity should be rewarded.
  if (type === 'other') {
    return { minutes: 0, charsBacked: false };
  }

  if (category === 'listening') {
    if (isPositive(input.time)) {
      return { minutes: input.time, charsBacked: false };
    }
    if (
      (type === 'anime' || type === 'tv show') &&
      isPositive(input.episodes)
    ) {
      return { minutes: input.episodes * EPISODE_MINUTES, charsBacked: false };
    }
    return { minutes: 0, charsBacked: false };
  }

  // Reading category: time is authoritative, chars validate/estimate it.
  if (isPositive(input.time)) {
    if (isPositive(input.chars)) {
      const maxPlausibleMinutes =
        (input.chars / MIN_PLAUSIBLE_SPEED_CPH) * 60;
      return {
        minutes: Math.min(input.time, maxPlausibleMinutes),
        charsBacked: true,
      };
    }
    return { minutes: input.time, charsBacked: false };
  }

  if (isPositive(input.chars)) {
    return {
      minutes: estimateMinutesFromChars(input.chars, context.personalSpeedCph),
      charsBacked: true,
    };
  }

  if (
    isPositive(input.pages) &&
    (type === 'reading' || type === 'manga')
  ) {
    const estimatedChars = input.pages * CHARS_PER_PAGE;
    return {
      minutes: estimateMinutesFromChars(
        estimatedChars,
        context.personalSpeedCph
      ),
      charsBacked: false,
    };
  }

  return { minutes: 0, charsBacked: false };
}

export function computeXp(
  input: IXpComputationInput,
  context: IXpComputationContext = {}
): IXpComputationResult {
  const { minutes, charsBacked } = creditedMinutes(input, context);

  const gameFactor =
    input.type === 'game' && !charsBacked ? GAME_TIME_FACTOR : 1;
  const baseXp = Math.floor(minutes * XP_PER_MINUTE * gameFactor);

  const categoryLevel = context.categoryLevel ?? 0;
  const comfort =
    context.comfortAt ??
    effectiveComfort(categoryLevel, context.consumedDifficulty);
  const multiplier = multiplierFromComfort(context.difficulty, comfort);
  const xp = Math.floor(baseXp * multiplier);

  return {
    xp,
    breakdown: {
      baseXp,
      timeCreditedMin: Math.round(minutes * 100) / 100,
      difficulty: context.difficulty ?? null,
      categoryLevelAt: Math.round(categoryLevel * 100) / 100,
      comfortAt: Math.round(comfort * 100) / 100,
      multiplier: Math.round(multiplier * 1000) / 1000,
      version: XP_FORMULA_VERSION,
    },
  };
}

/** Rough immersion minutes for weighting difficulty samples. */
export function roughLogMinutes(input: IXpComputationInput): number {
  if (isPositive(input.time)) return input.time;
  if (
    (input.type === 'anime' || input.type === 'tv show') &&
    isPositive(input.episodes)
  ) {
    return input.episodes * EPISODE_MINUTES;
  }
  if (isPositive(input.chars)) {
    return (input.chars / FALLBACK_READING_SPEED_CPH) * 60;
  }
  return 0;
}

/**
 * Hours-weighted p75 of the Jiten difficulty (normalized 0-100) the user
 * consumed in the category within the recent window. Null when less than
 * CONSUMED_DIFFICULTY_MIN_HOURS of difficulty-tagged immersion exists —
 * callers then fall back to the level-based comfort alone.
 */
export async function getUserConsumedDifficulty(
  userId: Types.ObjectId | string,
  category: Exclude<LogCategory, null>
): Promise<number | null> {
  const types = category === 'reading' ? READING_TYPES : LISTENING_TYPES;
  const cutoff = new Date(
    Date.now() - CONSUMED_DIFFICULTY_WINDOW_DAYS * 24 * 60 * 60 * 1000
  );

  const logs = await Log.find({
    user: userId,
    type: { $in: types },
    date: { $gte: cutoff },
    mediaId: { $ne: null },
  })
    .select('mediaId type time chars episodes')
    .lean();

  if (!logs.length) return null;

  const mediaIds = Array.from(new Set(logs.map((log) => log.mediaId)));
  const medias = await MediaBase.find({
    contentId: { $in: mediaIds },
    jitenDifficulty: { $ne: null },
  })
    .select('contentId jitenDifficulty')
    .lean();

  const difficultyByContentId = new Map<string, number>();
  for (const media of medias) {
    const normalized = normalizeJitenDifficulty(media.jitenDifficulty);
    if (normalized !== null) {
      difficultyByContentId.set(media.contentId, normalized);
    }
  }

  const samples: { value: number; weight: number }[] = [];
  let totalHours = 0;
  for (const log of logs) {
    const difficulty = log.mediaId
      ? difficultyByContentId.get(log.mediaId)
      : undefined;
    if (difficulty === undefined) continue;
    const hours =
      roughLogMinutes({
        type: log.type as ILog['type'],
        time: log.time,
        chars: log.chars,
        episodes: log.episodes,
      }) / 60;
    if (hours <= 0) continue;
    totalHours += hours;
    samples.push({ value: difficulty, weight: hours });
  }

  if (totalHours < CONSUMED_DIFFICULTY_MIN_HOURS) return null;

  return weightedPercentile(samples, CONSUMED_DIFFICULTY_PERCENTILE);
}

const PERSONAL_SPEED_SAMPLE_SIZE = 50;
/**
 * Minimum same-type samples before the type-specific speed is trusted over
 * the category-wide one — reading speed differs a lot between manga, novels,
 * VNs and games, but a median over fewer samples than this is noise.
 */
export const MIN_SPEED_SAMPLES = 5;

export function medianOf(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

async function querySpeedSamples(
  userId: Types.ObjectId | string,
  typeFilter: ILog['type'] | ILog['type'][]
): Promise<number[]> {
  const logs = await Log.find({
    user: userId,
    type: Array.isArray(typeFilter) ? { $in: typeFilter } : typeFilter,
    chars: { $gt: 0 },
    time: { $gt: 0 },
  })
    .sort({ date: -1 })
    .limit(PERSONAL_SPEED_SAMPLE_SIZE)
    .select('chars time')
    .lean();

  return logs.map((log) => ((log.chars as number) / (log.time as number)) * 60);
}

/**
 * Median reading speed (chars/hour) over the user's recent logs that carry
 * both chars and time. Prefers logs of the given type (each medium reads at
 * its own pace); falls back to the whole reading category when there are
 * fewer than MIN_SPEED_SAMPLES same-type logs. Null when there's no usable
 * history at all — callers then use FALLBACK_READING_SPEED_CPH.
 */
export async function getUserReadingSpeedCph(
  userId: Types.ObjectId | string,
  type?: ILog['type']
): Promise<number | null> {
  if (type && READING_TYPES.includes(type)) {
    const specific = await querySpeedSamples(userId, type);
    if (specific.length >= MIN_SPEED_SAMPLES) {
      return medianOf(specific);
    }
  }
  return medianOf(await querySpeedSamples(userId, READING_TYPES));
}

import { Types } from 'mongoose';
import Log from '../models/log.model.js';
import LevelRecommendationDismissal from '../models/levelRecommendationDismissal.model.js';
import { MediaBase } from '../models/media.model.js';
import { IMediaDocument } from '../types.js';
import {
  CHALLENGE_TARGET_GAP,
  JITEN_MAX_DIFFICULTY,
  continuousLevel,
  effectiveComfort,
  getUserConsumedDifficulty,
} from './xp.js';

export type LevelRecommendationCategory = 'reading' | 'listening';

export const LEVEL_RECOMMENDATION_MEDIA_TYPES: Record<
  LevelRecommendationCategory,
  IMediaDocument['type'][]
> = {
  reading: ['light-novel', 'vn', 'manga', 'book', 'game'],
  listening: ['anime', 'movie', 'tv show'],
};

export const LEVEL_RECOMMENDATION_DEFAULT_LIMIT = 12;
export const LEVEL_RECOMMENDATION_MAX_LIMIT = 30;

/** The window starts 0.25 Jiten below comfort, on the 0-100 scale. */
export const LEVEL_WINDOW_BELOW = 5;
/** The window ends where the full challenge bonus starts. */
export const LEVEL_WINDOW_ABOVE = CHALLENGE_TARGET_GAP;
/** The best match is 0.25 Jiten above comfort. */
export const LEVEL_SWEET_SPOT_OFFSET = 5;

const POPULARITY_WINDOW_DAYS = 365;
const POPULARITY_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const POPULARITY_MAX_ENTRIES = 5000;
const FILL_CANDIDATE_LIMIT = 200;
export const LEVEL_SHIFT_LIMIT_JITEN = 1;
export const LEVEL_FILTER_MAX_GENRES = 5;
export const LEVEL_DISMISSAL_LIMIT = 1000;
const AVAILABLE_GENRES_LIMIT = 30;

export interface LevelWindow {
  comfort: number;
  min: number;
  max: number;
  sweetSpot: number;
}

export interface LevelRecommendationItem {
  contentId: string;
  type: IMediaDocument['type'];
  title: IMediaDocument['title'];
  contentImage: string | null;
  coverImage: string | null;
  isAdult: boolean;
  isAdultImage: boolean;
  jitenDifficulty: number;
  readers: number;
  fit: 'comfortable' | 'challenge';
}

export interface LevelRecommendationsResult {
  category: LevelRecommendationCategory;
  hasHistory: boolean;
  comfortJiten: number;
  minJiten: number;
  maxJiten: number;
  items: LevelRecommendationItem[];
  /** Genres in the current window. Only set when the user can filter. */
  availableGenres?: string[];
}

export interface LevelRecommendationFilters {
  types?: IMediaDocument['type'][];
  genres?: string[];
  /** Moves the window up or down, in Jiten. */
  shiftJiten?: number;
  /** Adds `availableGenres` to the result. */
  includeGenres?: boolean;
}

interface PopularityCache {
  expiresAt: number;
  readers: Map<string, number>;
}

let popularityCache: PopularityCache | null = null;
let popularityRequest: Promise<Map<string, number>> | null = null;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function popularityKey(type: string, contentId: string): string {
  return `${type}:${contentId}`;
}

export function parseLevelRecommendationCategory(
  value: unknown
): LevelRecommendationCategory {
  return value === 'listening' ? 'listening' : 'reading';
}

export function parseLevelRecommendationLimit(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return LEVEL_RECOMMENDATION_DEFAULT_LIMIT;
  }
  return Math.min(Math.floor(parsed), LEVEL_RECOMMENDATION_MAX_LIMIT);
}

/** Keep only valid media types of the category. Returns undefined when none remain. */
export function parseLevelRecommendationTypes(
  value: unknown,
  category: LevelRecommendationCategory
): IMediaDocument['type'][] | undefined {
  if (typeof value !== 'string') return undefined;
  const allowed = LEVEL_RECOMMENDATION_MEDIA_TYPES[category];
  const types = value
    .split(',')
    .map((part) => part.trim())
    .filter((part): part is IMediaDocument['type'] =>
      (allowed as string[]).includes(part)
    );
  const unique = [...new Set(types)];
  return unique.length ? unique : undefined;
}

export function parseLevelRecommendationGenres(
  value: unknown
): string[] | undefined {
  if (typeof value !== 'string') return undefined;
  const genres = value
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && part.length <= 40);
  const unique = [...new Set(genres)].slice(0, LEVEL_FILTER_MAX_GENRES);
  return unique.length ? unique : undefined;
}

/** Returns 0 when the value is missing or not a number. */
export function parseLevelRecommendationShift(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return (
    Math.round(
      clamp(parsed, -LEVEL_SHIFT_LIMIT_JITEN, LEVEL_SHIFT_LIMIT_JITEN) * 4
    ) / 4
  );
}

/**
 * Difficulty window on the 0-100 scale around the effective comfort.
 * The shift moves the window and the sweet spot, but not the comfort itself.
 */
export function getLevelWindow(comfort: number, shift = 0): LevelWindow {
  const safeComfort = clamp(comfort, 0, 100);
  const center = clamp(safeComfort + shift, 0, 100);
  return {
    comfort: safeComfort,
    min: clamp(center - LEVEL_WINDOW_BELOW, 0, 100),
    max: clamp(center + LEVEL_WINDOW_ABOVE, 0, 100),
    sweetSpot: clamp(center + LEVEL_SWEET_SPOT_OFFSET, 0, 100),
  };
}

/**
 * Higher scores rank first.
 * Community readers count on a log scale, so very popular titles do not hide good matches.
 * Each 0.25 Jiten away from the sweet spot costs about one doubling of readers.
 */
export function scoreLevelCandidate(
  difficulty: number,
  readers: number,
  window: LevelWindow
): number {
  const distance = Math.abs(difficulty - window.sweetSpot);
  return Math.log2(1 + Math.max(0, readers)) - distance / LEVEL_SWEET_SPOT_OFFSET;
}

export function jitenToScale(jiten: number): number {
  return (clamp(jiten, 0, JITEN_MAX_DIFFICULTY) / JITEN_MAX_DIFFICULTY) * 100;
}

export function scaleToJiten(value: number): number {
  return Math.round((clamp(value, 0, 100) / 100) * JITEN_MAX_DIFFICULTY * 100) / 100;
}

async function loadCommunityReaders(): Promise<Map<string, number>> {
  const cutoff = new Date(
    Date.now() - POPULARITY_WINDOW_DAYS * 24 * 60 * 60 * 1000
  );
  const rows = await Log.aggregate<{
    _id: { mediaId: string; type: string };
    readers: number;
  }>([
    {
      $match: {
        date: { $gte: cutoff },
        mediaId: { $nin: [null, ''] },
        private: { $ne: true },
      },
    },
    { $group: { _id: { mediaId: '$mediaId', type: '$type', user: '$user' } } },
    {
      $group: {
        _id: { mediaId: '$_id.mediaId', type: '$_id.type' },
        readers: { $sum: 1 },
      },
    },
    { $sort: { readers: -1 } },
    { $limit: POPULARITY_MAX_ENTRIES },
  ]).allowDiskUse(true);

  const readers = new Map<string, number>();
  for (const row of rows) {
    readers.set(popularityKey(row._id.type, row._id.mediaId), row.readers);
  }
  return readers;
}

/** Community readers per media for the last year, cached for 6 hours. */
async function getCommunityReaders(): Promise<Map<string, number>> {
  if (popularityCache && popularityCache.expiresAt > Date.now()) {
    return popularityCache.readers;
  }
  if (!popularityRequest) {
    popularityRequest = loadCommunityReaders()
      .then((readers) => {
        popularityCache = {
          expiresAt: Date.now() + POPULARITY_CACHE_TTL_MS,
          readers,
        };
        return readers;
      })
      .finally(() => {
        popularityRequest = null;
      });
  }
  return popularityRequest;
}

export function resetLevelRecommendationCache(): void {
  popularityCache = null;
  popularityRequest = null;
}

interface LevelRecommendationUser {
  _id: Types.ObjectId;
  stats?: { readingXp?: number; listeningXp?: number } | null;
  settings?: { hideAdultFromSearch?: boolean } | null;
}

type CandidateMedia = Pick<
  IMediaDocument,
  | 'contentId'
  | 'type'
  | 'title'
  | 'contentImage'
  | 'coverImage'
  | 'isAdult'
  | 'isAdultImage'
  | 'jitenDifficulty'
>;

const CANDIDATE_FIELDS =
  'contentId type title contentImage coverImage isAdult isAdultImage jitenDifficulty';

export async function getLevelRecommendations(
  user: LevelRecommendationUser,
  options: {
    category: LevelRecommendationCategory;
    limit: number;
    filters?: LevelRecommendationFilters;
  }
): Promise<LevelRecommendationsResult> {
  const { category, limit, filters = {} } = options;
  const categoryTypes = LEVEL_RECOMMENDATION_MEDIA_TYPES[category];
  const types = filters.types?.length ? filters.types : categoryTypes;
  const categoryXp =
    category === 'reading'
      ? (user.stats?.readingXp ?? 0)
      : (user.stats?.listeningXp ?? 0);

  const [consumedDifficulty, loggedMedia, dismissed, readers] = await Promise.all([
    getUserConsumedDifficulty(user._id, category),
    Log.distinct('mediaId', {
      user: user._id,
      type: { $in: categoryTypes },
      mediaId: { $nin: [null, ''] },
    }) as Promise<string[]>,
    LevelRecommendationDismissal.find({ user: user._id })
      .select('mediaId')
      .lean<{ mediaId: string }[]>(),
    getCommunityReaders(),
  ]);

  const window = getLevelWindow(
    effectiveComfort(continuousLevel(categoryXp), consumedDifficulty),
    (filters.shiftJiten ?? 0) * (100 / JITEN_MAX_DIFFICULTY)
  );
  const minJiten = scaleToJiten(window.min);
  const maxJiten = scaleToJiten(window.max);
  const loggedIds = new Set([
    ...loggedMedia,
    ...dismissed.map((entry) => entry.mediaId),
  ]);
  const baseFilter: Record<string, unknown> = {
    type: { $in: types },
    jitenDifficulty: { $gte: minJiten, $lte: maxJiten },
  };
  if (user.settings?.hideAdultFromSearch) baseFilter.isAdult = { $ne: true };
  if (filters.genres?.length) baseFilter.genres = { $in: filters.genres };

  const popularIds: string[] = [];
  for (const key of readers.keys()) {
    const separator = key.indexOf(':');
    const type = key.slice(0, separator) as IMediaDocument['type'];
    const contentId = key.slice(separator + 1);
    if (types.includes(type) && !loggedIds.has(contentId)) {
      popularIds.push(contentId);
    }
  }

  const popularMedia = popularIds.length
    ? await MediaBase.find({ ...baseFilter, contentId: { $in: popularIds } })
        .select(CANDIDATE_FIELDS)
        .lean<CandidateMedia[]>()
    : [];

  const candidates = new Map<string, CandidateMedia>();
  for (const media of popularMedia) candidates.set(media.contentId, media);

  if (candidates.size < limit) {
    const fillMedia = await MediaBase.find({
      ...baseFilter,
      contentId: { $nin: [...loggedIds, ...candidates.keys()] },
    })
      .select(CANDIDATE_FIELDS)
      .limit(FILL_CANDIDATE_LIMIT)
      .lean<CandidateMedia[]>();
    for (const media of fillMedia) candidates.set(media.contentId, media);
  }

  const items = [...candidates.values()]
    .filter((media) => typeof media.jitenDifficulty === 'number')
    .map((media) => {
      const jitenDifficulty = media.jitenDifficulty as number;
      const difficulty = jitenToScale(jitenDifficulty);
      const mediaReaders =
        readers.get(popularityKey(media.type, media.contentId)) ?? 0;
      return {
        media,
        jitenDifficulty,
        readers: mediaReaders,
        difficulty,
        score: scoreLevelCandidate(difficulty, mediaReaders, window),
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map<LevelRecommendationItem>((candidate) => ({
      contentId: candidate.media.contentId,
      type: candidate.media.type,
      title: candidate.media.title,
      contentImage: candidate.media.contentImage ?? null,
      coverImage: candidate.media.coverImage ?? null,
      isAdult: Boolean(candidate.media.isAdult),
      isAdultImage: Boolean(candidate.media.isAdultImage),
      jitenDifficulty: candidate.jitenDifficulty,
      readers: candidate.readers,
      fit: candidate.difficulty > window.comfort ? 'challenge' : 'comfortable',
    }));

  const availableGenres = filters.includeGenres
    ? await getWindowGenres(categoryTypes, minJiten, maxJiten)
    : undefined;

  return {
    category,
    hasHistory: categoryXp > 0 || consumedDifficulty !== null,
    comfortJiten: scaleToJiten(window.comfort),
    minJiten,
    maxJiten,
    items,
    ...(availableGenres ? { availableGenres } : {}),
  };
}

/** Most common genres among titles inside the difficulty window. */
async function getWindowGenres(
  types: IMediaDocument['type'][],
  minJiten: number,
  maxJiten: number
): Promise<string[]> {
  const rows = await MediaBase.aggregate<{ _id: string }>([
    {
      $match: {
        type: { $in: types },
        jitenDifficulty: { $gte: minJiten, $lte: maxJiten },
      },
    },
    { $unwind: '$genres' },
    { $group: { _id: '$genres', count: { $sum: 1 } } },
    { $sort: { count: -1, _id: 1 } },
    { $limit: AVAILABLE_GENRES_LIMIT },
  ]);
  return rows.map((row) => row._id).filter(Boolean);
}

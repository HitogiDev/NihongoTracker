import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';
import {
  getLevelRecommendations,
  getLevelWindow,
  parseLevelRecommendationCategory,
  parseLevelRecommendationGenres,
  parseLevelRecommendationLimit,
  parseLevelRecommendationShift,
  parseLevelRecommendationTypes,
  resetLevelRecommendationCache,
  scaleToJiten,
  scoreLevelCandidate,
} from '../services/levelRecommendations.service.js';

const mocks = vi.hoisted(() => ({
  aggregate: vi.fn(),
  distinct: vi.fn(),
  mediaFind: vi.fn(),
  mediaAggregate: vi.fn(),
  dismissalFind: vi.fn(),
  consumed: vi.fn(),
}));

vi.mock('../models/log.model.js', () => ({
  default: { aggregate: mocks.aggregate, distinct: mocks.distinct },
}));
vi.mock('../models/media.model.js', () => ({
  MediaBase: { find: mocks.mediaFind, aggregate: mocks.mediaAggregate },
}));
vi.mock('../models/levelRecommendationDismissal.model.js', () => ({
  default: { find: mocks.dismissalFind },
}));
vi.mock('../services/xp.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/xp.js')>()),
  getUserConsumedDifficulty: mocks.consumed,
}));

function mediaQuery(result: unknown[]) {
  const query = {
    select: vi.fn(() => query),
    limit: vi.fn(() => query),
    lean: vi.fn(async () => result),
  };
  return query;
}

function dismissals(mediaIds: string[]) {
  const query = {
    select: vi.fn(() => query),
    lean: vi.fn(async () => mediaIds.map((mediaId) => ({ mediaId }))),
  };
  return query;
}

function media(contentId: string, jitenDifficulty: number, type = 'vn') {
  return {
    contentId,
    type,
    title: { contentTitleNative: contentId },
    jitenDifficulty,
    isAdult: false,
  };
}

describe('level recommendation helpers', () => {
  it('parses category and limit with safe defaults', () => {
    expect(parseLevelRecommendationCategory('listening')).toBe('listening');
    expect(parseLevelRecommendationCategory('other')).toBe('reading');
    expect(parseLevelRecommendationLimit(undefined)).toBe(12);
    expect(parseLevelRecommendationLimit('5')).toBe(5);
    expect(parseLevelRecommendationLimit('500')).toBe(30);
  });

  it('builds a window from 0.25 Jiten below to 0.5 Jiten above comfort', () => {
    const window = getLevelWindow(50);
    expect(scaleToJiten(window.min)).toBe(2.25);
    expect(scaleToJiten(window.max)).toBe(3);
    expect(scaleToJiten(window.sweetSpot)).toBe(2.75);
    expect(getLevelWindow(98).max).toBe(100);
  });

  it('keeps only valid types for the category', () => {
    expect(parseLevelRecommendationTypes('vn,anime,manga', 'reading')).toEqual([
      'vn',
      'manga',
    ]);
    expect(parseLevelRecommendationTypes('anime', 'reading')).toBeUndefined();
    expect(parseLevelRecommendationTypes(undefined, 'reading')).toBeUndefined();
  });

  it('limits genres to five clean values', () => {
    expect(
      parseLevelRecommendationGenres('Action, Drama,,Action,A,B,C,D,E')
    ).toEqual(['Action', 'Drama', 'A', 'B', 'C']);
    expect(parseLevelRecommendationGenres('')).toBeUndefined();
  });

  it('rounds the shift to quarter points inside one Jiten', () => {
    expect(parseLevelRecommendationShift('0.3')).toBe(0.25);
    expect(parseLevelRecommendationShift('-5')).toBe(-1);
    expect(parseLevelRecommendationShift('abc')).toBe(0);
  });

  it('moves the window but not the comfort when shifted', () => {
    const window = getLevelWindow(50, 10);
    expect(window.comfort).toBe(50);
    expect(scaleToJiten(window.min)).toBe(2.75);
    expect(scaleToJiten(window.sweetSpot)).toBe(3.25);
  });

  it('prefers popular titles but penalizes distance from the sweet spot', () => {
    const window = getLevelWindow(50);
    expect(scoreLevelCandidate(55, 10, window)).toBeGreaterThan(
      scoreLevelCandidate(55, 1, window)
    );
    expect(scoreLevelCandidate(55, 3, window)).toBeGreaterThan(
      scoreLevelCandidate(45, 3, window)
    );
  });
});

describe('getLevelRecommendations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetLevelRecommendationCache();
    mocks.dismissalFind.mockReturnValue(dismissals([]));
  });

  it('excludes logged media and ranks community favorites first', async () => {
    mocks.consumed.mockResolvedValue(null);
    mocks.distinct.mockResolvedValue(['logged']);
    mocks.aggregate.mockReturnValue({
      allowDiskUse: vi.fn(async () => [
        { _id: { mediaId: 'popular', type: 'vn' }, readers: 20 },
        { _id: { mediaId: 'logged', type: 'vn' }, readers: 50 },
        { _id: { mediaId: 'anime-1', type: 'anime' }, readers: 99 },
      ]),
    });
    mocks.mediaFind
      .mockReturnValueOnce(mediaQuery([media('popular', 0.1)]))
      .mockReturnValueOnce(mediaQuery([media('quiet', 0.1)]));

    const result = await getLevelRecommendations(
      { _id: new Types.ObjectId(), stats: { readingXp: 0 } },
      { category: 'reading', limit: 5 }
    );

    const popularFilter = mocks.mediaFind.mock.calls[0][0];
    expect(popularFilter.contentId.$in).toEqual(['popular']);
    expect(popularFilter.jitenDifficulty).toEqual({ $gte: 0, $lte: 0.5 });
    const fillFilter = mocks.mediaFind.mock.calls[1][0];
    expect(fillFilter.contentId.$nin).toEqual(['logged', 'popular']);
    expect(result.items.map((item) => item.contentId)).toEqual([
      'popular',
      'quiet',
    ]);
    expect(result.items[0]).toMatchObject({ readers: 20, fit: 'challenge' });
    expect(result.hasHistory).toBe(false);
  });

  it('hides adult media when the user hides it from search', async () => {
    mocks.consumed.mockResolvedValue(null);
    mocks.distinct.mockResolvedValue([]);
    mocks.aggregate.mockReturnValue({ allowDiskUse: vi.fn(async () => []) });
    mocks.mediaFind.mockReturnValueOnce(mediaQuery([]));

    await getLevelRecommendations(
      {
        _id: new Types.ObjectId(),
        stats: { readingXp: 1000 },
        settings: { hideAdultFromSearch: true },
      },
      { category: 'reading', limit: 5 }
    );

    expect(mocks.mediaFind.mock.calls[0][0].isAdult).toEqual({ $ne: true });
  });

  it('applies type and genre filters and reports available genres', async () => {
    mocks.consumed.mockResolvedValue(null);
    mocks.distinct.mockResolvedValue([]);
    mocks.aggregate.mockReturnValue({ allowDiskUse: vi.fn(async () => []) });
    mocks.mediaFind.mockReturnValueOnce(mediaQuery([]));
    mocks.mediaAggregate.mockResolvedValue([{ _id: 'Action' }, { _id: 'Drama' }]);

    const result = await getLevelRecommendations(
      { _id: new Types.ObjectId(), stats: { readingXp: 0 } },
      {
        category: 'reading',
        limit: 5,
        filters: {
          types: ['vn'],
          genres: ['Action'],
          shiftJiten: 0.5,
          includeGenres: true,
        },
      }
    );

    const filter = mocks.mediaFind.mock.calls[0][0];
    expect(filter.type).toEqual({ $in: ['vn'] });
    expect(filter.genres).toEqual({ $in: ['Action'] });
    expect(filter.jitenDifficulty).toEqual({ $gte: 0.25, $lte: 1 });
    expect(result.availableGenres).toEqual(['Action', 'Drama']);
  });

  it('never suggests dismissed titles', async () => {
    mocks.consumed.mockResolvedValue(null);
    mocks.distinct.mockResolvedValue(['logged']);
    mocks.dismissalFind.mockReturnValue(dismissals(['hidden']));
    mocks.aggregate.mockReturnValue({
      allowDiskUse: vi.fn(async () => [
        { _id: { mediaId: 'hidden', type: 'vn' }, readers: 30 },
      ]),
    });
    mocks.mediaFind.mockReturnValueOnce(mediaQuery([]));

    await getLevelRecommendations(
      { _id: new Types.ObjectId(), stats: { readingXp: 0 } },
      { category: 'reading', limit: 1 }
    );

    expect(mocks.mediaFind).toHaveBeenCalledTimes(1);
    const fillFilter = mocks.mediaFind.mock.calls[0][0];
    expect(fillFilter.contentId.$nin).toEqual(['logged', 'hidden']);
  });
});

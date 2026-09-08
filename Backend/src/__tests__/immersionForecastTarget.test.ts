import { beforeEach, describe, expect, it, vi } from 'vitest';

const { findOne, fetchJitenDetail } = vi.hoisted(() => ({
  findOne: vi.fn(),
  fetchJitenDetail: vi.fn(),
}));

vi.mock('../models/media.model.js', () => ({ MediaBase: { findOne } }));
vi.mock('../models/log.model.js', () => ({
  default: { aggregate: vi.fn(), find: vi.fn() },
}));
vi.mock('../services/jiten.js', () => ({ fetchJitenDetail }));

import { resolveForecastTarget } from '../services/immersionForecast.service.js';

const media = (fields: Record<string, unknown>) => ({
  contentId: 'media-1',
  type: 'vn',
  title: { contentTitleNative: '作品' },
  isAdult: false,
  ...fields,
});

describe('resolveForecastTarget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchJitenDetail.mockResolvedValue(null);
  });

  function returnMedia(value: Record<string, unknown> | null) {
    findOne.mockReturnValue({ lean: vi.fn().mockResolvedValue(value) });
  }

  it('uses episode totals and duration for shows', async () => {
    returnMedia(media({ type: 'anime', episodes: 12, episodeDuration: 24 }));
    const result = await resolveForecastTarget('media-1', 'anime');
    expect(result?.target).toEqual({
      metric: 'episodes',
      total: 12,
      source: 'media',
      episodeDuration: 24,
    });
  });

  it('uses runtime for movies', async () => {
    returnMedia(media({ type: 'movie', runtime: 97 }));
    expect((await resolveForecastTarget('media-1', 'movie'))?.target).toEqual({
      metric: 'minutes',
      total: 97,
      source: 'media',
    });
  });

  it('prefers stored character totals, then Jiten', async () => {
    returnMedia(media({ characters: 42_000 }));
    expect((await resolveForecastTarget('media-1', 'vn'))?.target.source).toBe(
      'media'
    );

    returnMedia(media({ type: 'light-novel' }));
    fetchJitenDetail.mockResolvedValue({
      data: { mainDeck: { characterCount: 80_000 } },
    });
    const result = await resolveForecastTarget('media-1', 'light-novel');
    expect(result?.target).toEqual({
      metric: 'chars',
      total: 80_000,
      source: 'jiten',
    });
    expect(fetchJitenDetail).toHaveBeenCalledWith(
      'reading',
      'media-1',
      '作品'
    );
  });

  it('falls back to Google Books pages', async () => {
    returnMedia(media({ type: 'book', pageCount: 320 }));
    expect((await resolveForecastTarget('media-1', 'book'))?.target).toEqual({
      metric: 'pages',
      total: 320,
      source: 'google_books',
    });
  });

  it('rejects media without a reliable finite total', async () => {
    returnMedia(media({ type: 'game' }));
    expect(await resolveForecastTarget('media-1', 'game')).toBeNull();
    returnMedia(media({ type: 'video' }));
    expect(await resolveForecastTarget('media-1', 'video')).toBeNull();
  });
});

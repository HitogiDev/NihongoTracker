import { describe, expect, it } from 'vitest';
import { computeMediaProgress } from '../services/currentMedia.service.js';

const totals = { episodes: 5, chars: 12000, time: 45 };

describe('computeMediaProgress', () => {
  it('uses episodes for anime and TV shows', () => {
    expect(computeMediaProgress('anime', { episodes: 12 }, totals)).toEqual({
      unit: 'episodes',
      current: 5,
      total: 12,
    });
    expect(computeMediaProgress('tv show', { episodes: 10 }, totals)?.unit).toBe(
      'episodes'
    );
  });

  it('uses characters for reading media and runtime for movies', () => {
    expect(computeMediaProgress('vn', { characters: 50000 }, totals)).toEqual({
      unit: 'chars',
      current: 12000,
      total: 50000,
    });
    expect(computeMediaProgress('movie', { runtime: 120 }, totals)).toEqual({
      unit: 'minutes',
      current: 45,
      total: 120,
    });
  });

  it('returns null without a known total', () => {
    expect(computeMediaProgress('manga', { characters: null }, totals)).toBeNull();
    expect(computeMediaProgress('anime', { episodes: 0 }, totals)).toBeNull();
    expect(computeMediaProgress('game', {}, totals)).toBeNull();
  });
});

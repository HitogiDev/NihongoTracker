/**
 * The AniList feed describes progress as free text ("watched episode" + "5",
 * or "12 - 14"), so this parser is the only thing standing between a sloppy
 * activity string and a log that credits the wrong number of episodes.
 */

import { describe, expect, it } from 'vitest';
import {
  parseEpisodeProgress,
  parseEpisodeRange,
} from '../../services/anilistActivity.js';

describe('parseEpisodeProgress', () => {
  it('counts a single episode update', () => {
    expect(parseEpisodeProgress('watched episode', '5')).toBe(1);
  });

  it('counts an inclusive episode range', () => {
    expect(parseEpisodeProgress('watched episode', '12 - 14')).toBe(3);
  });

  it('treats rewatches as immersion too', () => {
    expect(parseEpisodeProgress('rewatched episode', '1 - 4')).toBe(4);
  });

  it('ignores status changes that carry no progress', () => {
    expect(parseEpisodeProgress('plans to watch', null)).toBe(0);
    expect(parseEpisodeProgress('completed', '24')).toBe(0);
    expect(parseEpisodeProgress('dropped', null)).toBe(0);
    expect(parseEpisodeProgress('paused', null)).toBe(0);
  });

  it('ignores manga chapter activity', () => {
    expect(parseEpisodeProgress('read chapter', '30 - 32')).toBe(0);
  });

  it('falls back to one episode on nonsensical ranges', () => {
    expect(parseEpisodeProgress('watched episode', '14 - 12')).toBe(1);
    expect(parseEpisodeProgress('watched episode', '1 - 9999')).toBe(1);
  });

  it('returns zero when either half is missing', () => {
    expect(parseEpisodeProgress(null, '5')).toBe(0);
    expect(parseEpisodeProgress('watched episode', '')).toBe(0);
    expect(parseEpisodeProgress('watched episode', 'abc')).toBe(0);
  });
});

describe('parseEpisodeRange', () => {
  it('reports the exact episode for a single update', () => {
    expect(parseEpisodeRange('watched episode', '5')).toEqual({
      from: 5,
      to: 5,
    });
  });

  it('reports an inclusive range', () => {
    expect(parseEpisodeRange('watched episode', '12 - 14')).toEqual({
      from: 12,
      to: 14,
    });
  });

  it('recognises a merged activity as a superset of the ranges it absorbed', () => {
    // AniList combines "1" and "2 - 3" into one activity spanning "1 - 3".
    const merged = parseEpisodeRange('watched episode', '1 - 3');
    const first = parseEpisodeRange('watched episode', '1');
    const second = parseEpisodeRange('watched episode', '2 - 3');
    const subsumes = (
      outer: { from: number; to: number } | null,
      inner: { from: number; to: number } | null
    ) =>
      !!outer &&
      !!inner &&
      inner.from >= outer.from &&
      inner.to <= outer.to;
    expect(subsumes(merged, first)).toBe(true);
    expect(subsumes(merged, second)).toBe(true);
  });

  it('collapses nonsensical ranges to a single episode', () => {
    expect(parseEpisodeRange('watched episode', '14 - 12')).toEqual({
      from: 14,
      to: 14,
    });
    expect(parseEpisodeRange('watched episode', '1 - 9999')).toEqual({
      from: 1,
      to: 1,
    });
  });

  it('returns null when it is not episode progress', () => {
    expect(parseEpisodeRange('read chapter', '30 - 32')).toBeNull();
    expect(parseEpisodeRange('completed', '24')).toBeNull();
    expect(parseEpisodeRange(null, '5')).toBeNull();
    expect(parseEpisodeRange('watched episode', '')).toBeNull();
  });
});

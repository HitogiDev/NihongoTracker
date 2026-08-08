/**
 * The AniList feed describes progress as free text ("watched episode" + "5",
 * or "12 - 14"), so this parser is the only thing standing between a sloppy
 * activity string and a log that credits the wrong number of episodes.
 */

import { describe, expect, it } from 'vitest';
import { parseEpisodeProgress } from '../../services/anilistActivity.js';

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

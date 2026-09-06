import { describe, expect, it } from 'vitest';
import { toFuzzyDate } from '../../services/searchAnilist.js';

describe('AniList airing-window dates', () => {
  it('starts a precise airing date at the beginning of its UTC day', () => {
    expect(
      toFuzzyDate({ year: 2026, month: 9, day: 5 }, 'start')?.toISOString()
    ).toBe('2026-09-05T00:00:00.000Z');
  });

  it('keeps the final airing day inclusive', () => {
    expect(
      toFuzzyDate({ year: 2026, month: 9, day: 5 }, 'end')?.toISOString()
    ).toBe('2026-09-05T23:59:59.999Z');
  });

  it('uses the end of a fuzzy month or year for an end date', () => {
    expect(
      toFuzzyDate({ year: 2024, month: 2, day: null }, 'end')?.toISOString()
    ).toBe('2024-02-29T23:59:59.999Z');
    expect(
      toFuzzyDate({ year: 2024, month: null, day: null }, 'end')?.toISOString()
    ).toBe('2024-12-31T23:59:59.999Z');
  });

  it('returns null when AniList has no year', () => {
    expect(toFuzzyDate(null, 'start')).toBeNull();
    expect(
      toFuzzyDate({ year: null, month: null, day: null }, 'end')
    ).toBeNull();
  });
});

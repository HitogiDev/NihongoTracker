import { describe, expect, it } from 'vitest';
import {
  longestDayStreak,
  percentileOf,
  startOfYearInZone,
  summarizeRankSnapshots,
} from '../services/wrapped.service.js';

describe('startOfYearInZone', () => {
  it('returns local midnight on January 1', () => {
    expect(startOfYearInZone(2026, 'UTC').toISOString()).toBe(
      '2026-01-01T00:00:00.000Z'
    );
    expect(startOfYearInZone(2026, 'America/Bogota').toISOString()).toBe(
      '2026-01-01T05:00:00.000Z'
    );
    expect(startOfYearInZone(2026, 'Asia/Tokyo').toISOString()).toBe(
      '2025-12-31T15:00:00.000Z'
    );
  });
});

describe('longestDayStreak', () => {
  it('counts the longest run of consecutive days', () => {
    expect(
      longestDayStreak([
        '2026-01-01',
        '2026-01-02',
        '2026-01-04',
        '2026-01-05',
        '2026-01-06',
      ])
    ).toBe(3);
  });

  it('handles month ends, duplicates, and empty input', () => {
    expect(longestDayStreak(['2026-02-28', '2026-03-01', '2026-03-01'])).toBe(
      2
    );
    expect(longestDayStreak([])).toBe(0);
  });
});

describe('percentileOf', () => {
  it('returns the share of values below the value', () => {
    expect(percentileOf([10, 20, 30, 40], 30)).toBe(50);
    expect(percentileOf([10, 20, 30, 40], 50)).toBe(100);
  });

  it('returns null without data or XP', () => {
    expect(percentileOf([], 10)).toBeNull();
    expect(percentileOf([10], 0)).toBeNull();
  });
});

describe('summarizeRankSnapshots', () => {
  const snap = (
    date: string,
    globalPosition: number,
    monthlyPosition: number
  ) => ({
    date: new Date(`${date}T00:00:00Z`),
    globalPosition,
    monthlyPosition,
  });

  it('uses the last snapshot of each month as its final position', () => {
    const summary = summarizeRankSnapshots(
      [
        snap('2026-01-04', 90, 1),
        snap('2026-01-25', 80, 4),
        snap('2026-02-22', 70, 1),
        snap('2026-03-29', 60, 2),
      ],
      2026,
      { globalPosition: 120 }
    );
    expect(summary).toEqual({
      bestMonthly: { position: 1, month: 2 },
      firstPlaceMonths: [2],
      globalStart: 120,
      globalEnd: 60,
    });
  });

  it('starts from the first snapshot without an earlier one', () => {
    expect(
      summarizeRankSnapshots([snap('2026-05-31', 40, 7)], 2026)?.globalStart
    ).toBe(40);
  });

  it('returns null without snapshots in the year', () => {
    expect(
      summarizeRankSnapshots([snap('2025-12-28', 10, 1)], 2026)
    ).toBeNull();
  });
});

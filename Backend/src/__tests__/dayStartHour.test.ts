import { describe, expect, it } from 'vitest';
import {
  getLiveCurrentStreak,
  getUserDayKey,
  resolveDayStartHour,
} from '../services/streaks.js';

describe('day start hour', () => {
  it('keeps midnight boundaries by default', () => {
    const date = new Date('2026-03-10T02:30:00Z');
    expect(getUserDayKey(date, 'UTC')).toBe('2026-03-10');
  });

  it('counts activity before the day start hour toward the previous day', () => {
    const lateNight = new Date('2026-03-10T03:59:00Z');
    const morning = new Date('2026-03-10T04:00:00Z');
    expect(getUserDayKey(lateNight, 'UTC', 4)).toBe('2026-03-09');
    expect(getUserDayKey(morning, 'UTC', 4)).toBe('2026-03-10');
  });

  it('applies the hour in the user timezone', () => {
    // 2026-03-10 02:00 in Tokyo is 2026-03-09 17:00 UTC.
    const date = new Date('2026-03-09T17:00:00Z');
    expect(getUserDayKey(date, 'Asia/Tokyo')).toBe('2026-03-10');
    expect(getUserDayKey(date, 'Asia/Tokyo', 5)).toBe('2026-03-09');
  });

  it('clamps invalid values', () => {
    expect(resolveDayStartHour(undefined)).toBe(0);
    expect(resolveDayStartHour(-3)).toBe(0);
    expect(resolveDayStartHour(30)).toBe(12);
    expect(resolveDayStartHour(2.5)).toBe(0);
  });

  it('keeps a streak alive until the shifted day ends', () => {
    const todayShifted = getUserDayKey(new Date(), 'UTC', 6);
    const anchor = new Date(`${todayShifted}T00:00:00Z`);
    expect(getLiveCurrentStreak(5, anchor, 'UTC', 6)).toBe(5);
  });
});

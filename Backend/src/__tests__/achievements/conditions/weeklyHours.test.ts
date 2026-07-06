import { describe, it, expect, vi, beforeEach } from 'vitest';
import { evaluateWeeklyHours } from '../../../services/achievements/conditions/weeklyHours.condition.js';

vi.mock('../../../models/log.model.js', () => ({
  default: { aggregate: vi.fn() },
}));

import Log from '../../../models/log.model.js';

/**
 * Builds the aggregate result shape that weeklyHours.condition expects:
 * an array of { _id: { y, m, d }, totalMinutes } sorted ascending by date.
 */
function makeDays(entries: { date: Date; minutes: number }[]) {
  return entries.map(({ date, minutes }) => ({
    _id: {
      y: date.getFullYear(),
      m: date.getMonth() + 1,
      d: date.getDate(),
    },
    totalMinutes: minutes,
  }));
}

/** Returns a Date offset by `n` days from `base` */
function daysFrom(base: Date, n: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d;
}

const BASE = new Date('2024-01-01');

describe('evaluateWeeklyHours — sliding window', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns met=false and progress=0 with no logs', async () => {
    vi.mocked(Log.aggregate).mockResolvedValue([]);
    const result = await evaluateWeeklyHours({} as any, 24);
    expect(result).toEqual({ met: false, progress: 0 });
  });

  it('24h logged on a single day meets the 24h weekly threshold', async () => {
    vi.mocked(Log.aggregate).mockResolvedValue(
      makeDays([{ date: BASE, minutes: 24 * 60 }])
    );
    const result = await evaluateWeeklyHours({} as any, 24);
    expect(result.met).toBe(true);
    expect(result.progress).toBe(24);
  });

  it('4h/day for 7 consecutive days = 28h weekly → meets 24h threshold', async () => {
    const days = Array.from({ length: 7 }, (_, i) => ({
      date: daysFrom(BASE, i),
      minutes: 4 * 60,
    }));
    vi.mocked(Log.aggregate).mockResolvedValue(makeDays(days));
    const result = await evaluateWeeklyHours({} as any, 24);
    expect(result.met).toBe(true);
    expect(result.progress).toBe(28);
  });

  it('3h/day for 7 consecutive days = 21h → does NOT meet 24h threshold', async () => {
    const days = Array.from({ length: 7 }, (_, i) => ({
      date: daysFrom(BASE, i),
      minutes: 3 * 60,
    }));
    vi.mocked(Log.aggregate).mockResolvedValue(makeDays(days));
    const result = await evaluateWeeklyHours({} as any, 24);
    expect(result.met).toBe(false);
    expect(result.progress).toBe(21);
  });

  it('window does NOT span more than 7 days (day 1 and day 8 are NOT in the same window)', async () => {
    // 12h on day 1 and 12h on day 8 — window can't contain both (exactly 7 days apart)
    vi.mocked(Log.aggregate).mockResolvedValue(
      makeDays([
        { date: BASE, minutes: 12 * 60 },
        { date: daysFrom(BASE, 7), minutes: 12 * 60 }, // day 8 (7 days difference)
      ])
    );
    const result = await evaluateWeeklyHours({} as any, 24);
    // Neither individual window has 24h — each only has 12h
    expect(result.met).toBe(false);
    expect(result.progress).toBe(12);
  });

  it('window DOES include day 1 and day 7 (6 days difference = within 7-day window)', async () => {
    // 12h on day 1 and 12h on day 7 → 6 days difference → same window → 24h total
    vi.mocked(Log.aggregate).mockResolvedValue(
      makeDays([
        { date: BASE, minutes: 12 * 60 },
        { date: daysFrom(BASE, 6), minutes: 12 * 60 }, // 6 days later
      ])
    );
    const result = await evaluateWeeklyHours({} as any, 24);
    expect(result.met).toBe(true);
    expect(result.progress).toBe(24);
  });

  it('picks the BEST window when multiple windows exist', async () => {
    // Week 1: 2h/day for 7 days = 14h
    // Week 2: 5h/day for 7 days = 35h ← should use this
    const week1 = Array.from({ length: 7 }, (_, i) => ({
      date: daysFrom(BASE, i),
      minutes: 2 * 60,
    }));
    const week2 = Array.from({ length: 7 }, (_, i) => ({
      date: daysFrom(BASE, 14 + i), // gap so windows don't overlap
      minutes: 5 * 60,
    }));
    vi.mocked(Log.aggregate).mockResolvedValue(makeDays([...week1, ...week2]));
    const result = await evaluateWeeklyHours({} as any, 24);
    expect(result.met).toBe(true);
    expect(result.progress).toBe(35);
  });

  it('handles logs with gaps between active days', async () => {
    // Jan 1, Jan 15, Jan 30 — each 20h, but never two within the same 7-day window
    vi.mocked(Log.aggregate).mockResolvedValue(
      makeDays([
        { date: new Date('2024-01-01'), minutes: 20 * 60 },
        { date: new Date('2024-01-15'), minutes: 20 * 60 },
        { date: new Date('2024-01-30'), minutes: 20 * 60 },
      ])
    );
    const result = await evaluateWeeklyHours({} as any, 24);
    expect(result.met).toBe(false);
    expect(result.progress).toBe(20);
  });
});

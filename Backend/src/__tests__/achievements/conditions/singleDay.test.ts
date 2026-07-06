import { describe, it, expect, vi, beforeEach } from 'vitest';
import { evaluateSingleDayHours } from '../../../services/achievements/conditions/singleDayHours.condition.js';

vi.mock('../../../models/log.model.js', () => ({
  default: { aggregate: vi.fn() },
}));

import Log from '../../../models/log.model.js';

describe('evaluateSingleDayHours', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns met=false progress=0 with no logs', async () => {
    vi.mocked(Log.aggregate).mockResolvedValue([]);
    const result = await evaluateSingleDayHours({} as any, 10);
    expect(result).toEqual({ met: false, progress: 0 });
  });

  it('meets Marathon threshold (10h) with exactly 10h in one day', async () => {
    vi.mocked(Log.aggregate).mockResolvedValue([{ totalHours: 10 }]);
    const result = await evaluateSingleDayHours({} as any, 10);
    expect(result.met).toBe(true);
    expect(result.progress).toBe(10);
  });

  it('does not meet 10h threshold with only 9h best day', async () => {
    vi.mocked(Log.aggregate).mockResolvedValue([{ totalHours: 9 }]);
    const result = await evaluateSingleDayHours({} as any, 10);
    expect(result.met).toBe(false);
    expect(result.progress).toBe(9);
  });

  it('uses the max across all days (returned by aggregate $sort:-1 $limit:1)', async () => {
    // Aggregate already returns the max day first
    vi.mocked(Log.aggregate).mockResolvedValue([{ totalHours: 15 }]);
    const result = await evaluateSingleDayHours({} as any, 10);
    expect(result.met).toBe(true);
    expect(result.progress).toBe(15);
  });
});

import { evaluateSessionsInDay } from '../../../services/achievements/conditions/sessionsInDay.condition.js';

describe('evaluateSessionsInDay', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns met=false progress=0 with no logs', async () => {
    vi.mocked(Log.aggregate).mockResolvedValue([]);
    const result = await evaluateSessionsInDay({} as any, 5);
    expect(result).toEqual({ met: false, progress: 0 });
  });

  it('meets Sprinter (5 sessions/day) threshold', async () => {
    vi.mocked(Log.aggregate).mockResolvedValue([{ count: 5 }]);
    const result = await evaluateSessionsInDay({} as any, 5);
    expect(result.met).toBe(true);
    expect(result.progress).toBe(5);
  });

  it('does not meet threshold with 4 sessions', async () => {
    vi.mocked(Log.aggregate).mockResolvedValue([{ count: 4 }]);
    const result = await evaluateSessionsInDay({} as any, 5);
    expect(result.met).toBe(false);
    expect(result.progress).toBe(4);
  });
});

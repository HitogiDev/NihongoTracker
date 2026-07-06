import { describe, it, expect, vi, beforeEach } from 'vitest';
import { evaluateTotalHours } from '../../../services/achievements/conditions/totalHours.condition.js';

vi.mock('../../../models/log.model.js', () => ({
  default: { aggregate: vi.fn() },
}));

import Log from '../../../models/log.model.js';

describe('evaluateTotalHours', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns met=false and progress=0 with no logs', async () => {
    vi.mocked(Log.aggregate).mockResolvedValue([]);
    const result = await evaluateTotalHours({} as any, 100);
    expect(result).toEqual({ met: false, progress: 0 });
  });

  it('converts minutes to hours correctly (floors)', async () => {
    // 359 minutes = 5 hours (floor)
    vi.mocked(Log.aggregate).mockResolvedValue([{ totalMinutes: 359 }]);
    const result = await evaluateTotalHours({} as any, 5);
    expect(result.progress).toBe(5);
    expect(result.met).toBe(true);
  });

  it('does not meet threshold if just short by a minute (5h59m < 6h)', async () => {
    vi.mocked(Log.aggregate).mockResolvedValue([{ totalMinutes: 359 }]);
    const result = await evaluateTotalHours({} as any, 6);
    expect(result.met).toBe(false);
    expect(result.progress).toBe(5);
  });

  it('meets threshold at exactly 100h', async () => {
    vi.mocked(Log.aggregate).mockResolvedValue([{ totalMinutes: 6000 }]);
    const result = await evaluateTotalHours({} as any, 100);
    expect(result.met).toBe(true);
    expect(result.progress).toBe(100);
  });

  it('meets Dedicated threshold (100h) with surplus', async () => {
    vi.mocked(Log.aggregate).mockResolvedValue([{ totalMinutes: 12000 }]);
    const result = await evaluateTotalHours({} as any, 100);
    expect(result.met).toBe(true);
    expect(result.progress).toBe(200);
  });

  it('does not meet Otaku threshold (500h) with only 499h', async () => {
    vi.mocked(Log.aggregate).mockResolvedValue([{ totalMinutes: 29940 }]); // 499h
    const result = await evaluateTotalHours({} as any, 500);
    expect(result.met).toBe(false);
  });
});

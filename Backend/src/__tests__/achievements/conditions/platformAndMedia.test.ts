import { describe, it, expect, vi, beforeEach } from 'vitest';
import { evaluatePlatformAge } from '../../../services/achievements/conditions/platformAge.condition.js';

vi.mock('../../../models/user.model.js', () => ({
  default: { findById: vi.fn() },
}));

import User from '../../../models/user.model.js';

function mockFindById(data: unknown) {
  vi.mocked(User.findById).mockReturnValue({
    select: vi.fn().mockReturnValue({
      lean: vi.fn().mockResolvedValue(data),
    }),
  } as any);
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

describe('evaluatePlatformAge', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns met=false progress=0 when user not found', async () => {
    mockFindById(null);
    const result = await evaluatePlatformAge({} as any, 365);
    expect(result).toEqual({ met: false, progress: 0 });
  });

  it('returns met=false when account is too new (50 days, threshold 365)', async () => {
    mockFindById({ createdAt: daysAgo(50) });
    const result = await evaluatePlatformAge({} as any, 365);
    expect(result.met).toBe(false);
    expect(result.progress).toBe(50);
  });

  it('meets The Long Game (365 days) when account is exactly 365 days old', async () => {
    mockFindById({ createdAt: daysAgo(365) });
    const result = await evaluatePlatformAge({} as any, 365);
    expect(result.met).toBe(true);
    expect(result.progress).toBe(365);
  });

  it('meets threshold when account is older than required', async () => {
    mockFindById({ createdAt: daysAgo(500) });
    const result = await evaluatePlatformAge({} as any, 365);
    expect(result.met).toBe(true);
    expect(result.progress).toBe(500);
  });

  it('returns met=false when createdAt is missing', async () => {
    mockFindById({}); // no createdAt field
    const result = await evaluatePlatformAge({} as any, 365);
    expect(result).toEqual({ met: false, progress: 0 });
  });
});

import { evaluateMediaTypeHours } from '../../../services/achievements/conditions/mediaTypeHours.condition.js';

vi.mock('../../../models/log.model.js', () => ({
  default: { aggregate: vi.fn() },
}));

import Log from '../../../models/log.model.js';

describe('evaluateMediaTypeHours', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns met=false progress=0 with no logs', async () => {
    vi.mocked(Log.aggregate).mockResolvedValue([]);
    const result = await evaluateMediaTypeHours({} as any, 'anime', 100);
    expect(result).toEqual({ met: false, progress: 0 });
  });

  it('meets Cinephile (100h anime) threshold', async () => {
    vi.mocked(Log.aggregate).mockResolvedValue([{ totalMinutes: 6000 }]);
    const result = await evaluateMediaTypeHours({} as any, 'anime', 100);
    expect(result.met).toBe(true);
    expect(result.progress).toBe(100);
  });

  it('does not meet threshold with 99h anime', async () => {
    vi.mocked(Log.aggregate).mockResolvedValue([{ totalMinutes: 5940 }]); // 99h
    const result = await evaluateMediaTypeHours({} as any, 'anime', 100);
    expect(result.met).toBe(false);
    expect(result.progress).toBe(99);
  });

  it('reading_combined groups manga + reading (Bookworm achievement)', async () => {
    vi.mocked(Log.aggregate).mockResolvedValue([{ totalMinutes: 3000 }]); // 50h
    const result = await evaluateMediaTypeHours({} as any, 'reading_combined', 50);
    expect(result.met).toBe(true);
    expect(result.progress).toBe(50);
  });

  it('meets Gamer (50h vn) threshold', async () => {
    vi.mocked(Log.aggregate).mockResolvedValue([{ totalMinutes: 3600 }]); // 60h
    const result = await evaluateMediaTypeHours({} as any, 'vn', 50);
    expect(result.met).toBe(true);
  });

  it('meets Podcast Brain (30h audio) threshold', async () => {
    vi.mocked(Log.aggregate).mockResolvedValue([{ totalMinutes: 1800 }]); // 30h
    const result = await evaluateMediaTypeHours({} as any, 'audio', 30);
    expect(result.met).toBe(true);
    expect(result.progress).toBe(30);
  });
});

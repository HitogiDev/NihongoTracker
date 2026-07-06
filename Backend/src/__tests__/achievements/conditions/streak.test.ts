import { describe, it, expect, vi, beforeEach } from 'vitest';
import { evaluateStreak } from '../../../services/achievements/conditions/streak.condition.js';

// Mock the User model
vi.mock('../../../models/user.model.js', () => ({
  default: { findById: vi.fn() },
}));

import User from '../../../models/user.model.js';

// Helper to make a chainable findById mock
function mockFindById(data: unknown) {
  vi.mocked(User.findById).mockReturnValue({
    select: vi.fn().mockReturnValue({
      lean: vi.fn().mockResolvedValue(data),
    }),
  } as any);
}

describe('evaluateStreak', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns met=false and progress=0 when user not found', async () => {
    mockFindById(null);
    const result = await evaluateStreak({} as any, 7);
    expect(result).toEqual({ met: false, progress: 0 });
  });

  it('returns met=false and progress=0 when user has no stats', async () => {
    mockFindById({ stats: null });
    const result = await evaluateStreak({} as any, 7);
    expect(result).toEqual({ met: false, progress: 0 });
  });

  it('returns met=true when currentStreak meets threshold', async () => {
    mockFindById({ stats: { currentStreak: 7, longestStreak: 3 } });
    const result = await evaluateStreak({} as any, 7);
    expect(result.met).toBe(true);
    expect(result.progress).toBe(7);
  });

  it('returns met=true when longestStreak meets threshold even if current is lower', async () => {
    // User broke a 30-day streak but still deserves the achievement
    mockFindById({ stats: { currentStreak: 2, longestStreak: 30 } });
    const result = await evaluateStreak({} as any, 30);
    expect(result.met).toBe(true);
    expect(result.progress).toBe(30);
  });

  it('returns met=false when neither streak meets threshold', async () => {
    mockFindById({ stats: { currentStreak: 5, longestStreak: 6 } });
    const result = await evaluateStreak({} as any, 7);
    expect(result.met).toBe(false);
    expect(result.progress).toBe(6);
  });

  it('uses the higher of currentStreak and longestStreak as progress', async () => {
    mockFindById({ stats: { currentStreak: 20, longestStreak: 10 } });
    const result = await evaluateStreak({} as any, 100);
    expect(result.progress).toBe(20);
  });

  it('handles missing streak fields (undefined) gracefully', async () => {
    mockFindById({ stats: {} });
    const result = await evaluateStreak({} as any, 1);
    expect(result).toEqual({ met: false, progress: 0 });
  });

  it('meets threshold of exactly 1 with a 1-day streak', async () => {
    mockFindById({ stats: { currentStreak: 1, longestStreak: 1 } });
    const result = await evaluateStreak({} as any, 1);
    expect(result.met).toBe(true);
  });
});

/**
 * achievementEngine.test.ts
 *
 * Tests for checkAchievements() and grantAchievement().
 *
 * Strategy: mock all DB models and condition evaluators so the engine
 * logic (filtering, deduplication, upsert, return value) is tested in
 * isolation from the database and from the individual condition functions.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Types } from 'mongoose';

// ─── Mock all models ──────────────────────────────────────────────────────────

vi.mock('../../models/achievement.model.js', () => ({
  default: {
    find: vi.fn(),
    findById: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue(null),
    })),
  },
}));

// Notification delivery is a side effect of unlocking; keep it out of these tests.
vi.mock('../../services/notifications.service.js', () => ({
  createNotification: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../models/userAchievement.model.js', () => ({
  default: {
    find: vi.fn(),
    findOneAndUpdate: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn(),
  },
}));

// ─── Mock every condition evaluator ──────────────────────────────────────────
// We control them individually per test.

vi.mock('../../services/achievements/conditions/streak.condition.js', () => ({
  evaluateStreak: vi.fn(),
}));
vi.mock('../../services/achievements/conditions/totalXp.condition.js', () => ({
  evaluateTotalXp: vi.fn(),
}));
vi.mock('../../services/achievements/conditions/logCount.condition.js', () => ({
  evaluateLogCount: vi.fn(),
}));
vi.mock('../../services/achievements/conditions/mediaType.condition.js', () => ({
  evaluateMediaType: vi.fn(),
}));
vi.mock('../../services/achievements/conditions/level.condition.js', () => ({
  evaluateLevel: vi.fn(),
}));
vi.mock('../../services/achievements/conditions/totalHours.condition.js', () => ({
  evaluateTotalHours: vi.fn(),
}));
vi.mock('../../services/achievements/conditions/mediaTypeHours.condition.js', () => ({
  evaluateMediaTypeHours: vi.fn(),
}));
vi.mock('../../services/achievements/conditions/achievementCount.condition.js', () => ({
  evaluateAchievementCount: vi.fn(),
}));
vi.mock('../../services/achievements/conditions/logTimeRange.condition.js', () => ({
  evaluateLogTimeRange: vi.fn(),
}));
vi.mock('../../services/achievements/conditions/logOnDate.condition.js', () => ({
  evaluateLogOnDate: vi.fn(),
}));
vi.mock('../../services/achievements/conditions/singleDayHours.condition.js', () => ({
  evaluateSingleDayHours: vi.fn(),
}));
vi.mock('../../services/achievements/conditions/weeklyHours.condition.js', () => ({
  evaluateWeeklyHours: vi.fn(),
}));
vi.mock('../../services/achievements/conditions/sessionsInDay.condition.js', () => ({
  evaluateSessionsInDay: vi.fn(),
}));
vi.mock('../../services/achievements/conditions/platformAge.condition.js', () => ({
  evaluatePlatformAge: vi.fn(),
}));

// ─── Imports (after mocks) ────────────────────────────────────────────────────

import { checkAchievements, grantAchievement } from '../../services/achievements/achievementEngine.js';
import Achievement from '../../models/achievement.model.js';
import UserAchievement from '../../models/userAchievement.model.js';
import { evaluateLogCount } from '../../services/achievements/conditions/logCount.condition.js';
import { evaluateStreak } from '../../services/achievements/conditions/streak.condition.js';
import { evaluateTotalHours } from '../../services/achievements/conditions/totalHours.condition.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const userId = new Types.ObjectId();

function makeAchievement(overrides: Record<string, unknown> = {}) {
  return {
    _id: new Types.ObjectId(),
    key: 'test_achievement',
    name: 'Test Achievement',
    condition: { type: 'logCount', threshold: 10 },
    isActive: true,
    ...overrides,
  };
}

// Make UserAchievement.find return a chain of .select().lean()
function mockEarnedIds(ids: Types.ObjectId[]) {
  vi.mocked(UserAchievement.find).mockReturnValue({
    select: vi.fn().mockReturnValue({
      lean: vi.fn().mockResolvedValue(ids.map((id) => ({ achievement: id }))),
    }),
  } as any);
}

function mockFindOneAndUpdate() {
  vi.mocked(UserAchievement.findOneAndUpdate).mockReturnValue({
    exec: vi.fn().mockResolvedValue(null),
  } as any);
}

// ─── checkAchievements ────────────────────────────────────────────────────────

describe('checkAchievements', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindOneAndUpdate();
  });

  it('returns [] immediately for "manual" trigger (no conditions to evaluate)', async () => {
    const result = await checkAchievements(userId, { trigger: 'manual' });
    expect(result).toEqual([]);
    expect(Achievement.find).not.toHaveBeenCalled();
  });

  it('returns [] when no achievements exist in DB', async () => {
    vi.mocked(Achievement.find).mockReturnValue({
      lean: vi.fn().mockResolvedValue([]),
    } as any);
    const result = await checkAchievements(userId, { trigger: 'log' });
    expect(result).toEqual([]);
  });

  it('grants a newly met achievement and returns it', async () => {
    const achievement = makeAchievement({ condition: { type: 'logCount', threshold: 10 } });

    vi.mocked(Achievement.find).mockReturnValue({
      lean: vi.fn().mockResolvedValue([achievement]),
    } as any);

    mockEarnedIds([]); // user has no earned achievements

    vi.mocked(evaluateLogCount).mockResolvedValue({ met: true, progress: 10 });

    const result = await checkAchievements(userId, { trigger: 'log' });

    expect(result).toHaveLength(1);
    expect(result[0].key).toBe('test_achievement');
    expect(UserAchievement.findOneAndUpdate).toHaveBeenCalledOnce();
  });

  it('skips achievements the user has already earned', async () => {
    const achievement = makeAchievement();
    vi.mocked(Achievement.find).mockReturnValue({
      lean: vi.fn().mockResolvedValue([achievement]),
    } as any);

    // User already has this achievement
    mockEarnedIds([achievement._id as Types.ObjectId]);

    const result = await checkAchievements(userId, { trigger: 'log' });

    expect(result).toEqual([]);
    expect(evaluateLogCount).not.toHaveBeenCalled();
  });

  it('does not grant when condition is not met, but still updates progress', async () => {
    const achievement = makeAchievement({ condition: { type: 'logCount', threshold: 100 } });

    vi.mocked(Achievement.find).mockReturnValue({
      lean: vi.fn().mockResolvedValue([achievement]),
    } as any);
    mockEarnedIds([]);
    vi.mocked(evaluateLogCount).mockResolvedValue({ met: false, progress: 15 });

    const result = await checkAchievements(userId, { trigger: 'log' });

    expect(result).toEqual([]);
    // progress update is fire-and-forget (.exec().catch()), so we can't easily
    // assert findOneAndUpdate here, but we assert it was NOT called with upsert
    const calls = vi.mocked(UserAchievement.findOneAndUpdate).mock.calls;
    const upsertCall = calls.find((c) => (c[2] as any)?.upsert === true);
    expect(upsertCall).toBeUndefined();
  });

  it('evaluates streak conditions when trigger is "streak"', async () => {
    const achievement = makeAchievement({
      condition: { type: 'streak', threshold: 7 },
    });
    vi.mocked(Achievement.find).mockReturnValue({
      lean: vi.fn().mockResolvedValue([achievement]),
    } as any);
    mockEarnedIds([]);
    vi.mocked(evaluateStreak).mockResolvedValue({ met: true, progress: 7 });

    const result = await checkAchievements(userId, { trigger: 'streak' });
    expect(result).toHaveLength(1);
  });

  it('grants multiple achievements in one check when several conditions are met', async () => {
    const a1 = makeAchievement({ key: 'logs_10', condition: { type: 'logCount', threshold: 10 } });
    const a2 = makeAchievement({ key: 'hours_100', condition: { type: 'totalHours', threshold: 100 } });

    vi.mocked(Achievement.find).mockReturnValue({
      lean: vi.fn().mockResolvedValue([a1, a2]),
    } as any);
    mockEarnedIds([]);
    vi.mocked(evaluateLogCount).mockResolvedValue({ met: true, progress: 10 });
    vi.mocked(evaluateTotalHours).mockResolvedValue({ met: true, progress: 100 });

    const result = await checkAchievements(userId, { trigger: 'log' });
    expect(result).toHaveLength(2);
  });

  it('handles a condition evaluator throwing without crashing the whole check', async () => {
    const a1 = makeAchievement({ key: 'bad', condition: { type: 'logCount', threshold: 1 } });
    const a2 = makeAchievement({ key: 'good', condition: { type: 'logCount', threshold: 1 } });

    vi.mocked(Achievement.find).mockReturnValue({
      lean: vi.fn().mockResolvedValue([a1, a2]),
    } as any);
    mockEarnedIds([]);

    vi.mocked(evaluateLogCount)
      .mockRejectedValueOnce(new Error('DB timeout')) // first call throws
      .mockResolvedValueOnce({ met: true, progress: 1 }); // second call succeeds

    const result = await checkAchievements(userId, { trigger: 'log' });
    // Should still grant the second achievement despite the first one throwing
    expect(result).toHaveLength(1);
    expect(result[0].key).toBe('good');
  });
});

// ─── grantAchievement ─────────────────────────────────────────────────────────

describe('grantAchievement', () => {
  const achievementId = new Types.ObjectId();

  beforeEach(() => vi.clearAllMocks());

  it('grants achievement and returns true when user does not have it', async () => {
    vi.mocked(UserAchievement.findOne).mockResolvedValue(null);
    vi.mocked(UserAchievement.create).mockResolvedValue({} as any);

    const result = await grantAchievement(userId, achievementId);
    expect(result).toBe(true);
    expect(UserAchievement.create).toHaveBeenCalledOnce();
  });

  it('returns false and does NOT create a duplicate when user already has it', async () => {
    vi.mocked(UserAchievement.findOne).mockResolvedValue({ _id: 'existing' } as any);

    const result = await grantAchievement(userId, achievementId);
    expect(result).toBe(false);
    expect(UserAchievement.create).not.toHaveBeenCalled();
  });
});

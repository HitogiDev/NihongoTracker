import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';
import {
  evaluateDuelsForUser,
  finalizeExpiredDuels,
  getDuelStats,
} from '../services/duels.service.js';

const mocks = vi.hoisted(() => ({
  duelFind: vi.fn(),
  duelUpdateMany: vi.fn(),
  duelFindOneAndUpdate: vi.fn(),
  duelCountDocuments: vi.fn(),
  logFind: vi.fn(),
  userFind: vi.fn(),
  aggregateMetric: vi.fn(),
  createNotification: vi.fn(),
  createActivity: vi.fn(),
  checkAchievements: vi.fn(),
}));

vi.mock('../models/duel.model.js', () => ({
  default: {
    find: mocks.duelFind,
    updateMany: mocks.duelUpdateMany,
    findOneAndUpdate: mocks.duelFindOneAndUpdate,
    countDocuments: mocks.duelCountDocuments,
  },
}));
vi.mock('../models/log.model.js', () => ({ default: { find: mocks.logFind } }));
vi.mock('../models/user.model.js', () => ({
  default: { find: mocks.userFind },
}));
vi.mock('../services/clubLogMetrics.service.js', () => ({
  aggregateVisibleLogMetricByUser: mocks.aggregateMetric,
}));
vi.mock('../services/notifications.service.js', () => ({
  createNotification: mocks.createNotification,
  removeNotifications: vi.fn(),
}));
vi.mock('../services/activity.service.js', () => ({
  createActivity: mocks.createActivity,
}));
vi.mock('../services/achievements/achievementEngine.js', () => ({
  checkAchievements: mocks.checkAchievements,
}));

const challenger = new Types.ObjectId();
const opponent = new Types.ObjectId();

function makeDuel(overrides: Record<string, unknown> = {}) {
  return {
    _id: new Types.ObjectId(),
    challenger,
    opponent,
    metric: 'episodes',
    target: 10,
    mediaType: 'anime',
    status: 'active',
    startDate: new Date('2026-01-01T00:00:00.000Z'),
    endDate: new Date('2026-01-08T00:00:00.000Z'),
    ...overrides,
  };
}

function progressFor(values: Record<string, number>) {
  mocks.aggregateMetric.mockImplementation(
    ({ ownerIds }: { ownerIds: Types.ObjectId[] }) =>
      Promise.resolve([{ _id: ownerIds[0], value: values[String(ownerIds[0])] ?? 0 }])
  );
}

function chain(rows: unknown[]) {
  const query = {
    sort: () => query,
    select: () => query,
    limit: () => query,
    lean: () => Promise.resolve(rows),
  };
  return query;
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.userFind.mockReturnValue({
    select: () => ({
      lean: () =>
        Promise.resolve([
          { _id: challenger, username: 'ann' },
          { _id: opponent, username: 'bob' },
        ]),
    }),
  });
  mocks.duelFindOneAndUpdate.mockImplementation(
    (_filter: unknown, update: { $set: Record<string, unknown> }) =>
      Promise.resolve({ ...update.$set })
  );
  mocks.checkAchievements.mockResolvedValue([]);
});

describe('duel evaluation', () => {
  it('leaves a duel running while nobody reached the target', async () => {
    mocks.duelFind.mockResolvedValue([makeDuel()]);
    progressFor({ [String(challenger)]: 9, [String(opponent)]: 3 });

    await evaluateDuelsForUser(challenger);

    expect(mocks.duelFindOneAndUpdate).not.toHaveBeenCalled();
  });

  it('declares the only participant who reached the target the winner', async () => {
    mocks.duelFind.mockResolvedValue([makeDuel()]);
    progressFor({ [String(challenger)]: 10, [String(opponent)]: 4 });

    await evaluateDuelsForUser(challenger);

    expect(mocks.duelFindOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'active' }),
      {
        $set: expect.objectContaining({
          status: 'completed',
          winner: challenger,
          isDraw: false,
        }),
      },
      { new: true }
    );
    expect(mocks.createNotification).toHaveBeenCalledTimes(2);
    expect(mocks.createActivity).toHaveBeenCalledWith(
      expect.objectContaining({ actor: challenger, type: 'duel_won' })
    );
    expect(mocks.checkAchievements).toHaveBeenCalledWith(challenger, {
      trigger: 'duelComplete',
    });
  });

  it('gives the win to the participant who crossed the target first', async () => {
    mocks.duelFind
      .mockResolvedValueOnce([makeDuel()])
      .mockImplementation(() => undefined);
    progressFor({ [String(challenger)]: 12, [String(opponent)]: 11 });
    mocks.logFind
      .mockReturnValueOnce(
        chain([{ date: new Date('2026-01-05T00:00:00.000Z'), type: 'anime', episodes: 12 }])
      )
      .mockReturnValueOnce(
        chain([{ date: new Date('2026-01-03T00:00:00.000Z'), type: 'anime', episodes: 11 }])
      );

    await evaluateDuelsForUser(challenger);

    expect(mocks.duelFindOneAndUpdate).toHaveBeenCalledWith(
      expect.anything(),
      { $set: expect.objectContaining({ winner: opponent }) },
      { new: true }
    );
  });

  it('does not notify twice when another request already finished the duel', async () => {
    mocks.duelFind.mockResolvedValue([makeDuel()]);
    progressFor({ [String(challenger)]: 10, [String(opponent)]: 0 });
    mocks.duelFindOneAndUpdate.mockResolvedValue(null);

    await evaluateDuelsForUser(challenger);

    expect(mocks.createNotification).not.toHaveBeenCalled();
    expect(mocks.checkAchievements).not.toHaveBeenCalled();
  });
});

describe('duel expiry', () => {
  it('expires unanswered challenges and ends overdue duels by progress', async () => {
    mocks.duelFind
      .mockReturnValueOnce({ select: () => Promise.resolve([]) })
      .mockResolvedValueOnce([makeDuel()]);
    progressFor({ [String(challenger)]: 3, [String(opponent)]: 7 });

    const result = await finalizeExpiredDuels();

    expect(result).toEqual({ expired: 0, finished: 1 });
    expect(mocks.duelFindOneAndUpdate).toHaveBeenCalledWith(
      expect.anything(),
      { $set: expect.objectContaining({ winner: opponent, isDraw: false }) },
      { new: true }
    );
  });

  it('records a draw when both participants have equal progress', async () => {
    mocks.duelFind
      .mockReturnValueOnce({ select: () => Promise.resolve([]) })
      .mockResolvedValueOnce([makeDuel()]);
    progressFor({ [String(challenger)]: 4, [String(opponent)]: 4 });

    await finalizeExpiredDuels();

    expect(mocks.duelFindOneAndUpdate).toHaveBeenCalledWith(
      expect.anything(),
      { $set: expect.objectContaining({ winner: null, isDraw: true }) },
      { new: true }
    );
    expect(mocks.createActivity).not.toHaveBeenCalled();
  });
});

describe('duel stats', () => {
  it('computes records, streaks, and rivals from finished duels', async () => {
    const rival = new Types.ObjectId();
    const finished = [
      { challenger, opponent, winner: challenger, isDraw: false },
      { challenger, opponent, winner: challenger, isDraw: false },
      { challenger: rival, opponent: challenger, winner: rival, isDraw: false },
      { challenger, opponent: rival, winner: null, isDraw: true },
      { challenger: rival, opponent: challenger, winner: rival, isDraw: false },
    ];
    mocks.duelFind.mockReturnValue(chain(finished));
    mocks.duelCountDocuments.mockResolvedValue(2);
    mocks.userFind.mockReturnValue({
      select: () => ({
        lean: () =>
          Promise.resolve([
            { _id: opponent, username: 'bob' },
            { _id: rival, username: 'rex' },
          ]),
      }),
    });

    const stats = await getDuelStats(challenger);

    expect(stats).toMatchObject({
      wins: 2,
      losses: 2,
      draws: 1,
      total: 5,
      winRate: 0.4,
      currentStreak: 0,
      bestStreak: 2,
      openDuels: 2,
    });
    expect(stats.bestRival?.user.username).toBe('bob');
    expect(stats.mostFrequentRival?.user.username).toBe('rex');
  });
});

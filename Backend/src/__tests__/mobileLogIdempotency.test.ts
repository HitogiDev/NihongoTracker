import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import { createLog } from '../controllers/logs.controller.js';

const mocks = vi.hoisted(() => ({ find: vi.fn(), save: vi.fn(), stats: vi.fn(), streak: vi.fn(), achievements: vi.fn(), recalculateXp: vi.fn(), recalculateStreak: vi.fn(), complete: vi.fn() }));
vi.mock('../models/log.model.js', () => {
  class Log { save = mocks.save; }
  return { default: Object.assign(Log, { findOne: mocks.find, updateOne: mocks.complete }) };
});
vi.mock('../models/media.model.js', () => ({ MediaBase: { findOne: vi.fn().mockResolvedValue(null) }, Anime: {}, Manga: {}, Reading: {} }));
vi.mock('../services/updateStats.js', () => ({ default: mocks.stats, recalculateUserXpFromLogs: mocks.recalculateXp }));
vi.mock('../services/streaks.js', () => ({ updateStreakWithLog: mocks.streak, recalculateStreaksForUser: mocks.recalculateStreak, getLiveCurrentStreak: vi.fn() }));
vi.mock('../services/achievements/achievementEngine.js', () => ({ checkAchievements: mocks.achievements, dismissAchievementNotifications: vi.fn() }));
vi.mock('../services/meilisearch/meiliClient.js', () => ({ default: {} }));

const ownerId = new Types.ObjectId();
function response() {
  const res = { locals: { user: { _id: ownerId } }, status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  return res as unknown as Response;
}
function request(key: string) {
  return { get: () => key, body: { type: 'reading', description: 'Book', time: 30 } } as unknown as Request;
}
beforeEach(() => vi.clearAllMocks());

describe('mobile log retry boundaries', () => {
  it('returns the existing log without repeating XP, streaks, or achievement checks', async () => {
    const existing = { _id: 'log', xp: 135 };
    mocks.find.mockResolvedValue({ clientOperationFinalized: true, toObject: () => existing });
    const res = response();
    const next = vi.fn();
    await createLog(request('operation-1'), res, next);
    expect(mocks.find).toHaveBeenCalledWith({ user: ownerId, clientOperationId: 'operation-1' });
    expect(res.json).toHaveBeenCalledWith(existing);
    expect(mocks.stats).not.toHaveBeenCalled();
    expect(mocks.streak).not.toHaveBeenCalled();
    expect(mocks.achievements).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('recovers the winning log when concurrent requests hit the unique index', async () => {
    mocks.find.mockResolvedValueOnce(null).mockResolvedValueOnce({ clientOperationFinalized: true, toObject: () => ({ _id: 'winner' }) });
    mocks.save.mockRejectedValue({ code: 11000 });
    const res = response();
    const next = vi.fn();
    await createLog(request('operation-2'), res, next);
    expect(res.json).toHaveBeenCalledWith({ _id: 'winner' });
    expect(mocks.stats).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects invalid operation keys before querying or saving', async () => {
    const next = vi.fn();
    await createLog(request('invalid key'), response(), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
    expect(mocks.find).not.toHaveBeenCalled();
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it('repairs interrupted finalization from persisted logs without adding XP again', async () => {
    const log = { _id: 'saved-log', user: ownerId, clientOperationFinalized: false, toObject: () => ({ _id: 'saved-log' }) };
    mocks.find.mockResolvedValue(log);
    const next = vi.fn();
    await createLog(request('interrupted-operation'), response(), next);
    expect(mocks.recalculateXp).toHaveBeenCalledWith(ownerId);
    expect(mocks.recalculateStreak).toHaveBeenCalledWith(ownerId);
    expect(mocks.achievements).toHaveBeenCalledTimes(2);
    expect(mocks.complete).toHaveBeenCalledWith({ _id: 'saved-log' }, { $set: { clientOperationFinalized: true } });
    expect(mocks.stats).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });
});

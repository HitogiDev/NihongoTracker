import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Request, Response } from 'express';
import { Types } from 'mongoose';
import {
  adminDeleteLogsBulk,
  deleteLogsBulk,
} from '../controllers/logs.controller.js';

const mocks = vi.hoisted(() => ({
  find: vi.fn(),
  remove: vi.fn(),
  user: vi.fn(),
  complete: vi.fn(),
  recalculate: vi.fn(),
}));
vi.mock('../models/log.model.js', () => ({
  default: { find: mocks.find, deleteMany: mocks.remove },
}));
vi.mock('../models/user.model.js', () => ({
  default: { findById: mocks.user },
}));
vi.mock('../services/autoComplete.js', () => ({
  evaluateAutoCompleteForUserMedia: mocks.complete,
}));
vi.mock('../services/meilisearch/mediaIndex.js', () => ({
  addMediaToIndex: vi.fn(),
}));
vi.mock('../services/updateStats.js', () => ({
  default: vi.fn(),
  updateLevelAndXp: vi.fn(),
  recalculateUserXpFromLogs: mocks.recalculate,
}));
vi.mock('../services/streaks.js', () => ({
  recalculateStreaksForUser: vi.fn(),
  updateStreakWithLog: vi.fn(),
  getLiveCurrentStreak: vi.fn(),
}));
vi.mock('../services/activity.service.js', () => ({
  deleteActivitiesBySource: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.remove.mockResolvedValue({ deletedCount: 3 });
  mocks.user.mockResolvedValue(null);
});

describe('bulk deletion media completion', () => {
  it.each([deleteLogsBulk, adminDeleteLogsBulk])(
    'recomputes each affected user and media pair once',
    async (controller) => {
      const user = new Types.ObjectId();
      const logs = [
        { _id: new Types.ObjectId(), user, mediaId: 'media-a', type: 'anime' },
        { _id: new Types.ObjectId(), user, mediaId: 'media-a', type: 'anime' },
        { _id: new Types.ObjectId(), user, mediaId: 'media-b', type: 'manga' },
      ];
      mocks.find.mockReturnValue({
        select: () => ({ lean: async () => logs }),
      });
      const res = {
        locals: { user: { id: user, _id: user } },
        status: vi.fn(),
        json: vi.fn(),
      };
      res.status.mockReturnValue(res);
      const next = vi.fn();
      await controller(
        { body: { ids: logs.map((log) => String(log._id)) } } as Request,
        res as unknown as Response,
        next
      );
      expect(next).not.toHaveBeenCalled();
      expect(mocks.complete).toHaveBeenCalledTimes(2);
      expect(mocks.complete).toHaveBeenCalledWith(
        String(user),
        'media-a',
        'anime'
      );
      expect(mocks.complete).toHaveBeenCalledWith(
        String(user),
        'media-b',
        'manga'
      );
      expect(mocks.remove.mock.invocationCallOrder[0]).toBeLessThan(
        mocks.complete.mock.invocationCallOrder[0]
      );
    }
  );
});

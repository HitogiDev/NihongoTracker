import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';
import { IClub, IClubChallenge } from '../types.js';
import { getClubObjectives } from '../services/clubObjectives.service.js';

const mocks = vi.hoisted(() => ({
  aggregate: vi.fn(),
  userFind: vi.fn(),
  find: vi.fn(),
  updateOne: vi.fn(),
  deleteMany: vi.fn(),
  visible: vi.fn(),
}));
vi.mock('../models/clubChallenge.model.js', () => ({
  default: {
    find: mocks.find,
    updateOne: mocks.updateOne,
    deleteMany: mocks.deleteMany,
  },
}));
vi.mock('../models/user.model.js', () => ({
  default: { find: mocks.userFind },
}));
vi.mock('../services/clubLogMetrics.service.js', () => ({
  aggregateVisibleLogMetricByUser: mocks.aggregate,
}));
vi.mock('../services/socialVisibility.service.js', () => ({
  getVisibleSocialOwnerIds: mocks.visible,
}));
vi.mock('../services/clubChallenge.service.js', () => ({
  getChallengeProgress: vi.fn(),
  refreshChallengeStatuses: vi.fn(),
}));

beforeEach(() => vi.clearAllMocks());
describe('unified collective objectives', () => {
  it('recomputes source progress without double counting and mirrors legacy goals', async () => {
    const member = new Types.ObjectId();
    const goalId = new Types.ObjectId();
    const club = {
      _id: new Types.ObjectId(),
      members: [{ user: member, status: 'active', role: 'leader' }],
      clubGoals: [
        {
          _id: goalId,
          type: 'chars',
          target: 200,
          period: 'custom',
          isActive: true,
          currentProgress: 0,
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-01-31'),
        },
      ],
    } as unknown as IClub;
    const objective = {
      _id: new Types.ObjectId(),
      mode: 'collective',
      metric: 'chars',
      goal: 200,
      toObject: () => ({ _id: goalId }),
    } as unknown as IClubChallenge;
    mocks.find.mockReturnValue({
      populate: () => ({ sort: async () => [objective] }),
    });
    mocks.userFind.mockReturnValue({
      select: () => ({
        lean: async () => [{ _id: member, username: 'reader' }],
      }),
    });
    mocks.visible.mockResolvedValue([member]);
    mocks.aggregate.mockResolvedValue([{ _id: member, value: 100 }]);
    for (let index = 0; index < 2; index += 1) {
      const result = await getClubObjectives(club, member);
      expect(result[0]).toMatchObject({
        progress: 100,
        remaining: 100,
        completed: false,
      });
    }
    expect(club.clubGoals[0].currentProgress).toBe(0);
    expect(mocks.aggregate).toHaveBeenCalledTimes(2);
    expect(mocks.updateOne).toHaveBeenCalledWith(
      { club: club._id, legacyGoalId: goalId },
      expect.objectContaining({
        $set: expect.objectContaining({ mode: 'collective', goal: 200 }),
      }),
      { upsert: true }
    );
  });
});

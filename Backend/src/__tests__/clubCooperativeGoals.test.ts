import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';
import { IClub } from '../types.js';
import { getCooperativeGoalsProgress } from '../services/clubGoals.js';

const mocks = vi.hoisted(() => ({
  aggregateMetric: vi.fn(),
  createActivity: vi.fn(),
  userFind: vi.fn(),
}));

vi.mock('../models/club.model.js', () => ({ Club: {} }));
vi.mock('../models/user.model.js', () => ({
  default: { find: mocks.userFind },
}));
vi.mock('../services/activity.service.js', () => ({
  createActivity: mocks.createActivity,
}));
vi.mock('../services/clubLogMetrics.service.js', () => ({
  aggregateVisibleLogMetricByUser: mocks.aggregateMetric,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.userFind.mockReturnValue({
    select: () => ({ lean: () => Promise.resolve([]) }),
  });
  mocks.createActivity.mockResolvedValue(null);
});

describe('cooperative club goals', () => {
  it('recomputes from source rows without incrementing or double counting', async () => {
    const firstMember = new Types.ObjectId();
    const secondMember = new Types.ObjectId();
    const goalId = new Types.ObjectId();
    const club = {
      _id: new Types.ObjectId(),
      name: 'Readers',
      members: [
        { user: firstMember, role: 'member', status: 'active', joinedAt: new Date() },
        { user: secondMember, role: 'member', status: 'active', joinedAt: new Date() },
      ],
      clubGoals: [
        {
          _id: goalId,
          type: 'chars',
          target: 200,
          period: 'custom',
          currentProgress: 0,
          isActive: true,
          startDate: new Date('2026-01-01T00:00:00.000Z'),
          endDate: new Date('2026-01-31T23:59:59.999Z'),
        },
      ],
    } as unknown as IClub;
    mocks.aggregateMetric.mockResolvedValue([
      { _id: firstMember, value: 40 },
      { _id: secondMember, value: 60 },
    ]);

    const first = await getCooperativeGoalsProgress(club, firstMember);
    const second = await getCooperativeGoalsProgress(club, firstMember);

    expect(first[0]).toMatchObject({ currentTotal: 100, remaining: 100 });
    expect(second[0]).toMatchObject({ currentTotal: 100, remaining: 100 });
    expect(club.clubGoals[0]?.currentProgress).toBe(0);
    expect(mocks.aggregateMetric).toHaveBeenCalledTimes(2);
  });
});

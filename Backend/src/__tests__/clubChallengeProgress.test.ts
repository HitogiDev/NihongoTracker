import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';
import { IClubChallenge } from '../types.js';
import { getChallengeProgress } from '../services/clubChallenge.service.js';

const mocks = vi.hoisted(() => ({
  aggregateMetric: vi.fn(),
  userFind: vi.fn(),
  visibleOwnerIds: vi.fn(),
}));

vi.mock('../models/clubChallenge.model.js', () => ({ default: {} }));
vi.mock('../models/user.model.js', () => ({
  default: { find: mocks.userFind },
}));
vi.mock('../services/activity.service.js', () => ({ createActivity: vi.fn() }));
vi.mock('../services/clubLogMetrics.service.js', () => ({
  aggregateVisibleLogMetricByUser: mocks.aggregateMetric,
}));
vi.mock('../services/socialVisibility.service.js', () => ({
  getVisibleSocialOwnerIds: mocks.visibleOwnerIds,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('club challenge progress', () => {
  it('computes challenge progress server-side from visible persisted logs', async () => {
    const participantId = new Types.ObjectId();
    const viewerId = new Types.ObjectId();
    const startDate = new Date('2026-01-01T00:00:00.000Z');
    const endDate = new Date('2026-01-31T23:59:59.999Z');
    const challenge = {
      _id: new Types.ObjectId(),
      participants: [participantId],
      completedParticipants: [],
      metric: 'chars',
      goal: 1000,
      startDate,
      endDate,
    } as unknown as IClubChallenge;
    mocks.visibleOwnerIds.mockResolvedValue([participantId]);
    mocks.aggregateMetric.mockResolvedValue([{ _id: participantId, value: 750 }]);
    mocks.userFind.mockReturnValue({
      select: () => ({
        lean: () => Promise.resolve([{ _id: participantId, username: 'reader' }]),
      }),
    });

    const result = await getChallengeProgress(challenge, viewerId);

    expect(mocks.aggregateMetric).toHaveBeenCalledWith({
      ownerIds: [participantId],
      viewerId,
      metric: 'chars',
      startDate,
      endDate,
    });
    expect(result).toEqual([
      expect.objectContaining({ progress: 750, percentage: 75, completed: false }),
    ]);
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';
import { getActivityFeed } from '../services/activity.service.js';
import { getClubLeaderboard } from '../services/clubLeaderboard.service.js';
import { IClub } from '../types.js';

const mocks = vi.hoisted(() => ({
  activityFind: vi.fn(),
  aggregateMetric: vi.fn(),
  buildVisibleActivityFilter: vi.fn(),
  followerIds: vi.fn(),
  followedIds: vi.fn(),
  reactionFind: vi.fn(),
  userFind: vi.fn(),
  visibleOwnerIds: vi.fn(),
}));

vi.mock('../models/activity.model.js', () => ({
  default: { find: mocks.activityFind },
}));
vi.mock('../models/activityComment.model.js', () => ({ default: {} }));
vi.mock('../models/activityReaction.model.js', () => ({
  default: { find: mocks.reactionFind },
}));
vi.mock('../models/log.model.js', () => ({ default: {} }));
vi.mock('../models/user.model.js', () => ({
  default: { find: mocks.userFind },
}));
vi.mock('../services/clubLogMetrics.service.js', () => ({
  aggregateVisibleLogMetricByUser: mocks.aggregateMetric,
}));
vi.mock('../services/socialVisibility.service.js', () => ({
  buildVisibleActivityFilter: mocks.buildVisibleActivityFilter,
  canViewActivity: vi.fn(),
  getFollowerUserIds: mocks.followerIds,
  getFollowedUserIds: mocks.followedIds,
  getVisibleSocialOwnerIds: mocks.visibleOwnerIds,
}));

function activityQuery() {
  return {
    populate: () => ({
      sort: () => ({ limit: () => ({ lean: () => Promise.resolve([]) }) }),
    }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.followerIds.mockResolvedValue([]);
  mocks.followedIds.mockResolvedValue([]);
  mocks.buildVisibleActivityFilter.mockReturnValue({ visibility: 'public' });
  mocks.activityFind.mockReturnValue(activityQuery());
  mocks.reactionFind.mockReturnValue({
    select: () => ({ lean: () => Promise.resolve([]) }),
  });
});

describe('club feed and leaderboard privacy', () => {
  it('applies the centralized activity visibility filter to the club feed query', async () => {
    const viewerId = new Types.ObjectId();
    const clubId = new Types.ObjectId();

    await getActivityFeed({
      viewerId,
      clubIds: [clubId],
      clubId,
      scope: 'clubs',
    });

    expect(mocks.buildVisibleActivityFilter).toHaveBeenCalledWith(
      viewerId,
      [],
      []
    );
    expect(mocks.activityFind).toHaveBeenCalledWith({
      $and: [
        { type: { $ne: 'club_joined' } },
        { club: { $in: [clubId] } },
        { visibility: 'public' },
      ],
    });
  });

  it('limits leaderboard aggregation to centrally visible statistic owners', async () => {
    const viewerId = new Types.ObjectId();
    const visibleMemberId = new Types.ObjectId();
    const privateMemberId = new Types.ObjectId();
    const club = {
      members: [
        { user: visibleMemberId, role: 'member', status: 'active', joinedAt: new Date() },
        { user: privateMemberId, role: 'member', status: 'active', joinedAt: new Date() },
      ],
    } as Pick<IClub, 'members'>;
    mocks.visibleOwnerIds.mockResolvedValue([visibleMemberId]);
    mocks.aggregateMetric.mockResolvedValue([{ _id: visibleMemberId, value: 50 }]);
    mocks.userFind.mockReturnValue({
      select: () => ({
        lean: () => Promise.resolve([{ _id: visibleMemberId, username: 'visible' }]),
      }),
    });

    const result = await getClubLeaderboard({
      club,
      viewerId,
      metric: 'xp',
      period: 'all-time',
    });

    expect(mocks.visibleOwnerIds).toHaveBeenCalledWith({
      ownerIds: [visibleMemberId, privateMemberId],
      viewerId,
      category: 'statistics',
    });
    expect(mocks.aggregateMetric).toHaveBeenCalledWith(
      expect.objectContaining({ ownerIds: [visibleMemberId], viewerId })
    );
    expect(result).toHaveLength(1);
  });
});

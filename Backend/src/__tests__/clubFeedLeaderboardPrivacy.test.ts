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
      currentMedia: [],
      members: [
        { user: visibleMemberId, role: 'member', status: 'active', joinedAt: new Date() },
        { user: privateMemberId, role: 'member', status: 'active', joinedAt: new Date() },
      ],
    } as Pick<IClub, 'members' | 'currentMedia'>;
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
    expect(mocks.aggregateMetric.mock.calls[0][0]).not.toHaveProperty('media');
    expect(result).toHaveLength(1);
  });

  it('ranks visible active members by club media activity and retains past selections', async () => {
    const memberId = new Types.ObjectId();
    const secondMemberId = new Types.ObjectId();
    const pendingId = new Types.ObjectId();
    const bannedId = new Types.ObjectId();
    const club = {
      members: [
        { user: memberId, status: 'active' },
        { user: secondMemberId, status: 'active' },
        { user: pendingId, status: 'pending' },
        { user: bannedId, status: 'banned' },
      ],
      currentMedia: [
        { mediaId: 'manual-title', mediaType: 'vn', isActive: true },
        { mediaId: 'voted-title', mediaType: 'anime', isActive: false, votingId: new Types.ObjectId() },
      ],
    } as Pick<IClub, 'members' | 'currentMedia'>;
    mocks.visibleOwnerIds.mockResolvedValue([memberId, secondMemberId]);
    mocks.aggregateMetric.mockResolvedValue([
      { _id: memberId, value: 48 },
      { _id: secondMemberId, value: 90 },
    ]);
    mocks.userFind.mockReturnValue({
      select: () => ({
        lean: () => Promise.resolve([
          { _id: memberId, username: 'first' },
          { _id: secondMemberId, username: 'second' },
        ]),
      }),
    });

    const result = await getClubLeaderboard({
      club,
      metric: 'time',
      period: 'all-time',
      scope: 'club-media',
    });

    expect(mocks.visibleOwnerIds).toHaveBeenCalledWith({
      ownerIds: [memberId, secondMemberId],
      viewerId: undefined,
      category: 'statistics',
    });
    expect(mocks.aggregateMetric).toHaveBeenCalledWith({
      ownerIds: [memberId, secondMemberId],
      viewerId: undefined,
      startDate: undefined,
      metric: 'time',
      media: club.currentMedia,
    });
    expect(result.map((entry) => [entry.user.username, entry.value, entry.rank]))
      .toEqual([['second', 90, 1], ['first', 48, 2]]);
  });
});

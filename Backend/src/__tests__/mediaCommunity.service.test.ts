import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';
import { getMediaCommunity } from '../services/mediaCommunity.service.js';

const mocks = vi.hoisted(() => ({
  activityCollection: vi.fn(),
  followedIds: vi.fn(),
  followFind: vi.fn(),
  reviewAggregate: vi.fn(),
  statusDistinct: vi.fn(),
  statusFind: vi.fn(),
  logAggregate: vi.fn(),
  visibleOwnerIds: vi.fn(),
}));

vi.mock('../models/activity.model.js', () => ({
  default: {
    db: { collection: mocks.activityCollection },
  },
}));
vi.mock('../models/activityReaction.model.js', () => ({
  default: {},
}));
vi.mock('../models/follow.model.js', () => ({
  default: { find: mocks.followFind },
}));
vi.mock('../models/mediaReview.model.js', () => ({
  default: { aggregate: mocks.reviewAggregate },
}));
vi.mock('../models/userMediaStatus.model.js', () => ({
  default: {
    distinct: mocks.statusDistinct,
    find: mocks.statusFind,
  },
}));
vi.mock('../models/log.model.js', () => ({
  default: {
    aggregate: mocks.logAggregate,
  },
}));
vi.mock('../services/socialVisibility.service.js', () => ({
  buildVisibleActivityFilter: vi.fn(),
  getFollowedUserIds: mocks.followedIds,
  getVisibleSocialOwnerIds: mocks.visibleOwnerIds,
}));

interface StatusRow {
  user: Types.ObjectId;
  status: string;
  completed: boolean;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

function statusQuery(rows: StatusRow[]) {
  return {
    select: () => ({ lean: () => Promise.resolve(rows) }),
  };
}

function configureStatusRows(rows: StatusRow[]) {
  mocks.statusDistinct.mockResolvedValue(rows.map((row) => row.user));
  mocks.statusFind.mockImplementation(
    (filter: { user?: { $in: Types.ObjectId[] } }) => {
      const allowedOwnerIds = filter.user?.$in ?? [];
      return statusQuery(
        rows.filter((row) =>
          allowedOwnerIds.some((ownerId) => ownerId.equals(row.user))
        )
      );
    }
  );
}

function configureUsers(users: Array<{ _id: Types.ObjectId; username: string }>) {
  mocks.activityCollection.mockReturnValue({
    find: () => ({ toArray: () => Promise.resolve(users) }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.followedIds.mockResolvedValue([]);
  mocks.followFind.mockReturnValue({ distinct: () => Promise.resolve([]) });
  mocks.reviewAggregate.mockResolvedValue([]);
  mocks.logAggregate.mockResolvedValue([]);
  configureUsers([]);
});

describe('media community privacy', () => {
  it('excludes non-consenting owners from community statistics', async () => {
    const viewerId = new Types.ObjectId();
    const visibleOwnerIds = [
      new Types.ObjectId(),
      new Types.ObjectId(),
      new Types.ObjectId(),
      new Types.ObjectId(),
    ];
    const privateOwnerId = new Types.ObjectId();
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    const rows: StatusRow[] = [
      {
        user: visibleOwnerIds[0] as Types.ObjectId,
        status: 'completed',
        completed: true,
        completedAt: new Date('2026-01-11T00:00:00.000Z'),
        createdAt,
        updatedAt: new Date('2026-01-11T00:00:00.000Z'),
      },
      {
        user: visibleOwnerIds[1] as Types.ObjectId,
        status: 'completed',
        completed: true,
        completedAt: new Date('2026-01-21T00:00:00.000Z'),
        createdAt,
        updatedAt: new Date('2026-01-21T00:00:00.000Z'),
      },
      {
        user: visibleOwnerIds[2] as Types.ObjectId,
        status: 'completed',
        completed: true,
        completedAt: new Date('2026-01-31T00:00:00.000Z'),
        createdAt,
        updatedAt: new Date('2026-01-31T00:00:00.000Z'),
      },
      {
        user: visibleOwnerIds[3] as Types.ObjectId,
        status: 'in_progress',
        completed: false,
        completedAt: null,
        createdAt,
        updatedAt: new Date('2026-01-12T00:00:00.000Z'),
      },
      {
        user: privateOwnerId,
        status: 'dropped',
        completed: false,
        completedAt: null,
        createdAt,
        updatedAt: new Date('2026-01-12T00:00:00.000Z'),
      },
    ];
    configureStatusRows(rows);
    mocks.visibleOwnerIds.mockImplementation(
      (input: { category: string }) =>
        Promise.resolve(input.category === 'statistics' ? visibleOwnerIds : [])
    );

    const result = await getMediaCommunity({
      mediaId: 'media-1',
      mediaType: 'anime',
      viewerId,
    });

    expect(result.stats).toMatchObject({
      trackingUsers: 4,
      completedUsers: 3,
      inProgressUsers: 1,
      completionRate: 75,
      completionDaysAverage: 20,
      completionDaysMedian: 20,
      completionTimeSampleSize: 3,
    });
    expect(mocks.statusFind).toHaveBeenCalledWith({
      mediaId: 'media-1',
      type: 'anime',
      hiddenFromList: { $ne: true },
      user: { $in: visibleOwnerIds },
    });
    expect(mocks.visibleOwnerIds).toHaveBeenCalledWith({
      ownerIds: [...visibleOwnerIds, privateOwnerId],
      viewerId,
      category: 'statistics',
    });
  });

  it('does not list a mutual friend whose immersion activity is private', async () => {
    const viewerId = new Types.ObjectId();
    const visibleFriendId = new Types.ObjectId();
    const privateFriendId = new Types.ObjectId();
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    const rows: StatusRow[] = [
      {
        user: visibleFriendId,
        status: 'in_progress',
        completed: false,
        completedAt: null,
        createdAt,
        updatedAt: new Date('2026-01-10T00:00:00.000Z'),
      },
      {
        user: privateFriendId,
        status: 'completed',
        completed: true,
        completedAt: new Date('2026-01-09T00:00:00.000Z'),
        createdAt,
        updatedAt: new Date('2026-01-09T00:00:00.000Z'),
      },
    ];
    configureStatusRows(rows);
    mocks.followedIds.mockResolvedValue([visibleFriendId, privateFriendId]);
    mocks.followFind.mockReturnValue({
      distinct: () => Promise.resolve([visibleFriendId, privateFriendId]),
    });
    mocks.visibleOwnerIds.mockImplementation(
      (input: { category: string }) =>
        Promise.resolve(
          input.category === 'immersionActivity' ? [visibleFriendId] : []
        )
    );
    configureUsers([
      { _id: visibleFriendId, username: 'visible-friend' },
      { _id: privateFriendId, username: 'private-friend' },
    ]);

    const result = await getMediaCommunity({
      mediaId: 'media-1',
      mediaType: 'anime',
      viewerId,
    });

    expect(result.friends.consuming).toHaveLength(1);
    expect(result.friends.consuming[0]?.user?.username).toBe('visible-friend');
    expect(result.friends.completed).toEqual([]);
    expect(mocks.visibleOwnerIds).toHaveBeenCalledWith({
      ownerIds: [visibleFriendId, privateFriendId],
      viewerId,
      category: 'immersionActivity',
    });
  });

  it('withholds average and median below three completion samples', async () => {
    const viewerId = new Types.ObjectId();
    const ownerIds = [new Types.ObjectId(), new Types.ObjectId()];
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    configureStatusRows(
      ownerIds.map((ownerId, index) => ({
        user: ownerId,
        status: 'completed',
        completed: true,
        completedAt: new Date(`2026-01-${11 + index * 10}T00:00:00.000Z`),
        createdAt,
        updatedAt: new Date('2026-02-01T00:00:00.000Z'),
      }))
    );
    mocks.visibleOwnerIds.mockImplementation(
      (input: { category: string }) =>
        Promise.resolve(input.category === 'statistics' ? ownerIds : [])
    );

    const result = await getMediaCommunity({
      mediaId: 'media-1',
      mediaType: 'anime',
      viewerId,
    });

    expect(result.stats).toMatchObject({
      completionRate: 100,
      completionDaysAverage: null,
      completionDaysMedian: null,
      completionTimeSampleSize: 2,
    });
  });

  it('returns cumulative progress for the selected following relation', async () => {
    const viewerId = new Types.ObjectId();
    const followingId = new Types.ObjectId();
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    configureStatusRows([
      {
        user: followingId,
        status: 'in_progress',
        completed: false,
        completedAt: null,
        createdAt,
        updatedAt: new Date('2026-02-01T00:00:00.000Z'),
      },
    ]);
    mocks.followedIds.mockResolvedValue([followingId]);
    mocks.visibleOwnerIds.mockResolvedValue([followingId]);
    mocks.logAggregate.mockResolvedValue([
      {
        _id: followingId,
        chars: 12500,
        episodes: 0,
        pages: 0,
        time: 90,
        volume: 3,
      },
    ]);
    configureUsers([{ _id: followingId, username: 'following-reader' }]);

    const result = await getMediaCommunity({
      mediaId: 'media-1',
      mediaType: 'light-novel',
      viewerId,
      relation: 'following',
    });

    expect(result.people).toEqual([
      expect.objectContaining({
        relation: 'following',
        status: 'in_progress',
        user: expect.objectContaining({ username: 'following-reader' }),
        progress: {
          chars: 12500,
          episodes: 0,
          pages: 0,
          time: 90,
          volume: 3,
        },
      }),
    ]);
    expect(mocks.logAggregate).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          $match: expect.objectContaining({
            mediaId: 'media-1',
            type: 'light-novel',
            private: { $ne: true },
          }),
        }),
      ])
    );
  });
});

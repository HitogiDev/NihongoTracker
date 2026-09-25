import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';
import {
  buildVisibleActivityFilter,
  buildVisibleImmersionLogFilter,
  canCommentOnUserLogs,
  canViewActivity,
  canViewUserSocialCategory,
  getSocialVisibility,
  getRankingAudienceUserIds,
  getVisibleSocialOwnerIds,
} from '../services/socialVisibility.service.js';

const mocks = vi.hoisted(() => ({
  exists: vi.fn(),
  find: vi.fn(),
}));

const userFind = vi.hoisted(() => vi.fn());
const userFindById = vi.hoisted(() => vi.fn());

vi.mock('../models/follow.model.js', () => ({
  default: mocks,
}));

vi.mock('../models/user.model.js', () => ({
  default: { find: userFind, findById: userFindById },
}));

beforeEach(() => {
  vi.clearAllMocks();
  userFind.mockReset();
  userFindById.mockReset();
});

describe('social visibility', () => {
  it('uses safe category defaults for existing accounts', () => {
    expect(getSocialVisibility(undefined, 'profile')).toBe('public');
    expect(getSocialVisibility(undefined, 'immersionActivity')).toBe('public');
    expect(getSocialVisibility(undefined, 'statistics')).toBe('public');
  });

  it('always lets an owner view their own resources', async () => {
    const ownerId = new Types.ObjectId();
    await expect(
      canViewUserSocialCategory({
        ownerId,
        viewerId: ownerId,
        settings: {
          blurAdultContent: false,
          socialPrivacy: {
          profile: 'private',
          immersionActivity: 'private',
          statistics: 'private',
          },
        },
        category: 'profile',
      })
    ).resolves.toBe(true);
  });

  it('requires the viewer to follow for follower-only resources', async () => {
    mocks.exists.mockResolvedValueOnce(null).mockResolvedValueOnce({ _id: 1 });
    const options = {
      ownerId: new Types.ObjectId(),
      viewerId: new Types.ObjectId(),
      settings: {
        blurAdultContent: false,
        socialPrivacy: {
          profile: 'followers' as const,
          immersionActivity: 'public' as const,
          statistics: 'public' as const,
        },
      },
      category: 'profile' as const,
    };

    await expect(canViewUserSocialCategory(options)).resolves.toBe(false);
    await expect(canViewUserSocialCategory(options)).resolves.toBe(true);
    expect(mocks.exists).toHaveBeenCalledWith({
      follower: options.viewerId,
      following: options.ownerId,
    });
  });

  it.each(['profile', 'immersionActivity', 'statistics'] as const)(
    'requires the owner to follow the viewer for following-only %s',
    async (category) => {
      mocks.exists
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ _id: 1 });
      const options = {
        ownerId: new Types.ObjectId(),
        viewerId: new Types.ObjectId(),
        settings: {
          blurAdultContent: false,
          socialPrivacy: {
            profile: 'following' as const,
            immersionActivity: 'following' as const,
            statistics: 'following' as const,
          },
        },
        category,
      };

      await expect(canViewUserSocialCategory(options)).resolves.toBe(false);
      await expect(canViewUserSocialCategory(options)).resolves.toBe(true);
      expect(mocks.exists).toHaveBeenCalledWith({
        follower: options.ownerId,
        following: options.viewerId,
      });
    }
  );

  it('does not expose follower-only resources to signed-out viewers', async () => {
    await expect(
      canViewUserSocialCategory({
        ownerId: new Types.ObjectId(),
        settings: {
          blurAdultContent: false,
          socialPrivacy: {
            profile: 'followers',
            immersionActivity: 'followers',
            statistics: 'followers',
          },
        },
        category: 'statistics',
      })
    ).resolves.toBe(false);
    expect(mocks.exists).not.toHaveBeenCalled();
  });

  it('builds a club-log filter that excludes private and non-followed logs', async () => {
    const publicOwner = new Types.ObjectId();
    const followerOnlyOwner = new Types.ObjectId();
    const viewerId = new Types.ObjectId();
    const owners = [
      {
        _id: publicOwner,
        settings: {
          socialPrivacy: { immersionActivity: 'public' },
        },
      },
      {
        _id: followerOnlyOwner,
        settings: {
          socialPrivacy: { immersionActivity: 'followers' },
        },
      },
    ];
    userFind.mockReturnValue({
      select: () => ({ lean: () => Promise.resolve(owners) }),
    });
    mocks.find.mockReturnValue({
      distinct: () => Promise.resolve([]),
    });

    const filter = await buildVisibleImmersionLogFilter(
      [publicOwner, followerOnlyOwner],
      viewerId
    );

    expect(filter).toMatchObject({
      user: { $in: [publicOwner] },
      $or: [{ user: viewerId }, { private: { $ne: true } }],
    });
  });

  it('applies the same visibility rules to community statistic owners', async () => {
    const publicOwner = new Types.ObjectId();
    const followedOwner = new Types.ObjectId();
    const followingOwner = new Types.ObjectId();
    const privateOwner = new Types.ObjectId();
    const viewerId = new Types.ObjectId();
    userFind.mockReturnValue({
      select: () => ({
        lean: () =>
          Promise.resolve([
            {
              _id: publicOwner,
              settings: { socialPrivacy: { statistics: 'public' } },
            },
            {
              _id: followedOwner,
              settings: { socialPrivacy: { statistics: 'followers' } },
            },
            {
              _id: followingOwner,
              settings: { socialPrivacy: { statistics: 'following' } },
            },
            {
              _id: privateOwner,
              settings: { socialPrivacy: { statistics: 'private' } },
            },
          ]),
      }),
    });
    mocks.find.mockImplementation((filter: Record<string, unknown>) => ({
      distinct: () =>
        Promise.resolve(
          'follower' in filter ? [followedOwner] : [followingOwner]
        ),
    }));

    await expect(
      getVisibleSocialOwnerIds({
        ownerIds: [publicOwner, followedOwner, followingOwner, privateOwner],
        viewerId,
        category: 'statistics',
      })
    ).resolves.toEqual([publicOwner, followedOwner, followingOwner]);
  });

  it('returns only visible followed users and can narrow them to mutuals', async () => {
    const publicOwner = new Types.ObjectId();
    const followerOnlyOwner = new Types.ObjectId();
    const followingOnlyOwner = new Types.ObjectId();
    const privateOwner = new Types.ObjectId();
    const viewerId = new Types.ObjectId();
    const followedIds = [
      publicOwner,
      followerOnlyOwner,
      followingOnlyOwner,
      privateOwner,
    ];
    const followerIds = [followingOnlyOwner, privateOwner];
    const owners = [
      {
        _id: viewerId,
        settings: { socialPrivacy: { statistics: 'private' } },
      },
      {
        _id: publicOwner,
        settings: { socialPrivacy: { statistics: 'public' } },
      },
      {
        _id: followerOnlyOwner,
        settings: { socialPrivacy: { statistics: 'followers' } },
      },
      {
        _id: followingOnlyOwner,
        settings: { socialPrivacy: { statistics: 'following' } },
      },
      {
        _id: privateOwner,
        settings: { socialPrivacy: { statistics: 'private' } },
      },
    ];
    userFind.mockImplementation((filter: { _id: { $in: Types.ObjectId[] } }) => ({
      select: () => ({
        lean: () =>
          Promise.resolve(
            owners.filter((owner) => filter._id.$in.includes(owner._id))
          ),
      }),
    }));
    mocks.find.mockImplementation((filter: Record<string, unknown>) => ({
      distinct: () =>
        Promise.resolve('follower' in filter ? followedIds : followerIds),
    }));

    await expect(
      getRankingAudienceUserIds(viewerId, 'following')
    ).resolves.toEqual([
      viewerId,
      publicOwner,
      followerOnlyOwner,
      followingOnlyOwner,
    ]);
    await expect(
      getRankingAudienceUserIds(viewerId, 'mutual')
    ).resolves.toEqual([viewerId, followingOnlyOwner]);
  });

  it('builds activity visibility clauses for both follow directions', () => {
    const viewerId = new Types.ObjectId();
    const followedOwner = new Types.ObjectId();
    const followingOwner = new Types.ObjectId();

    expect(
      buildVisibleActivityFilter(viewerId, [followedOwner], [followingOwner])
    ).toEqual({
      $or: [
        { actor: viewerId },
        { visibility: 'public' },
        {
          actor: { $in: [followedOwner] },
          visibility: 'followers',
        },
        {
          actor: { $in: [followingOwner] },
          visibility: 'following',
        },
      ],
    });
  });

  it('allows following-only activity when its owner follows the viewer', async () => {
    const ownerId = new Types.ObjectId();
    const viewerId = new Types.ObjectId();
    mocks.exists.mockResolvedValue({ _id: new Types.ObjectId() });

    await expect(
      canViewActivity(
        { actor: ownerId, visibility: 'following' },
        viewerId
      )
    ).resolves.toBe(true);
    expect(mocks.exists).toHaveBeenCalledWith({
      follower: ownerId,
      following: viewerId,
    });
  });

  it('allows owners to choose who can comment on their logs', async () => {
    const ownerId = new Types.ObjectId();
    const viewerId = new Types.ObjectId();
    const ownerQuery = (commenting: string) => ({
      select: () => ({
        lean: () => Promise.resolve({ settings: { socialPrivacy: { commenting } } }),
      }),
    });

    userFindById.mockReturnValue(ownerQuery('nobody'));
    await expect(canCommentOnUserLogs(ownerId, viewerId)).resolves.toBe(false);

    userFindById.mockReturnValue(ownerQuery('everyone'));
    await expect(canCommentOnUserLogs(ownerId, viewerId)).resolves.toBe(true);

    userFindById.mockReturnValue(ownerQuery('followers'));
    mocks.exists.mockResolvedValueOnce(null).mockResolvedValueOnce({ _id: 1 });
    await expect(canCommentOnUserLogs(ownerId, viewerId)).resolves.toBe(false);
    await expect(canCommentOnUserLogs(ownerId, viewerId)).resolves.toBe(true);
    expect(mocks.exists).toHaveBeenLastCalledWith({
      follower: viewerId,
      following: ownerId,
    });

    userFindById.mockReturnValue(ownerQuery('following'));
    mocks.exists.mockResolvedValue({ _id: 1 });
    await expect(canCommentOnUserLogs(ownerId, viewerId)).resolves.toBe(true);
    expect(mocks.exists).toHaveBeenLastCalledWith({
      follower: ownerId,
      following: viewerId,
    });
  });

});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';
import {
  buildVisibleImmersionLogFilter,
  canViewUserSocialCategory,
  getSocialVisibility,
  getVisibleSocialOwnerIds,
} from '../services/socialVisibility.service.js';

const mocks = vi.hoisted(() => ({
  exists: vi.fn(),
  find: vi.fn(),
}));

const userFind = vi.hoisted(() => vi.fn());

vi.mock('../models/follow.model.js', () => ({
  default: mocks,
}));

vi.mock('../models/user.model.js', () => ({
  default: { find: userFind },
}));

beforeEach(() => {
  vi.clearAllMocks();
  userFind.mockReset();
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
              _id: privateOwner,
              settings: { socialPrivacy: { statistics: 'private' } },
            },
          ]),
      }),
    });
    mocks.find.mockReturnValue({
      distinct: () => Promise.resolve([followedOwner]),
    });

    await expect(
      getVisibleSocialOwnerIds({
        ownerIds: [publicOwner, followedOwner, privateOwner],
        viewerId,
        category: 'statistics',
      })
    ).resolves.toEqual([publicOwner, followedOwner]);
  });

});

import { Types } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { requireGoalVisibility } from '../services/goalVisibility.js';
import { IUser, userRoles } from '../types.js';

const exists = vi.hoisted(() => vi.fn());
vi.mock('../models/follow.model.js', () => ({ default: { exists } }));
const owner = {
  _id: new Types.ObjectId(),
  settings: { socialPrivacy: { profile: 'public', statistics: 'public' } },
} as Pick<IUser, '_id' | 'settings'>;
beforeEach(() => exists.mockResolvedValue(false));
describe('goals privacy', () => {
  it('allows anonymous access to public goals', async () => {
    await expect(requireGoalVisibility(owner)).resolves.toBeUndefined();
  });
  it.each(['profile', 'statistics'] as const)(
    'enforces %s privacy',
    async (category) => {
      const privateOwner = {
        ...owner,
        settings: {
          socialPrivacy: {
            ...owner.settings?.socialPrivacy,
            [category]: 'private',
          },
        },
      } as typeof owner;
      await expect(requireGoalVisibility(privateOwner)).rejects.toMatchObject({
        statusCode: 403,
      });
      await expect(
        requireGoalVisibility(privateOwner, { _id: owner._id } as IUser)
      ).resolves.toBeUndefined();
      await expect(
        requireGoalVisibility(privateOwner, {
          _id: new Types.ObjectId(),
          roles: [userRoles.admin],
        } as IUser)
      ).resolves.toBeUndefined();
    }
  );
  it('requires the configured follower relationship', async () => {
    const viewer = { _id: new Types.ObjectId() } as IUser;
    const restricted = {
      ...owner,
      settings: {
        socialPrivacy: { profile: 'public', statistics: 'followers' },
      },
    } as typeof owner;
    await expect(
      requireGoalVisibility(restricted, viewer)
    ).rejects.toMatchObject({ statusCode: 403 });
    exists.mockResolvedValue(true);
    await expect(
      requireGoalVisibility(restricted, viewer)
    ).resolves.toBeUndefined();
    expect(exists).toHaveBeenLastCalledWith({
      follower: viewer._id,
      following: owner._id,
    });
  });
});

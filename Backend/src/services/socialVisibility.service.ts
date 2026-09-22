import { FilterQuery, Types } from 'mongoose';
import Follow from '../models/follow.model.js';
import User from '../models/user.model.js';
import {
  IActivity,
  ILog,
  IUserSettings,
  SocialVisibility,
} from '../types.js';

export type SocialPrivacyCategory =
  | 'profile'
  | 'immersionActivity'
  | 'statistics';

const DEFAULT_SOCIAL_PRIVACY: Record<
  SocialPrivacyCategory,
  SocialVisibility
> = {
  profile: 'public',
  immersionActivity: 'public',
  statistics: 'public',
};

export function getSocialVisibility(
  settings: IUserSettings | undefined,
  category: SocialPrivacyCategory
): SocialVisibility {
  return settings?.socialPrivacy?.[category] ?? DEFAULT_SOCIAL_PRIVACY[category];
}

export function isVisibilityAllowed(
  actorId: Types.ObjectId,
  visibility: SocialVisibility,
  viewerId: Types.ObjectId | undefined,
  isFollowing: boolean
): boolean {
  if (viewerId?.equals(actorId) || visibility === 'public') return true;
  if (visibility === 'private' || !viewerId) return false;
  return isFollowing;
}

export async function canViewUserSocialCategory(options: {
  ownerId: Types.ObjectId;
  viewerId?: Types.ObjectId;
  settings?: IUserSettings;
  category: SocialPrivacyCategory;
  bypass?: boolean;
}): Promise<boolean> {
  const { ownerId, viewerId, settings, category, bypass = false } = options;
  if (bypass || viewerId?.equals(ownerId)) return true;

  const visibility = getSocialVisibility(settings, category);
  if (visibility === 'public') return true;
  if (visibility === 'private' || !viewerId) return false;

  return Boolean(await Follow.exists({ follower: viewerId, following: ownerId }));
}

export async function getFollowedUserIds(
  viewerId: Types.ObjectId
): Promise<Types.ObjectId[]> {
  return Follow.find({ follower: viewerId }).distinct('following');
}

export async function getVisibleSocialOwnerIds(options: {
  ownerIds: Types.ObjectId[];
  viewerId?: Types.ObjectId;
  category: SocialPrivacyCategory;
}): Promise<Types.ObjectId[]> {
  const { ownerIds, viewerId, category } = options;
  if (ownerIds.length === 0) return [];

  const [followedUserIds, owners] = await Promise.all([
    viewerId ? getFollowedUserIds(viewerId) : Promise.resolve([]),
    User.find({ _id: { $in: ownerIds } })
      .select('_id settings.socialPrivacy')
      .lean(),
  ]);
  const followedSet = new Set(followedUserIds.map((id) => id.toString()));

  return owners
    .filter((owner) =>
      isVisibilityAllowed(
        owner._id,
        getSocialVisibility(owner.settings, category),
        viewerId,
        followedSet.has(owner._id.toString())
      )
    )
    .map((owner) => owner._id);
}

export function buildVisibleActivityFilter(
  viewerId: Types.ObjectId,
  followedUserIds: Types.ObjectId[]
): FilterQuery<IActivity> {
  const visibilityClauses: FilterQuery<IActivity>[] = [{ actor: viewerId }];
  if (isVisibilityAllowed(viewerId, 'public', viewerId, false)) {
    visibilityClauses.push({ visibility: 'public' });
  }
  if (
    followedUserIds.some((actorId) =>
      isVisibilityAllowed(actorId, 'followers', viewerId, true)
    )
  ) {
    visibilityClauses.push({
      actor: { $in: followedUserIds },
      visibility: 'followers',
    });
  }
  return {
    $or: visibilityClauses,
  };
}

/**
 * Builds the equivalent visibility filter for legacy Log documents, whose
 * visibility is derived from the owner's current social privacy settings.
 * Private source logs remain visible only to their owner.
 */
export async function buildVisibleImmersionLogFilter(
  ownerIds: Types.ObjectId[],
  viewerId?: Types.ObjectId,
  category: Extract<SocialPrivacyCategory, 'immersionActivity' | 'statistics'> =
    'immersionActivity'
): Promise<FilterQuery<ILog>> {
  const visibleOwnerIds = await getVisibleSocialOwnerIds({
    ownerIds,
    viewerId,
    category,
  });

  return {
    user: { $in: visibleOwnerIds },
    ...(viewerId
      ? { $or: [{ user: viewerId }, { private: { $ne: true } }] }
      : { private: { $ne: true } }),
  };
}

export async function canViewActivity(
  activity: Pick<IActivity, 'actor' | 'visibility'>,
  viewerId: Types.ObjectId
): Promise<boolean> {
  const isFollowing =
    activity.visibility === 'followers' &&
    Boolean(
      await Follow.exists({ follower: viewerId, following: activity.actor })
    );
  return isVisibilityAllowed(
    activity.actor,
    activity.visibility,
    viewerId,
    isFollowing
  );
}

import { FilterQuery, Types } from 'mongoose';
import Follow from '../models/follow.model.js';
import User from '../models/user.model.js';
import {
  IActivity,
  ILog,
  ISocialPrivacySettings,
  IUserSettings,
  SocialVisibility,
} from '../types.js';

export type SocialPrivacyCategory =
  | 'profile'
  | 'immersionActivity'
  | 'statistics';

export type RankingAudience = 'all' | 'following' | 'mutual';

const DEFAULT_SOCIAL_PRIVACY: ISocialPrivacySettings = {
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
  viewerFollowsOwner: boolean,
  ownerFollowsViewer: boolean
): boolean {
  if (viewerId?.equals(actorId) || visibility === 'public') return true;
  if (visibility === 'private' || !viewerId) return false;
  return visibility === 'followers' ? viewerFollowsOwner : ownerFollowsViewer;
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

  if (visibility === 'following') {
    return Boolean(
      await Follow.exists({ follower: ownerId, following: viewerId })
    );
  }

  return Boolean(await Follow.exists({ follower: viewerId, following: ownerId }));
}

export async function getFollowedUserIds(
  viewerId: Types.ObjectId
): Promise<Types.ObjectId[]> {
  return Follow.find({ follower: viewerId }).distinct('following');
}

export async function getFollowerUserIds(
  viewerId: Types.ObjectId
): Promise<Types.ObjectId[]> {
  return Follow.find({ following: viewerId }).distinct('follower');
}

export async function getRankingAudienceUserIds(
  viewerId: Types.ObjectId,
  audience: Exclude<RankingAudience, 'all'>
): Promise<Types.ObjectId[]> {
  const [followedUserIds, followerUserIds] = await Promise.all([
    getFollowedUserIds(viewerId),
    getFollowerUserIds(viewerId),
  ]);
  const followerSet = new Set(followerUserIds.map((id) => id.toString()));
  const relationshipIds =
    audience === 'mutual'
      ? followedUserIds.filter((id) => followerSet.has(id.toString()))
      : followedUserIds;
  const candidateIds = [viewerId, ...relationshipIds];

  const owners = await User.find({ _id: { $in: candidateIds } })
    .select('_id settings.socialPrivacy')
    .lean();
  const followedSet = new Set(followedUserIds.map((id) => id.toString()));

  return owners
    .filter((owner) =>
      isVisibilityAllowed(
        owner._id,
        getSocialVisibility(owner.settings, 'statistics'),
        viewerId,
        followedSet.has(owner._id.toString()),
        followerSet.has(owner._id.toString())
      )
    )
    .map((owner) => owner._id);
}

export async function getVisibleSocialOwnerIds(options: {
  ownerIds: Types.ObjectId[];
  viewerId?: Types.ObjectId;
  category: Exclude<SocialPrivacyCategory, 'profile'>;
}): Promise<Types.ObjectId[]> {
  const { ownerIds, viewerId, category } = options;
  if (ownerIds.length === 0) return [];

  const [followedUserIds, followerUserIds, owners] = await Promise.all([
    viewerId ? getFollowedUserIds(viewerId) : Promise.resolve([]),
    viewerId ? getFollowerUserIds(viewerId) : Promise.resolve([]),
    User.find({ _id: { $in: ownerIds } })
      .select('_id settings.socialPrivacy')
      .lean(),
  ]);
  const followedSet = new Set(followedUserIds.map((id) => id.toString()));
  const followerSet = new Set(followerUserIds.map((id) => id.toString()));

  return owners
    .filter((owner) =>
      isVisibilityAllowed(
        owner._id,
        getSocialVisibility(owner.settings, category),
        viewerId,
        followedSet.has(owner._id.toString()),
        followerSet.has(owner._id.toString())
      )
    )
    .map((owner) => owner._id);
}

export function buildVisibleActivityFilter(
  viewerId: Types.ObjectId,
  followedUserIds: Types.ObjectId[],
  followerUserIds: Types.ObjectId[]
): FilterQuery<IActivity> {
  const visibilityClauses: FilterQuery<IActivity>[] = [
    { actor: viewerId },
    { visibility: 'public' },
  ];
  if (followedUserIds.length > 0) {
    visibilityClauses.push({
      actor: { $in: followedUserIds },
      visibility: 'followers',
    });
  }
  if (followerUserIds.length > 0) {
    visibilityClauses.push({
      actor: { $in: followerUserIds },
      visibility: 'following',
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
  const isFollowedBy =
    activity.visibility === 'following' &&
    Boolean(
      await Follow.exists({ follower: activity.actor, following: viewerId })
    );
  return isVisibilityAllowed(
    activity.actor,
    activity.visibility,
    viewerId,
    isFollowing,
    isFollowedBy
  );
}

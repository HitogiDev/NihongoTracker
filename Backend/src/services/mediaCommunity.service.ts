import { Types } from 'mongoose';
import Activity from '../models/activity.model.js';
import ActivityReaction from '../models/activityReaction.model.js';
import MediaReview from '../models/mediaReview.model.js';
import UserMediaStatus from '../models/userMediaStatus.model.js';
import Log from '../models/log.model.js';
import { ActivityReactionType, ActivityType, SocialVisibility } from '../types.js';
import {
  buildVisibleActivityFilter,
  getFollowerUserIds,
  getFollowedUserIds,
  getVisibleSocialOwnerIds,
} from './socialVisibility.service.js';
import Follow from '../models/follow.model.js';
import { enrichActivityMedia } from './activity.service.js';

interface MediaStatusRow {
  user: Types.ObjectId;
  status?: string | null;
  completed: boolean;
  completedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface CommunityUser {
  _id: Types.ObjectId;
  username: string;
  avatar?: string;
}

interface CommunityActivityRow {
  _id: Types.ObjectId;
  actor: CommunityUser;
  type: ActivityType;
  targetType: string;
  targetId: Types.ObjectId;
  metadata?: Record<string, unknown>;
  visibility: SocialVisibility;
  importance: 'normal' | 'important';
  reactionCounts: Partial<Record<ActivityReactionType, number>>;
  commentCount: number;
  occurredAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type MediaCommunityRelation = 'followers' | 'friends' | 'following';

interface MediaProgressLogRow {
  _id: Types.ObjectId;
  chars?: number;
  episodes?: number;
  pages?: number;
  time?: number;
  volume?: number;
}

function median(values: number[]): number | null {
  if (values.length < 3) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  const value =
    sorted.length % 2 === 0
      ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
      : (sorted[middle] ?? 0);
  return Math.round(value * 10) / 10;
}

function average(values: number[]): number | null {
  if (values.length < 3) return null;
  const value = values.reduce((sum, current) => sum + current, 0) / values.length;
  return Math.round(value * 10) / 10;
}

async function getMediaCommunityPeople(input: {
  mediaId: string;
  mediaType: string;
  viewerId?: Types.ObjectId;
  relation?: MediaCommunityRelation;
}) {
  if (!input.viewerId || !input.relation) return [];

  const followedIds = await getFollowedUserIds(input.viewerId);
  let relationUserIds: Types.ObjectId[];
  if (input.relation === 'following') {
    relationUserIds = followedIds;
  } else if (input.relation === 'followers') {
    relationUserIds = (await Follow.find({ following: input.viewerId }).distinct(
      'follower'
    )) as Types.ObjectId[];
  } else {
    relationUserIds = (await Follow.find({
      follower: { $in: followedIds },
      following: input.viewerId,
    }).distinct('follower')) as Types.ObjectId[];
  }

  if (relationUserIds.length === 0) return [];

  const statusFilter = {
    mediaId: input.mediaId,
    type: input.mediaType,
    hiddenFromList: { $ne: true },
    user: { $in: relationUserIds },
  };
  const ownerIds = (await UserMediaStatus.distinct(
    'user',
    statusFilter
  )) as Types.ObjectId[];
  const visibleOwnerIds = await getVisibleSocialOwnerIds({
    ownerIds,
    viewerId: input.viewerId,
    category: 'statistics',
  });

  if (visibleOwnerIds.length === 0) return [];

  const [statuses, logs] = await Promise.all([
    UserMediaStatus.find({
      ...statusFilter,
      user: { $in: visibleOwnerIds },
    })
      .select('user status completed completedAt updatedAt')
      .lean() as unknown as Promise<MediaStatusRow[]>,
    Log.aggregate<MediaProgressLogRow>([
      {
        $match: {
          user: { $in: visibleOwnerIds },
          mediaId: input.mediaId,
          type: input.mediaType,
          private: { $ne: true },
        },
      },
      {
        $group: {
          _id: '$user',
          chars: { $sum: { $ifNull: ['$chars', 0] } },
          episodes: { $sum: { $ifNull: ['$episodes', 0] } },
          pages: { $sum: { $ifNull: ['$pages', 0] } },
          time: { $sum: { $ifNull: ['$time', 0] } },
          volume: { $max: '$volume' },
        },
      },
    ]),
  ]);

  const users = await Activity.db
    .collection<CommunityUser>('users')
    .find(
      { _id: { $in: visibleOwnerIds } },
      { projection: { username: 1, avatar: 1 } }
    )
    .toArray();
  const userById = new Map(users.map((user) => [user._id.toString(), user]));
  const statusByUser = new Map(
    statuses.map((status) => [status.user.toString(), status])
  );
  const logByUser = new Map(logs.map((log) => [log._id.toString(), log]));

  return visibleOwnerIds
    .map((ownerId) => {
      const user = userById.get(ownerId.toString());
      const status = statusByUser.get(ownerId.toString());
      if (!user || !status) return null;
      const log = logByUser.get(ownerId.toString());
      return {
        user,
        relation: input.relation,
        status: status.completed ? 'completed' : status.status,
        completedAt: status.completedAt ?? null,
        updatedAt: status.updatedAt,
        progress: {
          chars: log?.chars ?? 0,
          episodes: log?.episodes ?? 0,
          pages: log?.pages ?? 0,
          time: log?.time ?? 0,
          volume:
            typeof log?.volume === 'number' ? Math.floor(log.volume) : null,
        },
      };
    })
    .filter((person): person is NonNullable<typeof person> => person !== null);
}

export async function getMediaCommunity(input: {
  mediaId: string;
  mediaType: string;
  viewerId?: Types.ObjectId;
  relation?: MediaCommunityRelation;
}) {
  const statusFilter = {
    mediaId: input.mediaId,
    type: input.mediaType,
    hiddenFromList: { $ne: true },
  };
  const ownerIds = (await UserMediaStatus.distinct(
    'user',
    statusFilter
  )) as Types.ObjectId[];

  const [visibleStatsOwnerIds, visibleActivityOwnerIds, followedIds, reviewStats] =
    await Promise.all([
      getVisibleSocialOwnerIds({
        ownerIds,
        viewerId: input.viewerId,
        category: 'statistics',
      }),
      getVisibleSocialOwnerIds({
        ownerIds,
        viewerId: input.viewerId,
        category: 'immersionActivity',
      }),
      input.viewerId
        ? getFollowedUserIds(input.viewerId)
        : Promise.resolve<Types.ObjectId[]>([]),
      MediaReview.aggregate<{ count: number; averageRating: number | null }>([
        { $match: { mediaContentId: input.mediaId, mediaType: input.mediaType } },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            averageRating: { $avg: '$rating' },
          },
        },
        { $project: { _id: 0, count: 1, averageRating: 1 } },
      ]),
    ]);
  const peoplePromise = getMediaCommunityPeople(input);

  const visibleActivitySet = new Set(
    visibleActivityOwnerIds.map((ownerId) => ownerId.toString())
  );
  const [visibleStatuses, mutualIds] = await Promise.all([
    visibleStatsOwnerIds.length > 0
      ? (UserMediaStatus.find({
          ...statusFilter,
          user: { $in: visibleStatsOwnerIds },
        })
          .select('user status completed completedAt createdAt updatedAt')
          .lean() as unknown as Promise<MediaStatusRow[]>)
      : Promise.resolve<MediaStatusRow[]>([]),
    input.viewerId
      ? Follow.find({
          follower: { $in: followedIds },
          following: input.viewerId,
        }).distinct('follower')
      : Promise.resolve<Types.ObjectId[]>([]),
  ]);
  const mutualSet = new Set(mutualIds.map((id) => id.toString()));
  const visibleFriendOwnerIds = ownerIds.filter(
    (ownerId) =>
      mutualSet.has(ownerId.toString()) &&
      visibleActivitySet.has(ownerId.toString())
  );
  const friendStatuses =
    visibleFriendOwnerIds.length > 0
      ? ((await UserMediaStatus.find({
          ...statusFilter,
          user: { $in: visibleFriendOwnerIds },
        })
          .select('user status completed completedAt createdAt updatedAt')
          .lean()) as unknown as MediaStatusRow[])
      : [];
  const friendUserIds = friendStatuses.map((row) => row.user);
  const friendUsers = await Activity.db
    .collection<CommunityUser>('users')
    .find(
      { _id: { $in: friendUserIds } },
      { projection: { username: 1, avatar: 1 } }
    )
    .toArray();
  const userById = new Map(
    friendUsers.map((user) => [user._id.toString(), user])
  );
  const toFriend = (row: MediaStatusRow) => ({
    user: userById.get(row.user.toString()),
    status: row.completed ? 'completed' : row.status,
    completedAt: row.completedAt ?? null,
    updatedAt: row.updatedAt,
  });

  const completionDurations = visibleStatuses
    .filter((row) => row.completed && row.completedAt)
    .map((row) =>
      Math.max(
        0,
        ((row.completedAt as Date).getTime() - row.createdAt.getTime()) /
          86_400_000
      )
    );
  const completedCount = visibleStatuses.filter(
    (row) => row.completed || row.status === 'completed'
  ).length;
  const rating = reviewStats[0]?.averageRating;

  return {
    stats: {
      trackingUsers: visibleStatuses.length,
      completedUsers: completedCount,
      inProgressUsers: visibleStatuses.filter(
        (row) => !row.completed && row.status === 'in_progress'
      ).length,
      completionRate:
        visibleStatuses.length > 0
          ? Math.round((completedCount / visibleStatuses.length) * 1000) / 10
          : null,
      completionDaysAverage: average(completionDurations),
      completionDaysMedian: median(completionDurations),
      completionTimeSampleSize: completionDurations.length,
      reviewCount: reviewStats[0]?.count ?? 0,
      averageRating:
        typeof rating === 'number' ? Math.round(rating * 10) / 10 : null,
    },
    friends: {
      consuming: friendStatuses
        .filter((row) => !row.completed && row.status === 'in_progress')
        .map(toFriend)
        .filter((item) => item.user),
      completed: friendStatuses
        .filter((row) => row.completed || row.status === 'completed')
        .map(toFriend)
        .filter((item) => item.user),
    },
    people: await peoplePromise,
  };
}

export async function getMediaCommunityActivities(input: {
  mediaId: string;
  mediaType: string;
  viewerId?: Types.ObjectId;
  limit?: number;
}) {
  const [followedIds, followerIds] = input.viewerId
    ? await Promise.all([
        getFollowedUserIds(input.viewerId),
        getFollowerUserIds(input.viewerId),
      ])
    : [[], []];
  const visibility = input.viewerId
    ? buildVisibleActivityFilter(input.viewerId, followedIds, followerIds)
    : { visibility: 'public' as const };
  const limit = Math.min(Math.max(input.limit ?? 10, 1), 20);
  const activities = (await Activity.find({
    $and: [
      visibility,
      { 'metadata.mediaId': input.mediaId },
      {
        $or: [
          { 'metadata.mediaType': input.mediaType },
          { 'metadata.logType': input.mediaType },
        ],
      },
    ],
  })
    .populate('actor', 'username avatar')
    .sort({ occurredAt: -1, _id: -1 })
    .limit(limit)
    .lean()) as unknown as CommunityActivityRow[];

  const reactions = input.viewerId
    ? await ActivityReaction.find({
        activity: { $in: activities.map((activity) => activity._id) },
        user: input.viewerId,
      })
        .select('activity type')
        .lean()
    : [];
  const reactionByActivity = new Map(
    reactions.map((reaction) => [reaction.activity.toString(), reaction.type])
  );

  const enrichedActivities = await enrichActivityMedia(activities);

  return enrichedActivities.map((activity) => ({
    ...activity,
    currentReaction: reactionByActivity.get(activity._id.toString()) ?? null,
  }));
}

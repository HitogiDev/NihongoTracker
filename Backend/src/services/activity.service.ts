import { FilterQuery, Types } from 'mongoose';
import Activity from '../models/activity.model.js';
import ActivityComment from '../models/activityComment.model.js';
import ActivityCommentLike from '../models/activityCommentLike.model.js';
import ActivityReaction from '../models/activityReaction.model.js';
import Log from '../models/log.model.js';
import { MediaBase } from '../models/media.model.js';
import { apiError } from '../i18n/errorCodes.js';
import {
  ACTIVITY_REACTIONS,
  ActivityReactionType,
  ActivityType,
  IActivity,
  SocialVisibility,
} from '../types.js';
import {
  buildVisibleActivityFilter,
  canViewActivity,
  getFollowedUserIds,
} from './socialVisibility.service.js';

const REACTION_SET = new Set<string>(ACTIVITY_REACTIONS);
export const ACTIVITY_PAGE_SIZE_MAX = 50;
export const ACTIVITY_COMMENT_MAX_LENGTH = 1000;

interface ActivityActor {
  _id: Types.ObjectId;
  username: string;
  avatar?: string;
}

interface ActivityFeedDocument {
  _id: Types.ObjectId;
  actor: ActivityActor;
  type: ActivityType;
  targetType: string;
  targetId: Types.ObjectId;
  club?: Types.ObjectId | null;
  metadata?: Record<string, unknown>;
  visibility: SocialVisibility;
  importance: 'normal' | 'important';
  reactionCounts: Partial<Record<ActivityReactionType, number>>;
  commentCount: number;
  occurredAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface ActivityMediaDocument {
  contentId: string;
  type: string;
  title?: {
    contentTitleEnglish?: string;
    contentTitleRomaji?: string;
    contentTitleNative?: string;
  };
  contentImage?: string;
  coverImage?: string;
  isAdult: boolean;
  isAdultImage?: boolean;
}

function activityMetadataString(
  metadata: Record<string, unknown> | undefined,
  key: string
): string {
  const value = metadata?.[key];
  return typeof value === 'string' ? value : '';
}

function mediaDisplayTitle(media: ActivityMediaDocument): string {
  return (
    media.title?.contentTitleEnglish ||
    media.title?.contentTitleRomaji ||
    media.title?.contentTitleNative ||
    ''
  );
}

/** Add current media presentation data to activity metadata without changing visibility. */
export async function enrichActivityMedia<
  T extends { metadata?: Record<string, unknown> },
>(activities: T[]): Promise<T[]> {
  const references = activities
    .map((activity) => {
      const mediaId = activityMetadataString(activity.metadata, 'mediaId');
      const mediaType =
        activityMetadataString(activity.metadata, 'mediaType') ||
        activityMetadataString(activity.metadata, 'logType');
      return mediaId && mediaType ? { mediaId, mediaType } : null;
    })
    .filter(
      (reference): reference is { mediaId: string; mediaType: string } =>
        reference !== null
    );

  if (references.length === 0) return activities;

  const uniqueReferences = [
    ...new Map(
      references.map((reference) => [
        `${reference.mediaType}:${reference.mediaId}`,
        reference,
      ])
    ).values(),
  ];
  const media = (await MediaBase.find({
    $or: uniqueReferences.map(({ mediaId, mediaType }) => ({
      contentId: mediaId,
      type: mediaType,
    })),
  })
    .select(
      'contentId type title contentImage coverImage isAdult isAdultImage'
    )
    .lean()) as unknown as ActivityMediaDocument[];
  const mediaByKey = new Map(
    media.map((item) => [`${item.type}:${item.contentId}`, item])
  );

  return activities.map((activity) => {
    const mediaId = activityMetadataString(activity.metadata, 'mediaId');
    const mediaType =
      activityMetadataString(activity.metadata, 'mediaType') ||
      activityMetadataString(activity.metadata, 'logType');
    const mediaItem = mediaByKey.get(`${mediaType}:${mediaId}`);
    if (!mediaItem || !activity.metadata) return activity;

    const image = mediaItem.contentImage || mediaItem.coverImage;
    const title = mediaDisplayTitle(mediaItem);
    return {
      ...activity,
      metadata: {
        ...activity.metadata,
        ...(image ? { mediaImage: image } : {}),
        isAdult: mediaItem.isAdult,
        isAdultImage: mediaItem.isAdultImage,
        ...(activityMetadataString(activity.metadata, 'mediaTitle') || !title
          ? {}
          : { mediaTitle: title }),
      },
    };
  });
}

export interface CreateActivityInput {
  actor: Types.ObjectId;
  type: ActivityType;
  targetType: string;
  targetId: Types.ObjectId;
  club?: Types.ObjectId | null;
  metadata?: Record<string, unknown>;
  visibility?: SocialVisibility;
  importance?: 'normal' | 'important';
  occurredAt?: Date;
  dedupeKey: string;
}

/** Activity recording is best-effort and must never break its source action. */
export async function createActivity(
  input: CreateActivityInput
): Promise<IActivity | null> {
  if (Activity.db.readyState !== 1) return null;
  try {
    return await Activity.findOneAndUpdate(
      { dedupeKey: input.dedupeKey },
      {
        $setOnInsert: {
          ...input,
          visibility: input.visibility ?? 'public',
          importance: input.importance ?? 'normal',
          occurredAt: input.occurredAt ?? new Date(),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to create social activity:', error);
    return null;
  }
}

export function parseActivityLimit(value: unknown): number {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0
    ? Math.min(parsed, ACTIVITY_PAGE_SIZE_MAX)
    : 20;
}

function parseBefore(
  value: unknown
): { occurredAt: Date; id?: Types.ObjectId } | undefined {
  if (typeof value !== 'string' || !value) return undefined;
  const separatorIndex = value.lastIndexOf('|');
  const dateValue = separatorIndex >= 0 ? value.slice(0, separatorIndex) : value;
  const idValue = separatorIndex >= 0 ? value.slice(separatorIndex + 1) : '';
  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) {
    throw apiError('activity.invalidCursor', 400, 'Invalid activity cursor');
  }
  if (idValue && !Types.ObjectId.isValid(idValue)) {
    throw apiError('activity.invalidCursor', 400, 'Invalid activity cursor');
  }
  return {
    occurredAt: parsed,
    ...(idValue ? { id: new Types.ObjectId(idValue) } : {}),
  };
}

export async function getActivityFeed(input: {
  viewerId: Types.ObjectId;
  clubIds: Types.ObjectId[];
  scope: 'global' | 'following' | 'clubs';
  clubId?: Types.ObjectId;
  before?: unknown;
  limit?: unknown;
}) {
  const limit = parseActivityLimit(input.limit);
  const before = parseBefore(input.before);
  const followedUserIds = await getFollowedUserIds(input.viewerId);
  const visibility = buildVisibleActivityFilter(
    input.viewerId,
    followedUserIds
  );
  const clauses: FilterQuery<IActivity>[] = [{ type: { $ne: 'club_joined' } }];

  if (input.scope === 'global') {
    clauses.push({ visibility: 'public' });
  } else if (input.scope === 'following') {
    clauses.push({
      actor: { $in: [input.viewerId, ...followedUserIds] },
    });
    clauses.push(visibility);
  } else {
    const allowedClubIds = input.clubId ? [input.clubId] : input.clubIds;
    if (
      input.clubId &&
      !input.clubIds.some((clubId) => clubId.equals(input.clubId))
    ) {
      throw apiError(
        'activity.clubMembershipRequired',
        403,
        'You must be a member to view this club feed'
      );
    }
    clauses.push({ club: { $in: allowedClubIds } });
    clauses.push(visibility);
  }

  if (before) {
    clauses.push(
      before.id
        ? {
            $or: [
              { occurredAt: { $lt: before.occurredAt } },
              { occurredAt: before.occurredAt, _id: { $lt: before.id } },
            ],
          }
        : { occurredAt: { $lt: before.occurredAt } }
    );
  }

  const activities = (await Activity.find({ $and: clauses })
    .populate('actor', 'username avatar')
    .sort({ occurredAt: -1, _id: -1 })
    .limit(limit + 1)
    .lean()) as unknown as ActivityFeedDocument[];
  const hasMore = activities.length > limit;
  const pageItems = hasMore ? activities.slice(0, limit) : activities;
  const enrichedPageItems = await enrichActivityMedia(pageItems);
  const activityIds = enrichedPageItems.map((activity) => activity._id);
  const viewerReactions = await ActivityReaction.find({
    activity: { $in: activityIds },
    user: input.viewerId,
  })
    .select('activity type')
    .lean();
  const reactionByActivity = new Map(
    viewerReactions.map((reaction) => [
      reaction.activity.toString(),
      reaction.type,
    ])
  );

  return {
    activities: enrichedPageItems.map((activity) => ({
      ...activity,
      currentReaction: reactionByActivity.get(activity._id.toString()) ?? null,
    })),
    nextCursor: hasMore
      ? `${pageItems[pageItems.length - 1]?.occurredAt.toISOString()}|${pageItems[pageItems.length - 1]?._id.toString()}`
      : null,
  };
}

async function requireVisibleActivity(
  activityId: Types.ObjectId,
  viewerId: Types.ObjectId
) {
  const activity = await Activity.findById(activityId);
  if (!activity) {
    throw apiError('activity.notFound', 404, 'Activity not found');
  }
  if (!(await canViewActivity(activity, viewerId))) {
    throw apiError('activity.notFound', 404, 'Activity not found');
  }
  return activity;
}

export function parseReaction(value: unknown): ActivityReactionType {
  if (typeof value !== 'string' || !REACTION_SET.has(value)) {
    throw apiError('activity.invalidReaction', 400, 'Invalid reaction');
  }
  return value as ActivityReactionType;
}

export async function setActivityReaction(
  activityId: Types.ObjectId,
  userId: Types.ObjectId,
  type: ActivityReactionType
) {
  const activity = await requireVisibleActivity(activityId, userId);
  const existing = await ActivityReaction.findOne({
    activity: activityId,
    user: userId,
  });

  if (existing?.type === type) {
    return { activity, reaction: existing, changed: false };
  }

  if (existing) {
    const previousType = existing.type;
    existing.type = type;
    await existing.save();
    await Activity.updateOne(
      { _id: activityId },
      {
        $inc: {
          [`reactionCounts.${previousType}`]: -1,
          [`reactionCounts.${type}`]: 1,
        },
      }
    );
    return { activity, reaction: existing, changed: true };
  }

  try {
    const reaction = await ActivityReaction.create({
      activity: activityId,
      user: userId,
      type,
    });
    await Activity.updateOne(
      { _id: activityId },
      { $inc: { [`reactionCounts.${type}`]: 1 } }
    );
    return { activity, reaction, changed: true };
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 11000
    ) {
      return setActivityReaction(activityId, userId, type);
    }
    throw error;
  }
}

export async function removeActivityReaction(
  activityId: Types.ObjectId,
  userId: Types.ObjectId
) {
  const activity = await requireVisibleActivity(activityId, userId);
  const reaction = await ActivityReaction.findOneAndDelete({
    activity: activityId,
    user: userId,
  });
  if (reaction) {
    await Activity.updateOne(
      { _id: activityId },
      { $inc: { [`reactionCounts.${reaction.type}`]: -1 } }
    );
  }
  return { activity, reaction };
}

export function parseCommentContent(value: unknown): string {
  const content = typeof value === 'string' ? value.trim() : '';
  if (!content) {
    throw apiError('activity.commentRequired', 400, 'Comment is required');
  }
  if (content.length > ACTIVITY_COMMENT_MAX_LENGTH) {
    throw apiError(
      'activity.commentTooLong',
      400,
      `Comment must be ${ACTIVITY_COMMENT_MAX_LENGTH} characters or less`
    );
  }
  return content;
}

export async function listActivityComments(
  activityId: Types.ObjectId,
  viewerId: Types.ObjectId,
  page: number,
  limit: number
) {
  await requireVisibleActivity(activityId, viewerId);
  const [comments, total] = await Promise.all([
    ActivityComment.find({ activity: activityId })
      .populate('user', 'username avatar')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    ActivityComment.countDocuments({ activity: activityId }),
  ]);
  const commentIds = comments.map((comment) => comment._id);
  const viewerLikes =
    commentIds.length > 0
      ? await ActivityCommentLike.find({
          comment: { $in: commentIds },
          user: viewerId,
        })
          .select('comment')
          .lean()
      : [];
  const likedCommentIds = new Set(
    viewerLikes.map((like) => like.comment.toString())
  );
  return {
    comments: comments.map((comment) => ({
      ...comment,
      currentUserLiked: likedCommentIds.has(comment._id.toString()),
    })),
    total,
  };
}

export async function createActivityComment(
  activityId: Types.ObjectId,
  userId: Types.ObjectId,
  content: string
) {
  const activity = await requireVisibleActivity(activityId, userId);
  const comment = await ActivityComment.create({
    activity: activityId,
    user: userId,
    content,
  });
  await Activity.updateOne(
    { _id: activityId },
    { $inc: { commentCount: 1 } }
  );
  await comment.populate('user', 'username avatar');
  return { activity, comment };
}

export async function editActivityComment(
  commentId: Types.ObjectId,
  userId: Types.ObjectId,
  content: string
) {
  const comment = await ActivityComment.findOneAndUpdate(
    { _id: commentId, user: userId },
    { $set: { content, editedAt: new Date() } },
    { new: true }
  ).populate('user', 'username avatar');
  if (!comment) {
    throw apiError(
      'activity.commentNotFoundOrForbidden',
      404,
      'Comment not found or you are not the author'
    );
  }
  return comment;
}

export async function deleteActivityComment(
  commentId: Types.ObjectId,
  userId: Types.ObjectId,
  canModerate: boolean
) {
  const comment = await ActivityComment.findById(commentId);
  if (!comment) {
    throw apiError('activity.commentNotFound', 404, 'Comment not found');
  }
  if (!comment.user.equals(userId) && !canModerate) {
    throw apiError('auth.forbidden', 403, 'Forbidden');
  }
  await comment.deleteOne();
  await Promise.all([
    ActivityCommentLike.deleteMany({ comment: comment._id }),
    Activity.updateOne(
      { _id: comment.activity },
      { $inc: { commentCount: -1 } }
    ),
  ]);
  return comment;
}

async function requireVisibleComment(
  activityId: Types.ObjectId,
  commentId: Types.ObjectId,
  viewerId: Types.ObjectId
) {
  const activity = await requireVisibleActivity(activityId, viewerId);
  const comment = await ActivityComment.findOne({
    _id: commentId,
    activity: activityId,
  });
  if (!comment) {
    throw apiError('activity.commentNotFound', 404, 'Comment not found');
  }
  return { activity, comment };
}

export async function likeActivityComment(
  activityId: Types.ObjectId,
  commentId: Types.ObjectId,
  userId: Types.ObjectId
) {
  const { activity, comment } = await requireVisibleComment(
    activityId,
    commentId,
    userId
  );
  const existing = await ActivityCommentLike.findOne({
    comment: commentId,
    user: userId,
  });
  if (existing) return { activity, comment, changed: false };

  try {
    await ActivityCommentLike.create({ comment: commentId, user: userId });
    const updatedComment = await ActivityComment.findByIdAndUpdate(
      commentId,
      { $inc: { likeCount: 1 } },
      { new: true }
    );
    return { activity, comment: updatedComment ?? comment, changed: true };
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 11000
    ) {
      return { activity, comment, changed: false };
    }
    throw error;
  }
}

export async function unlikeActivityComment(
  activityId: Types.ObjectId,
  commentId: Types.ObjectId,
  userId: Types.ObjectId
) {
  const { activity, comment } = await requireVisibleComment(
    activityId,
    commentId,
    userId
  );
  const like = await ActivityCommentLike.findOneAndDelete({
    comment: commentId,
    user: userId,
  });
  if (like) {
    const updatedComment = await ActivityComment.findByIdAndUpdate(
      commentId,
      [
        {
          $set: {
            likeCount: { $max: [0, { $subtract: ['$likeCount', 1] }] },
          },
        },
      ],
      { new: true }
    );
    return {
      activity,
      comment: updatedComment ?? comment,
      changed: true,
    };
  }
  return { activity, comment, changed: false };
}

export async function deleteActivitiesBySource(
  targetType: string,
  targetIds: Types.ObjectId[]
): Promise<void> {
  if (targetIds.length === 0) return;
  const activities = await Activity.find({
    targetType,
    targetId: { $in: targetIds },
  })
    .select('_id')
    .lean();
  const activityIds = activities.map((activity) => activity._id);
  if (activityIds.length === 0) return;
  const commentIds = await ActivityComment.find({
    activity: { $in: activityIds },
  }).distinct('_id');
  await Promise.all([
    ActivityReaction.deleteMany({ activity: { $in: activityIds } }),
    ActivityCommentLike.deleteMany({ comment: { $in: commentIds } }),
    ActivityComment.deleteMany({ activity: { $in: activityIds } }),
    Activity.deleteMany({ _id: { $in: activityIds } }),
  ]);
}

export async function deleteSocialDataForUser(
  userId: Types.ObjectId
): Promise<void> {
  const authoredActivities = await Activity.find({ actor: userId })
    .select('_id')
    .lean();
  const authoredIds = authoredActivities.map((activity) => activity._id);
  const deletedCommentIds = await ActivityComment.find({
    $or: [
      { user: userId },
      ...(authoredIds.length > 0
        ? [{ activity: { $in: authoredIds } }]
        : []),
    ],
  }).distinct('_id');
  const otherActivityFilter =
    authoredIds.length > 0 ? { activity: { $nin: authoredIds } } : {};

  const [reactionCounts, commentCounts, commentLikeCounts] = await Promise.all([
    ActivityReaction.aggregate<{
      _id: { activity: Types.ObjectId; type: ActivityReactionType };
      count: number;
    }>([
      { $match: { user: userId, ...otherActivityFilter } },
      { $group: { _id: { activity: '$activity', type: '$type' }, count: { $sum: 1 } } },
    ]),
    ActivityComment.aggregate<{ _id: Types.ObjectId; count: number }>([
      { $match: { user: userId, ...otherActivityFilter } },
      { $group: { _id: '$activity', count: { $sum: 1 } } },
    ]),
    ActivityCommentLike.aggregate<{ _id: Types.ObjectId; count: number }>([
      {
        $match: {
          user: userId,
          ...(deletedCommentIds.length > 0
            ? { comment: { $nin: deletedCommentIds } }
            : {}),
        },
      },
      { $group: { _id: '$comment', count: { $sum: 1 } } },
    ]),
  ]);

  const countUpdates = [
    ...reactionCounts.map((entry) => ({
      updateOne: {
        filter: { _id: entry._id.activity },
        update: {
          $inc: { [`reactionCounts.${entry._id.type}`]: -entry.count },
        },
      },
    })),
    ...commentCounts.map((entry) => ({
      updateOne: {
        filter: { _id: entry._id },
        update: { $inc: { commentCount: -entry.count } },
      },
    })),
  ];
  if (countUpdates.length > 0) await Activity.bulkWrite(countUpdates);
  if (commentLikeCounts.length > 0) {
    await ActivityComment.bulkWrite(
      commentLikeCounts.map((entry) => ({
        updateOne: {
          filter: { _id: entry._id },
          update: { $inc: { likeCount: -entry.count } },
        },
      }))
    );
  }

  const authoredFilter =
    authoredIds.length > 0 ? { activity: { $in: authoredIds } } : null;
  await Promise.all([
    ActivityReaction.deleteMany({
      $or: [
        { user: userId },
        ...(authoredFilter ? [authoredFilter] : []),
      ],
    }),
    ActivityComment.deleteMany({
      $or: [
        { user: userId },
        ...(authoredFilter ? [authoredFilter] : []),
      ],
    }),
    ActivityCommentLike.deleteMany({
      $or: [
        { user: userId },
        ...(deletedCommentIds.length > 0
          ? [{ comment: { $in: deletedCommentIds } }]
          : []),
      ],
    }),
    Activity.deleteMany({ actor: userId }),
  ]);
}

export async function syncImmersionActivityVisibility(
  actorId: Types.ObjectId,
  visibility: SocialVisibility
): Promise<void> {
  const privateLogIds = await Log.find({ user: actorId, private: true }).distinct(
    '_id'
  );
  const activityFilter = {
    actor: actorId,
    type: { $in: ['immersion_log', 'notable_immersion_session'] },
  };

  await Activity.updateMany(activityFilter, { $set: { visibility } });
  if (privateLogIds.length > 0) {
    await Activity.updateMany(
      { ...activityFilter, targetType: 'log', targetId: { $in: privateLogIds } },
      { $set: { visibility: 'private', 'metadata.sourcePrivate': true } }
    );
  }
}

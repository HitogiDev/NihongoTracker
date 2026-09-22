import { Types } from 'mongoose';
import {
  IAchievement,
  ILog,
  IUser,
  SocialVisibility,
} from '../types.js';
import {
  CreateActivityInput,
  createActivity,
} from './activity.service.js';

function asObjectId(value: unknown): Types.ObjectId {
  return value as Types.ObjectId;
}

export function resolveImmersionActivityVisibility(
  user: Pick<IUser, 'settings'>,
  sourcePrivate: boolean
): SocialVisibility {
  if (sourcePrivate) return 'private';
  return user.settings?.socialPrivacy?.immersionActivity ?? 'public';
}

export function isNotableImmersionLog(
  log: Pick<ILog, 'chars' | 'time' | 'episodes' | 'pages' | 'xp'>
): boolean {
  const hasMinimumActivity =
    (log.time ?? 0) >= 30 ||
    (log.episodes ?? 0) >= 2 ||
    (log.pages ?? 0) >= 25 ||
    (log.chars ?? 0) >= 3000;
  return (log.xp ?? 0) >= 250 && hasMinimumActivity;
}

export function buildLogActivityInput(
  log: ILog,
  user: Pick<IUser, 'settings'>,
  mediaTitle?: string
): CreateActivityInput | null {
  if (log.unknownDate) return null;
  const notable = isNotableImmersionLog(log);
  return {
    actor: log.user,
    type: notable ? 'notable_immersion_session' : 'immersion_log',
    targetType: 'log',
    targetId: asObjectId(log._id),
    metadata: {
      logType: log.type,
      mediaType: log.type,
      mediaId: log.mediaId,
      mediaTitle,
      time: log.time,
      chars: log.chars,
      pages: log.pages,
      episodes: log.episodes,
      xp: log.xp,
      sourcePrivate: log.private,
      description: log.description,
    },
    visibility: resolveImmersionActivityVisibility(user, log.private),
    importance: notable ? 'important' : 'normal',
    occurredAt: log.date,
    dedupeKey: `log:${String(log._id)}`,
  };
}

export async function recordLogActivity(
  log: ILog,
  user: Pick<IUser, 'settings'>,
  mediaTitle?: string
) {
  const input = buildLogActivityInput(log, user, mediaTitle);
  return input ? createActivity(input) : null;
}

export async function recordAchievementActivity(
  userId: Types.ObjectId,
  achievement: IAchievement
) {
  const important = ['epic', 'legendary'].includes(achievement.rarity);
  return createActivity({
    actor: userId,
    type: 'achievement_unlocked',
    targetType: 'achievement',
    targetId: asObjectId(achievement._id),
    metadata: {
      achievementKey: achievement.key,
      name: achievement.name,
      description: achievement.description,
      iconSlug: achievement.iconSlug,
      rarity: achievement.rarity,
    },
    importance: important ? 'important' : 'normal',
    dedupeKey: `achievement:${userId.toString()}:${String(achievement._id)}`,
  });
}

export async function recordReviewActivity(input: {
  reviewId: Types.ObjectId;
  userId: Types.ObjectId;
  mediaContentId: string;
  mediaType: string;
  summary: string;
  rating?: number;
}) {
  return createActivity({
    actor: input.userId,
    type: 'media_review',
    targetType: 'mediaReview',
    targetId: input.reviewId,
    metadata: {
      mediaId: input.mediaContentId,
      mediaType: input.mediaType,
      summary: input.summary,
      rating: input.rating,
    },
    dedupeKey: `mediaReview:${input.reviewId.toString()}`,
  });
}

export async function recordClubJoinedActivity(input: {
  userId: Types.ObjectId;
  clubId: Types.ObjectId;
  clubName: string;
  memberCount?: number;
}) {
  if (input.memberCount && [10, 25, 50, 100, 250, 500].includes(input.memberCount)) {
    return createActivity({
      actor: input.userId,
      type: 'club_milestone',
      targetType: 'club',
      targetId: input.clubId,
      club: input.clubId,
      metadata: { clubName: input.clubName, memberCount: input.memberCount },
      importance: 'important',
      dedupeKey: `clubMilestone:${input.clubId.toString()}:${input.memberCount}`,
    });
  }
  return null;
}

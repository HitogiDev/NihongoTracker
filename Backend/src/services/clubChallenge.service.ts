import { FilterQuery, Types } from 'mongoose';
import ClubChallenge from '../models/clubChallenge.model.js';
import User from '../models/user.model.js';
import { apiError } from '../i18n/errorCodes.js';
import {
  ClubObjectiveMode,
  ClubChallengeStatus,
  IClubChallenge,
} from '../types.js';
import { createActivity } from './activity.service.js';
import { aggregateVisibleLogMetricByUser } from './clubLogMetrics.service.js';
import { getVisibleSocialOwnerIds } from './socialVisibility.service.js';

function currentChallengeStatus(
  challenge: Pick<IClubChallenge, 'status' | 'startDate' | 'endDate'>,
  now = new Date()
): ClubChallengeStatus {
  if (challenge.status === 'cancelled') return 'cancelled';
  if (now > challenge.endDate) return 'completed';
  if (now >= challenge.startDate) return 'active';
  return 'scheduled';
}

export async function refreshChallengeStatuses(now = new Date()) {
  await Promise.all([
    ClubChallenge.updateMany(
      { status: 'scheduled', startDate: { $lte: now }, endDate: { $gte: now } },
      { $set: { status: 'active' } }
    ),
    ClubChallenge.updateMany(
      { status: { $in: ['scheduled', 'active'] }, endDate: { $lt: now } },
      { $set: { status: 'completed' } }
    ),
  ]);
}

export async function listChallenges(input: {
  viewerId?: Types.ObjectId;
  clubId?: Types.ObjectId;
  status?: ClubChallengeStatus;
  mode?: ClubObjectiveMode;
}) {
  await refreshChallengeStatuses();
  const filter: FilterQuery<IClubChallenge> = {
    ...(input.clubId ? { club: input.clubId } : { scope: { $in: ['global', 'official'] } }),
    ...(input.status ? { status: input.status } : {}),
    ...(input.mode ? { mode: input.mode } : {}),
  };
  if (!input.clubId) filter.visibility = 'public';
  return ClubChallenge.find(filter)
    .populate('creator', 'username avatar')
    .sort({ startDate: -1, createdAt: -1 })
    .lean();
}

export async function getChallengeProgress(
  challenge: IClubChallenge,
  viewerId?: Types.ObjectId
) {
  const visibleParticipantIds = await getVisibleSocialOwnerIds({
    ownerIds: challenge.participants,
    viewerId,
    category: 'statistics',
  });
  const progressRows = await aggregateVisibleLogMetricByUser({
    ownerIds: visibleParticipantIds,
    viewerId,
    metric: challenge.metric,
    startDate: challenge.startDate,
    endDate: challenge.endDate,
  });
  const users = await User.find({ _id: { $in: visibleParticipantIds } })
    .select('_id username avatar')
    .lean();
  const valueByUser = new Map(
    progressRows.map((row) => [row._id.toString(), row.value])
  );
  const completedSet = new Set(
    challenge.completedParticipants.map((id) => id.toString())
  );

  return users.map((user) => {
    const value = valueByUser.get(user._id.toString()) ?? 0;
    return {
      user,
      progress: value,
      percentage: Math.min(100, Math.round((value / challenge.goal) * 1000) / 10),
      completed: value >= challenge.goal || completedSet.has(user._id.toString()),
    };
  });
}

export async function joinChallenge(
  challenge: IClubChallenge,
  userId: Types.ObjectId
) {
  const status = currentChallengeStatus(challenge);
  if (status === 'completed' || status === 'cancelled') {
    throw apiError('auth.forbidden', 409, 'This challenge is no longer joinable');
  }
  await ClubChallenge.updateOne(
    { _id: challenge._id },
    { $addToSet: { participants: userId }, $set: { status } }
  );
  await createActivity({
    actor: userId,
    type: 'challenge_joined',
    targetType: 'clubChallenge',
    targetId: challenge._id,
    club: challenge.club ?? null,
    metadata: { challengeTitle: challenge.title, metric: challenge.metric },
    dedupeKey: `challengeJoined:${challenge._id.toString()}:${userId.toString()}`,
  });
}

export async function leaveChallenge(
  challenge: IClubChallenge,
  userId: Types.ObjectId
) {
  if (challenge.completedParticipants.some((id) => id.equals(userId))) {
    throw apiError('auth.forbidden', 409, 'Completed challenges cannot be left');
  }
  await ClubChallenge.updateOne(
    { _id: challenge._id },
    { $pull: { participants: userId } }
  );
}

export async function completeChallengeForUser(
  challenge: IClubChallenge,
  userId: Types.ObjectId
) {
  if (!challenge.participants.some((id) => id.equals(userId))) {
    throw apiError('auth.forbidden', 403, 'Join the challenge before completing it');
  }
  const rows = await aggregateVisibleLogMetricByUser({
    ownerIds: [userId],
    viewerId: userId,
    metric: challenge.metric,
    startDate: challenge.startDate,
    endDate: challenge.endDate,
  });
  const progress = rows[0]?.value ?? 0;
  if (progress < challenge.goal) {
    throw apiError('auth.forbidden', 409, 'Challenge goal has not been reached');
  }
  await ClubChallenge.updateOne(
    { _id: challenge._id },
    { $addToSet: { completedParticipants: userId } }
  );
  await createActivity({
    actor: userId,
    type: 'challenge_completed',
    targetType: 'clubChallenge',
    targetId: challenge._id,
    club: challenge.club ?? null,
    metadata: {
      challengeTitle: challenge.title,
      metric: challenge.metric,
      goal: challenge.goal,
      progress,
    },
    importance: 'important',
    dedupeKey: `challengeCompleted:${challenge._id.toString()}:${userId.toString()}`,
  });
  return progress;
}

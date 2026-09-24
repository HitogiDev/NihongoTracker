import { NextFunction, Request, Response } from 'express';
import { Types } from 'mongoose';
import { apiError } from '../i18n/errorCodes.js';
import { customError } from '../middlewares/errorMiddleware.js';
import Activity from '../models/activity.model.js';
import UserAchievement from '../models/userAchievement.model.js';
import ClubChallenge from '../models/clubChallenge.model.js';
import { Club } from '../models/club.model.js';
import {
  CLUB_CHALLENGE_METRICS,
  ClubChallengeMetric,
  ClubChallengeScope,
  ClubChallengeStatus,
  ClubChallengeVisibility,
  ClubRole,
  IClub,
  IClubChallenge,
  userRoles,
} from '../types.js';
import { createActivity, deleteActivityComment, getActivityFeed } from '../services/activity.service.js';
import {
  normalizeClubRole,
  requireClubMember,
  requireClubPermission,
} from '../services/clubAuthorization.service.js';
import {
  completeChallengeForUser,
  getChallengeProgress,
  joinChallenge,
  leaveChallenge,
  listChallenges,
} from '../services/clubChallenge.service.js';
import {
  ClubLeaderboardMetric,
  ClubLeaderboardPeriod,
  getClubLeaderboard,
} from '../services/clubLeaderboard.service.js';
import { getClubObjectives as listClubObjectives } from '../services/clubObjectives.service.js';
import {
  checkAchievements,
  dismissAchievementNotifications,
} from '../services/achievements/achievementEngine.js';

function objectId(value: string, label: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(value)) {
    throw apiError('activity.invalidClubId', 400, `Invalid ${label} ID`);
  }
  return new Types.ObjectId(value);
}

async function clubById(value: string): Promise<IClub> {
  const club = await Club.findById(objectId(value, 'club'));
  if (!club) throw apiError('activity.invalidClubId', 404, 'Club not found');
  return club;
}

async function challengeById(value: string): Promise<IClubChallenge> {
  const challenge = await ClubChallenge.findById(objectId(value, 'challenge'));
  if (!challenge) throw apiError('activity.notFound', 404, 'Challenge not found');
  return challenge;
}

async function requireChallengeAccess(
  challenge: IClubChallenge,
  viewerId?: Types.ObjectId
) {
  if (challenge.visibility === 'public') return;
  if (!viewerId || !challenge.club) {
    throw apiError('activity.notFound', 404, 'Challenge not found');
  }
  const club = await Club.findById(challenge.club).select('members');
  if (!club) throw apiError('activity.notFound', 404, 'Challenge not found');
  requireClubMember(club, viewerId);
}

export async function getClubFeed(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const club = await clubById(req.params.clubId);
    requireClubMember(club, res.locals.user._id);
    const result = await getActivityFeed({
      viewerId: res.locals.user._id,
      clubIds: [club._id],
      scope: 'clubs',
      clubId: club._id,
      before: req.query.before,
      limit: req.query.limit,
    });
    const pinned = new Set(
      (club.pinnedActivities ?? []).map((id) => id.toString())
    );
    return res.status(200).json({
      ...result,
      activities: result.activities.map((activity) => ({
        ...activity,
        isPinned: pinned.has(activity._id.toString()),
      })),
    });
  } catch (error) {
    return next(error as customError);
  }
}

export async function setPinnedClubActivity(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const club = await clubById(req.params.clubId);
    requireClubPermission(club, res.locals.user._id, 'pin_posts');
    const activityId = objectId(req.params.activityId, 'activity');
    if (!(await Activity.exists({ _id: activityId, club: club._id }))) {
      throw apiError('activity.notFound', 404, 'Activity not found');
    }
    const update =
      req.body.pinned === false
        ? { $pull: { pinnedActivities: activityId } }
        : { $addToSet: { pinnedActivities: activityId } };
    await Club.updateOne({ _id: club._id }, update);
    return res.status(200).json({ pinned: req.body.pinned !== false });
  } catch (error) {
    return next(error as customError);
  }
}

export async function setPinnedClubObjective(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const club = await clubById(req.params.clubId);
    requireClubPermission(club, res.locals.user._id, 'pin_posts');
    const objectiveId = objectId(req.params.objectiveId, 'objective');
    const objective = await ClubChallenge.findOne({
      _id: objectiveId,
      club: club._id,
      scope: 'club',
      mode: 'collective',
    }).select('_id');
    if (!objective) {
      throw apiError('activity.notFound', 404, 'Collective objective not found');
    }
    const pinned = req.body.pinned !== false;
    await Club.updateOne(
      { _id: club._id },
      pinned
        ? { $set: { pinnedObjective: objectiveId } }
        : { $set: { pinnedObjective: null } }
    );
    return res.status(200).json({ pinned, objectiveId });
  } catch (error) {
    return next(error as customError);
  }
}

export async function moderateClubComment(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const club = await clubById(req.params.clubId);
    requireClubPermission(club, res.locals.user._id, 'moderate_content');
    const activityId = objectId(req.params.activityId, 'activity');
    if (!(await Activity.exists({ _id: activityId, club: club._id }))) {
      throw apiError('activity.notFound', 404, 'Activity not found');
    }
    await deleteActivityComment(
      objectId(req.params.commentId, 'comment'),
      res.locals.user._id,
      true
    );
    return res.status(204).send();
  } catch (error) {
    return next(error as customError);
  }
}

export async function createChallenge(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const scope = req.body.scope as ClubChallengeScope;
    const mode = req.body.mode === 'collective' ? 'collective' : 'individual';
    const metric = req.body.metric as ClubChallengeMetric;
    const visibility = (req.body.visibility ?? 'public') as ClubChallengeVisibility;
    const startDate = new Date(req.body.startDate);
    const endDate = new Date(req.body.endDate);
    const goal = Number(req.body.goal);
    if (!['global', 'official', 'club'].includes(scope)) {
      throw apiError('auth.forbidden', 400, 'Invalid challenge scope');
    }
    if (mode === 'collective' && scope !== 'club') {
      throw apiError('auth.forbidden', 400, 'Collective objectives must belong to a club');
    }
    if (!CLUB_CHALLENGE_METRICS.includes(metric)) {
      throw apiError('auth.forbidden', 400, 'Invalid challenge metric');
    }
    if (
      !req.body.title?.trim() ||
      !Number.isFinite(goal) ||
      goal <= 0 ||
      Number.isNaN(startDate.getTime()) ||
      Number.isNaN(endDate.getTime()) ||
      endDate <= startDate
    ) {
      throw apiError('auth.forbidden', 400, 'Invalid challenge fields');
    }
    let club: IClub | null = null;
    if (scope === 'club') {
      club = await clubById(String(req.body.clubId ?? ''));
      requireClubPermission(club, res.locals.user._id, 'create_challenges');
    } else if (visibility === 'members') {
      throw apiError('auth.forbidden', 400, 'Members visibility requires a club');
    }
    if (
      scope === 'official' &&
      !res.locals.user.roles?.includes(userRoles.admin)
    ) {
      throw apiError('auth.forbidden', 403, 'Only admins can create official challenges');
    }
    const now = new Date();
    const challenge = await ClubChallenge.create({
      title: req.body.title.trim(),
      description: typeof req.body.description === 'string' ? req.body.description.trim() : '',
      creator: res.locals.user._id,
      club: club?._id ?? null,
      mode,
      period: req.body.period ?? 'custom',
      scope,
      startDate,
      endDate,
      metric,
      goal,
      participants: mode === 'individual' ? [res.locals.user._id] : [],
      completedParticipants: [],
      status: now >= startDate ? 'active' : 'scheduled',
      visibility,
    });
    if (club) {
      await createActivity({
        actor: res.locals.user._id,
        type: 'club_challenge_started',
        targetType: 'clubChallenge',
        targetId: challenge._id,
        club: club._id,
        metadata: { challengeTitle: challenge.title, metric, goal },
        importance: 'important',
        dedupeKey: `clubChallengeStarted:${challenge._id.toString()}`,
      });
    }
    return res.status(201).json({ challenge });
  } catch (error) {
    return next(error as customError);
  }
}

export async function getClubObjectives(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const club = await clubById(req.params.clubId);
    requireClubMember(club, res.locals.user._id);
    const objectives = await listClubObjectives(club, res.locals.user._id);
    return res.status(200).json({ objectives });
  } catch (error) {
    return next(error as customError);
  }
}

export async function getChallenges(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const clubId = req.query.clubId
      ? objectId(String(req.query.clubId), 'club')
      : undefined;
    if (clubId) {
      const club = await Club.findById(clubId).select('members');
      if (!club) throw apiError('activity.invalidClubId', 404, 'Club not found');
      requireClubMember(club, res.locals.user?._id);
    }
    const status = req.query.status as ClubChallengeStatus | undefined;
    const challenges = await listChallenges({
      viewerId: res.locals.user?._id,
      clubId,
      status,
      mode: 'individual',
    });
    return res.status(200).json({ challenges });
  } catch (error) {
    return next(error as customError);
  }
}

export async function getChallenge(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const challenge = await challengeById(req.params.challengeId);
    await requireChallengeAccess(challenge, res.locals.user?._id);
    const participants = await getChallengeProgress(
      challenge,
      res.locals.user?._id
    );
    return res.status(200).json({ challenge, participants });
  } catch (error) {
    return next(error as customError);
  }
}

export async function joinClubChallenge(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const challenge = await challengeById(req.params.challengeId);
    await requireChallengeAccess(challenge, res.locals.user._id);
    if (challenge.club) {
      const club = await Club.findById(challenge.club).select('members');
      if (!club) throw apiError('activity.invalidClubId', 404, 'Club not found');
      requireClubMember(club, res.locals.user._id);
    }
    await joinChallenge(challenge, res.locals.user._id);
    return res.status(200).json({ joined: true });
  } catch (error) {
    return next(error as customError);
  }
}

export async function leaveClubChallenge(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const challenge = await challengeById(req.params.challengeId);
    await leaveChallenge(challenge, res.locals.user._id);
    return res.status(204).send();
  } catch (error) {
    return next(error as customError);
  }
}

export async function completeClubChallenge(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const challenge = await challengeById(req.params.challengeId);
    const progress = await completeChallengeForUser(
      challenge,
      res.locals.user._id
    );
    const newAchievements = await checkAchievements(res.locals.user._id, {
      trigger: 'clubChallengeComplete',
    });
    if (newAchievements.length > 0) {
      const achievementIds = newAchievements.map(
        (achievement) => achievement._id as Types.ObjectId
      );
      await UserAchievement.updateMany(
        {
          user: res.locals.user._id,
          achievement: { $in: achievementIds },
        },
        { $set: { notified: true } }
      );
      await dismissAchievementNotifications(res.locals.user._id, achievementIds);
    }
    return res.status(200).json({ completed: true, progress, newAchievements });
  } catch (error) {
    return next(error as customError);
  }
}

export async function getCooperativeGoals(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const club = await clubById(req.params.clubId);
    requireClubMember(club, res.locals.user._id);
    const goals = (await listClubObjectives(club, res.locals.user._id)).filter(
      (objective) => objective.mode === 'collective'
    );
    return res.status(200).json({ goals });
  } catch (error) {
    return next(error as customError);
  }
}

export async function createCooperativeGoal(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const club = await clubById(req.params.clubId);
    requireClubPermission(club, res.locals.user._id, 'create_challenges');
    const type = req.body.type as 'time' | 'chars' | 'episodes' | 'pages';
    const target = Number(req.body.target);
    const startDate = new Date(req.body.startDate);
    const endDate = new Date(req.body.endDate);
    if (
      !['time', 'chars', 'episodes', 'pages'].includes(type) ||
      !Number.isFinite(target) ||
      target <= 0 ||
      Number.isNaN(startDate.getTime()) ||
      Number.isNaN(endDate.getTime()) ||
      endDate <= startDate
    ) {
      throw apiError('auth.forbidden', 400, 'Invalid cooperative goal fields');
    }
    const objective = await ClubChallenge.create({
      title: typeof req.body.title === 'string' && req.body.title.trim()
        ? req.body.title.trim()
        : 'Club objective',
      description:
        typeof req.body.description === 'string'
          ? req.body.description.trim()
          : '',
      creator: res.locals.user._id,
      club: club._id,
      mode: 'collective',
      period: 'custom',
      scope: 'club',
      startDate,
      endDate,
      metric: type,
      goal: target,
      participants: [],
      completedParticipants: [],
      status: new Date() >= startDate ? 'active' : 'scheduled',
      visibility: 'members',
    });
    return res.status(201).json({
      goal: objective,
      objective,
    });
  } catch (error) {
    return next(error as customError);
  }
}

export async function getEnhancedClubLeaderboard(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const club = await clubById(req.params.clubId);
    const metric = (req.query.metric ?? 'xp') as ClubLeaderboardMetric;
    const period = (req.query.period ?? 'all-time') as ClubLeaderboardPeriod;
    if (!['xp', 'time', 'chars', 'reading', 'listening'].includes(metric)) {
      throw apiError('auth.forbidden', 400, 'Invalid leaderboard metric');
    }
    if (!['week', 'month', 'all-time'].includes(period)) {
      throw apiError('auth.forbidden', 400, 'Invalid leaderboard period');
    }
    const rankings = await getClubLeaderboard({
      club,
      viewerId: res.locals.user?._id,
      metric,
      period,
    });
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
    const start = (page - 1) * limit;
    return res.status(200).json({
      rankings: rankings.slice(start, start + limit),
      metric,
      period,
      pagination: {
        page,
        limit,
        total: rankings.length,
        totalPages: Math.ceil(rankings.length / limit),
      },
    });
  } catch (error) {
    return next(error as customError);
  }
}

export async function updateClubMemberRole(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const club = await clubById(req.params.clubId);
    const actor = requireClubPermission(
      club,
      res.locals.user._id,
      'manage_members'
    );
    if (normalizeClubRole(actor.role) !== 'owner') {
      throw apiError('auth.forbidden', 403, 'Only the owner can assign roles');
    }
    const role = req.body.role as ClubRole;
    if (!['moderator', 'event_manager', 'member'].includes(role)) {
      throw apiError('auth.forbidden', 400, 'Invalid assignable club role');
    }
    const memberId = objectId(req.params.memberId, 'member');
    const target = requireClubMember(club, memberId);
    if (normalizeClubRole(target.role) === 'owner') {
      throw apiError('auth.forbidden', 409, 'Transfer ownership instead');
    }
    await Club.updateOne(
      { _id: club._id, 'members.user': memberId },
      { $set: { 'members.$.role': role } }
    );
    return res.status(200).json({ role });
  } catch (error) {
    return next(error as customError);
  }
}

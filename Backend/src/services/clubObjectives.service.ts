import { Types } from 'mongoose';
import ClubChallenge from '../models/clubChallenge.model.js';
import User from '../models/user.model.js';
import {
  ClubObjectiveMode,
  IClub,
  IClubChallenge,
  IClubGoal,
} from '../types.js';
import {
  aggregateVisibleLogMetricByUser,
  ClubLogMetric,
} from './clubLogMetrics.service.js';
import { getVisibleSocialOwnerIds } from './socialVisibility.service.js';
import {
  getChallengeProgress,
  refreshChallengeStatuses,
} from './clubChallenge.service.js';

const FAR_FUTURE = new Date('9999-12-31T23:59:59.999Z');

export interface ClubObjectiveView {
  _id: Types.ObjectId;
  title: string;
  description: string;
  creator: Types.ObjectId | Record<string, unknown>;
  club: Types.ObjectId | null;
  mode: ClubObjectiveMode;
  period?: IClubChallenge['period'];
  scope: IClubChallenge['scope'];
  startDate: Date;
  endDate: Date;
  metric: IClubChallenge['metric'];
  goal: number;
  participants: Types.ObjectId[];
  completedParticipants: Types.ObjectId[];
  status: IClubChallenge['status'];
  visibility: IClubChallenge['visibility'];
  createdAt: Date;
  progress: number;
  percentage: number;
  remaining: number;
  completed: boolean;
  contributors?: Array<{
    user: { _id: Types.ObjectId; username: string; avatar?: string };
    value: number;
  }>;
  participantProgress?: Awaited<ReturnType<typeof getChallengeProgress>>;
  legacyGoalId?: Types.ObjectId;
  isPinned: boolean;
}

function activeMemberIds(club: Pick<IClub, 'members'>): Types.ObjectId[] {
  return club.members
    .filter((member) => member.status === 'active')
    .map((member) => member.user);
}

function getLegacyGoalDates(goal: IClubGoal, now = new Date()) {
  if (goal.period === 'custom' && goal.startDate && goal.endDate) {
    return { startDate: new Date(goal.startDate), endDate: new Date(goal.endDate) };
  }

  if (goal.period === 'weekly') {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 7);
    return { startDate: start, endDate: end };
  }

  if (goal.period === 'monthly') {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    return { startDate: start, endDate: end };
  }

  const startDate = goal.createdAt ? new Date(goal.createdAt) : now;
  return { startDate, endDate: FAR_FUTURE };
}

function currentStatus(
  startDate: Date,
  endDate: Date,
  active: boolean,
  now = new Date()
): IClubChallenge['status'] {
  if (!active) return 'cancelled';
  if (now < startDate) return 'scheduled';
  if (now >= endDate) return 'completed';
  return 'active';
}

function fallbackCreator(club: Pick<IClub, 'members'>): Types.ObjectId | undefined {
  return (
    club.members.find(
      (member) => member.status === 'active' && member.role === 'owner'
    )?.user ?? club.members.find((member) => member.status === 'active')?.user
  );
}

/**
 * Mirrors embedded legacy club goals into the unified objective collection.
 * This is idempotent and lets existing clubs migrate without a blocking data job.
 */
export async function syncLegacyClubObjectives(club: IClub): Promise<void> {
  const legacyGoals = (club.clubGoals ?? []).filter((goal) => goal._id);
  const legacyIds = legacyGoals.map((goal) => goal._id as Types.ObjectId);

  if (legacyIds.length > 0) {
    const creatorFallback = fallbackCreator(club);
    if (!creatorFallback) return;

    await Promise.all(
      legacyGoals.map(async (goal) => {
        const { startDate, endDate } = getLegacyGoalDates(goal);
        const creator = goal.createdBy ?? creatorFallback;
        await ClubChallenge.updateOne(
          { club: club._id, legacyGoalId: goal._id },
          {
            $set: {
              title: goal.title?.trim() || 'Club objective',
              description: goal.description?.trim() || '',
              creator,
              club: club._id,
              legacyGoalId: goal._id,
              mode: 'collective',
              period: goal.period,
              scope: 'club',
              startDate,
              endDate,
              metric: goal.type,
              goal: goal.target,
              participants: [],
              completedParticipants: [],
              status: currentStatus(startDate, endDate, goal.isActive),
              visibility: 'members',
            },
          },
          { upsert: true }
        );
      })
    );
  }

  await ClubChallenge.deleteMany({
    club: club._id,
    legacyGoalId: { $exists: true, $ne: null, $nin: legacyIds },
  });
}

async function collectiveProgress(
  objective: IClubChallenge,
  club: Pick<IClub, 'members'>,
  viewerId?: Types.ObjectId
) {
  const visibleOwnerIds = await getVisibleSocialOwnerIds({
    ownerIds: activeMemberIds(club),
    viewerId,
    category: 'statistics',
  });
  const rows = await aggregateVisibleLogMetricByUser({
    ownerIds: visibleOwnerIds,
    viewerId,
    metric: objective.metric as ClubLogMetric,
    startDate: objective.startDate,
    endDate: objective.endDate,
  });
  const users = await User.find({ _id: { $in: visibleOwnerIds } })
    .select('_id username avatar')
    .lean();
  const valueByUser = new Map(
    rows.map((row) => [row._id.toString(), row.value])
  );
  const contributors = users
    .map((user) => ({
      user,
      value: valueByUser.get(user._id.toString()) ?? 0,
    }))
    .sort((left, right) => right.value - left.value);
  const progress = rows.reduce((total, row) => total + row.value, 0);
  return {
    progress,
    percentage: Math.min(100, Math.round((progress / Math.max(objective.goal, 1)) * 1000) / 10),
    remaining: Math.max(0, objective.goal - progress),
    completed: progress >= objective.goal,
    contributors,
  };
}

async function objectiveView(
  objective: IClubChallenge,
  club: Pick<IClub, 'members'>,
  viewerId?: Types.ObjectId
): Promise<ClubObjectiveView> {
  const base = objective.toObject();
  if (objective.mode === 'collective') {
    const progress = await collectiveProgress(objective, club, viewerId);
    return { ...base, ...progress, mode: 'collective' } as ClubObjectiveView;
  }

  const participantProgress = await getChallengeProgress(objective, viewerId);
  const viewerProgress = viewerId
    ? participantProgress.find((entry) => entry.user._id.equals(viewerId))
    : undefined;
  const progress = viewerProgress?.progress ?? 0;
  return {
    ...base,
    mode: 'individual',
    progress,
    percentage: viewerProgress?.percentage ?? 0,
    remaining: Math.max(0, objective.goal - progress),
    completed: viewerProgress?.completed ?? false,
    participantProgress,
  } as ClubObjectiveView;
}

export async function getClubObjectives(
  club: IClub,
  viewerId?: Types.ObjectId
): Promise<ClubObjectiveView[]> {
  await syncLegacyClubObjectives(club);
  await refreshChallengeStatuses();
  const objectives = await ClubChallenge.find({
    club: club._id,
    scope: 'club',
  })
    .populate('creator', 'username avatar')
    .sort({ startDate: -1, createdAt: -1 });
  const views = await Promise.all(
    objectives.map((objective) => objectiveView(objective, club, viewerId))
  );
  const pinnedId = club.pinnedObjective?.toString();
  return views
    .map((view) => ({ ...view, isPinned: view._id.toString() === pinnedId }))
    .sort((left, right) => Number(right.isPinned) - Number(left.isPinned));
}

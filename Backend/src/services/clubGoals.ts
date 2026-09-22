import { Types } from 'mongoose';
import { Club } from '../models/club.model.js';
import User from '../models/user.model.js';
import { IClub, IClubGoal } from '../types.js';
import { createActivity } from './activity.service.js';
import {
  aggregateVisibleLogMetricByUser,
  ClubLogMetricRow,
} from './clubLogMetrics.service.js';

function getStartOfUtcWeek(date: Date): Date {
  const utc = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
  utc.setUTCDate(utc.getUTCDate() - ((utc.getUTCDay() + 6) % 7));
  return utc;
}

export function getGoalWindow(
  goal: IClubGoal,
  now = new Date()
): { start?: Date; end?: Date } {
  if (goal.period === 'weekly') {
    return { start: getStartOfUtcWeek(now), end: now };
  }
  if (goal.period === 'monthly') {
    return {
      start: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
      end: now,
    };
  }
  if (goal.period === 'custom') {
    return { start: goal.startDate, end: goal.endDate };
  }
  return { start: goal.createdAt ?? goal.startDate, end: now };
}

function activeMemberIds(club: Pick<IClub, 'members'>): Types.ObjectId[] {
  return club.members
    .filter((member) => member.status === 'active')
    .map((member) => member.user);
}

async function goalRows(
  club: Pick<IClub, 'members'>,
  goal: IClubGoal,
  viewerId?: Types.ObjectId
): Promise<ClubLogMetricRow[]> {
  const window = getGoalWindow(goal);
  return aggregateVisibleLogMetricByUser({
    ownerIds: activeMemberIds(club),
    viewerId,
    metric: goal.type,
    startDate: window.start,
    endDate: window.end,
  });
}

export async function getCooperativeGoalsProgress(
  club: IClub,
  viewerId?: Types.ObjectId
) {
  const calculated = await Promise.all(
    club.clubGoals.map(async (goal) => ({
      goal,
      rows: await goalRows(club, goal, viewerId),
    }))
  );
  const contributorIds = [
    ...new Set(
      calculated.flatMap(({ rows }) => rows.map((row) => row._id.toString()))
    ),
  ].map((id) => new Types.ObjectId(id));
  const users = await User.find({ _id: { $in: contributorIds } })
    .select('_id username avatar')
    .lean();
  const userById = new Map(users.map((user) => [user._id.toString(), user]));

  return Promise.all(
    calculated.map(async ({ goal, rows }) => {
      const currentTotal = rows.reduce((sum, row) => sum + row.value, 0);
      const percentage = Math.min(
        100,
        Math.round((currentTotal / Math.max(goal.target, 1)) * 1000) / 10
      );
      const completed = currentTotal >= goal.target;
      const goalId = goal._id;
      const actor = goal.createdBy ?? activeMemberIds(club)[0];
      if (goalId && actor) {
        const bucket = completed ? 100 : Math.floor(percentage / 25) * 25;
        if (bucket >= 25) {
          await createActivity({
            actor,
            type: completed
              ? 'cooperative_goal_completed'
              : 'cooperative_goal_progress',
            targetType: 'clubGoal',
            targetId: goalId,
            club: club._id,
            metadata: {
              clubName: club.name,
              goalTitle: goal.title,
              metric: goal.type,
              target: goal.target,
              progress: currentTotal,
              percentage,
            },
            importance: completed ? 'important' : 'normal',
            dedupeKey: `clubGoal:${goalId.toString()}:${bucket}`,
          });
        }
      }
      return {
        _id: goal._id,
        title: goal.title,
        description: goal.description,
        createdBy: goal.createdBy,
        type: goal.type,
        target: goal.target,
        period: goal.period,
        isActive: goal.isActive,
        startDate: goal.startDate,
        endDate: goal.endDate,
        completedAt: goal.completedAt,
        createdAt: goal.createdAt,
        currentTotal,
        percentage,
        remaining: Math.max(0, goal.target - currentTotal),
        completed,
        contributors: rows
          .map((row) => ({
            user: userById.get(row._id.toString()),
            value: row.value,
          }))
          .filter((entry) => entry.user)
          .sort((left, right) => right.value - left.value),
      };
    })
  );
}

export async function recalculateClubGoalsProgress(
  clubId: string,
  viewerId?: Types.ObjectId
): Promise<void> {
  const club = await Club.findById(clubId).select('name members clubGoals');
  if (!club) return;
  const rowsByGoal = await Promise.all(
    club.clubGoals.map((goal) => goalRows(club, goal, viewerId))
  );
  const totals = rowsByGoal.map((rows) =>
    rows.reduce((sum, row) => sum + row.value, 0)
  );
  totals.forEach((total, index) => {
    club.clubGoals[index].currentProgress = total;
  });
  await club.save();
}

import { Types } from 'mongoose';
import { Club } from '../models/club.model.js';
import Log from '../models/log.model.js';
import { IClubGoal } from '../types.js';

function getStartOfUtcWeek(date: Date): Date {
  const utc = new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      0,
      0,
      0,
      0
    )
  );
  const day = utc.getUTCDay();
  const delta = (day + 6) % 7;
  utc.setUTCDate(utc.getUTCDate() - delta);
  return utc;
}

function getGoalWindow(
  goal: IClubGoal,
  now = new Date()
): { start?: Date; end?: Date } {
  if (goal.period === 'weekly') {
    return { start: getStartOfUtcWeek(now), end: now };
  }

  if (goal.period === 'monthly') {
    return {
      start: new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0)
      ),
      end: now,
    };
  }

  if (goal.period === 'custom') {
    return {
      start: goal.startDate,
      end: goal.endDate,
    };
  }

  return {
    start: goal.createdAt || goal.startDate,
    end: now,
  };
}

/**
 * Recalculates all active (and inactive) club goals' `currentProgress` by summing
 * members' logs in the goal timeframe and writing the totals to the club doc.
 */
export async function recalculateClubGoalsProgress(
  clubId: string
): Promise<void> {
  const club = await Club.findById(clubId).select('members clubGoals');
  if (!club) return;

  const memberIds = (club.members || [])
    .filter((member) => member.status === 'active')
    .map((member) => new Types.ObjectId(member.user));

  // If no members, set all progress to 0 and save
  if (!memberIds.length) {
    if (Array.isArray(club.clubGoals) && club.clubGoals.length) {
      club.clubGoals.forEach((g) => (g.currentProgress = 0));
      await club.save();
    }
    return;
  }

  // For each goal, sum the appropriate log field across all member logs in window
  for (const goal of club.clubGoals as IClubGoal[]) {
    const field =
      goal.type === 'time'
        ? 'time'
        : goal.type === 'chars'
          ? 'chars'
          : goal.type === 'episodes'
            ? 'episodes'
            : 'pages';

    const window = getGoalWindow(goal);
    const match: any = {
      user: { $in: memberIds },
      ...(window.start || window.end
        ? {
            date: {
              ...(window.start ? { $gte: new Date(window.start) } : {}),
              ...(window.end ? { $lte: new Date(window.end) } : {}),
            },
          }
        : {}),
    };

    // Only match documents that have the numeric field present or non-null.
    match[field] = { $exists: true };

    const res = await Log.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          total: { $sum: { $ifNull: [`$${field}`, 0] } },
        },
      },
    ]);

    const total = (res && res[0] && res[0].total) || 0;
    (goal as any).currentProgress = total;
  }

  await club.save();
}

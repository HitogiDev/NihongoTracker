import { Types } from 'mongoose';
import Log from '../models/log.model.js';

export interface IOvertakenUser {
  username: string;
  avatar?: string;
  xp: number;
}

export interface IOvertakeResult {
  timeframe: 'month';
  rank: number;
  previousRank: number;
  overtaken: IOvertakenUser[];
}

/** First day (UTC 00:00) of the calendar month containing `date`. */
function monthStartOf(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

const publicMonthlyLogs = (monthStart: Date) => ({
  private: { $ne: true },
  unknownDate: { $ne: true },
  date: { $gte: monthStart },
});

/**
 * After a log is saved, work out where the user now sits on the current
 * calendar-month XP leaderboard and which users this specific log pushed
 * them past. Returns null when the log can't move the needle (no XP gained
 * or the user has no ranked XP this month).
 *
 * Matches the live ranking semantics (`getRanking` month filter): public,
 * dated logs only, ranking-banned users excluded.
 */
export async function computeMonthlyOvertakes(
  userId: Types.ObjectId,
  gainedXp: number
): Promise<IOvertakeResult | null> {
  if (!gainedXp || gainedXp <= 0) return null;

  const monthStart = monthStartOf(new Date());

  const [mine] = await Log.aggregate([
    { $match: { user: userId, ...publicMonthlyLogs(monthStart) } },
    { $group: { _id: null, xp: { $sum: '$xp' } } },
  ]);

  const myXp: number = mine?.xp ?? 0;
  if (myXp <= 0) return null;
  const beforeXp = Math.max(0, myXp - gainedXp);

  const [result] = await Log.aggregate([
    {
      $match: {
        user: { $ne: userId },
        ...publicMonthlyLogs(monthStart),
      },
    },
    { $group: { _id: '$user', xp: { $sum: '$xp' } } },
    { $match: { xp: { $gt: 0 } } },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'user',
      },
    },
    { $unwind: { path: '$user', preserveNullAndEmptyArrays: false } },
    {
      $match: {
        $or: [
          { 'user.moderation.rankingBanned': { $exists: false } },
          { 'user.moderation.rankingBanned': false },
        ],
      },
    },
    {
      $facet: {
        above: [{ $match: { xp: { $gt: myXp } } }, { $count: 'count' }],
        abovePrev: [{ $match: { xp: { $gt: beforeXp } } }, { $count: 'count' }],
        overtaken: [
          { $match: { xp: { $gt: beforeXp, $lte: myXp } } },
          { $sort: { xp: -1 } },
          { $limit: 5 },
          {
            $project: {
              _id: 0,
              username: '$user.username',
              avatar: '$user.avatar',
              xp: 1,
            },
          },
        ],
      },
    },
  ]);

  const above: number = result?.above?.[0]?.count ?? 0;
  const abovePrev: number = result?.abovePrev?.[0]?.count ?? 0;

  return {
    timeframe: 'month',
    rank: above + 1,
    previousRank: abovePrev + 1,
    overtaken: (result?.overtaken ?? []) as IOvertakenUser[],
  };
}

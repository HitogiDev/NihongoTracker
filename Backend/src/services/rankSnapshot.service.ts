import { Types } from 'mongoose';
import Log from '../models/log.model.js';
import RankSnapshot from '../models/rankSnapshot.model.js';

/** Return the UTC Sunday 00:00 on/before the given date. */
function sundayOf(date: Date): Date {
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return d;
}

/** First day (UTC 00:00) of the calendar month containing `date`. */
function monthStartOf(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

const notRankingBanned = {
  $or: [
    { 'user.moderation.rankingBanned': { $exists: false } },
    { 'user.moderation.rankingBanned': false },
  ],
};

/**
 * Rank all users by summed XP over the given match window, returning a map
 * of userId string → 1-based position (dense, ties share sort order).
 */
async function rankByXp(match: Record<string, unknown>): Promise<
  Map<string, number>
> {
  const rows = await Log.aggregate([
    { $match: match },
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
    { $match: notRankingBanned },
    { $sort: { xp: -1 } },
    { $project: { _id: 1 } },
  ]);

  const positions = new Map<string, number>();
  rows.forEach((row, index) => {
    positions.set(String(row._id), index + 1);
  });
  return positions;
}

/**
 * Compute global (cumulative all-time XP) and monthly (XP within the calendar
 * month) leaderboard positions as of `snapshotDate`, and upsert one snapshot
 * per user for that date.
 */
export async function computeAndStoreSnapshot(
  snapshotDate: Date
): Promise<number> {
  const monthStart = monthStartOf(snapshotDate);

  const [globalPositions, monthlyPositions] = await Promise.all([
    rankByXp({
      private: { $ne: true },
      date: { $lte: snapshotDate },
    }),
    rankByXp({
      private: { $ne: true },
      unknownDate: { $ne: true },
      date: { $gte: monthStart, $lte: snapshotDate },
    }),
  ]);

  if (globalPositions.size === 0) return 0;

  const monthlyUnranked = monthlyPositions.size + 1;

  const ops = Array.from(globalPositions.entries()).map(
    ([userId, globalPosition]) => ({
      updateOne: {
        filter: { userId: new Types.ObjectId(userId), date: snapshotDate },
        update: {
          $set: {
            userId: new Types.ObjectId(userId),
            date: snapshotDate,
            globalPosition,
            monthlyPosition: monthlyPositions.get(userId) ?? monthlyUnranked,
          },
        },
        upsert: true,
      },
    })
  );

  if (ops.length > 0) {
    await RankSnapshot.bulkWrite(ops, { ordered: false });
  }
  return ops.length;
}

/** Record a snapshot for the current week (called by the weekly cron). */
export async function recordCurrentRankSnapshot(): Promise<number> {
  const snapshotDate = sundayOf(new Date());
  return computeAndStoreSnapshot(snapshotDate);
}

/**
 * One-time backfill: reconstruct weekly rank snapshots from all historical
 * logs, inferring each week's global + monthly positions from log dates.
 */
export async function backfillRankHistory(): Promise<{
  weeks: number;
  snapshots: number;
}> {
  const [firstLog] = await Log.aggregate([
    { $match: { private: { $ne: true }, unknownDate: { $ne: true } } },
    { $group: { _id: null, first: { $min: '$date' } } },
  ]);

  if (!firstLog?.first) {
    return { weeks: 0, snapshots: 0 };
  }

  const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
  const MAX_WEEKS = 520; // ~10 years — bounds work and ignores erroneous ancient dates

  const end = sundayOf(new Date());
  let start = sundayOf(new Date(firstLog.first));
  // If the span is longer than the cap (usually a mis-dated old log), start
  // later so the window always reaches the present rather than stalling in the past.
  const spanWeeks = Math.floor((end.getTime() - start.getTime()) / WEEK_MS) + 1;
  if (spanWeeks > MAX_WEEKS) {
    start = new Date(end.getTime() - (MAX_WEEKS - 1) * WEEK_MS);
  }

  // Clean rebuild so re-runs don't leave stale snapshots from a wider window.
  await RankSnapshot.deleteMany({});

  let weeks = 0;
  let snapshots = 0;
  for (
    let cursor = new Date(start);
    cursor.getTime() <= end.getTime();
    cursor = new Date(cursor.getTime() + WEEK_MS)
  ) {
    snapshots += await computeAndStoreSnapshot(new Date(cursor));
    weeks++;
  }

  return { weeks, snapshots };
}

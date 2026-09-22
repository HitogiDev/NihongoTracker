import { Types } from 'mongoose';
import Log from '../models/log.model.js';
import RankSnapshot from '../models/rankSnapshot.model.js';

export interface IRankHistoryPoint {
  date: Date;
  position: number;
}

export interface IMonthlyRankEvent {
  userId: Types.ObjectId | string;
  xp: number;
  date: Date;
}

/** Current calendar-month boundaries in the requested IANA timezone. */
export function getMonthBoundaries(
  timezone: string,
  now = new Date()
): { monthStart: Date; monthEnd: Date } {
  let userNow: Date;
  try {
    userNow = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
  } catch {
    userNow = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
  }

  const offset = now.getTime() - userNow.getTime();
  const monthStartLocal = new Date(
    userNow.getFullYear(),
    userNow.getMonth(),
    1
  );
  const nextMonthLocal = new Date(
    userNow.getFullYear(),
    userNow.getMonth() + 1,
    1
  );

  return {
    monthStart: new Date(monthStartLocal.getTime() + offset),
    monthEnd: new Date(nextMonthLocal.getTime() + offset),
  };
}

/**
 * Replay monthly XP events, keeping each effective position change. Month
 * start and the current position make a stable ranking drawable as a line.
 */
export function buildMonthlyRankHistory(
  events: IMonthlyRankEvent[],
  targetUserId: Types.ObjectId | string,
  monthStart: Date,
  asOf: Date
): IRankHistoryPoint[] {
  const targetId = String(targetUserId);
  const totals = new Map<string, number>();
  const points: IRankHistoryPoint[] = [{ date: monthStart, position: 1 }];
  let position = 1;

  for (const event of events) {
    const eventUserId = String(event.userId);
    const targetXp = totals.get(targetId) ?? 0;
    const previousEventXp = totals.get(eventUserId) ?? 0;
    const nextEventXp = previousEventXp + (Number(event.xp) || 0);
    totals.set(eventUserId, nextEventXp);

    let nextPosition = position;
    if (eventUserId === targetId) {
      nextPosition =
        1 +
        Array.from(totals.entries()).filter(
          ([userId, xp]) => userId !== targetId && xp > nextEventXp
        ).length;
    } else if (previousEventXp <= targetXp && nextEventXp > targetXp) {
      nextPosition += 1;
    } else if (previousEventXp > targetXp && nextEventXp <= targetXp) {
      nextPosition -= 1;
    }

    if (nextPosition !== position) {
      position = nextPosition;
      points.push({ date: event.date, position });
    }
  }

  const lastPoint = points[points.length - 1];
  if (asOf.getTime() > lastPoint.date.getTime()) {
    points.push({ date: asOf, position });
  }

  return points;
}

/** Build the current month's position history from each public ranking event. */
export async function getMonthlyRankHistory(
  userId: Types.ObjectId,
  timezone: string,
  now = new Date()
): Promise<IRankHistoryPoint[]> {
  const { monthStart, monthEnd } = getMonthBoundaries(timezone, now);
  const rangeEnd = new Date(Math.min(now.getTime(), monthEnd.getTime()));
  const events = await Log.aggregate<IMonthlyRankEvent>([
    {
      $match: {
        private: { $ne: true },
        unknownDate: { $ne: true },
        date: { $gte: monthStart, $lte: rangeEnd },
      },
    },
    {
      $lookup: {
        from: 'users',
        localField: 'user',
        foreignField: '_id',
        as: 'rankingUser',
      },
    },
    { $unwind: { path: '$rankingUser', preserveNullAndEmptyArrays: false } },
    {
      $match: {
        $or: [
          { 'rankingUser._id': userId },
          {
            $and: [
              {
                $or: [
                  {
                    'rankingUser.moderation.rankingBanned': {
                      $exists: false,
                    },
                  },
                  { 'rankingUser.moderation.rankingBanned': false },
                ],
              },
              {
                $or: [
                  {
                    'rankingUser.settings.socialPrivacy.statistics': {
                      $exists: false,
                    },
                  },
                  {
                    'rankingUser.settings.socialPrivacy.statistics': 'public',
                  },
                ],
              },
            ],
          },
        ],
      },
    },
    { $sort: { date: 1, _id: 1 } },
    { $project: { _id: 0, userId: '$user', xp: 1, date: 1 } },
  ]);

  return buildMonthlyRankHistory(events, userId, monthStart, rangeEnd);
}

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

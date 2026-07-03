/**
 * Achievement Cron Service
 * Handles achievements that require periodic evaluation instead of per-log checking.
 *
 * Schedule:
 *   runDailyCronAchievements  — runs once per day (00:30 UTC)
 *   runWeeklyCronAchievements — runs every Monday at 01:00 UTC
 *   runMonthlyCronAchievements — runs on the 1st of each month at 02:00 UTC
 *
 * Cron-based achievements covered:
 *   Daily:   Full Immersion (logged every day this month so far)
 *            Clockwork (same UTC hour every day for 14 consecutive days)
 *            No Days Off (logged on Christmas + New Year + account anniversary)
 *   Weekly:  Weekend Warrior (every Sat+Sun for 4 consecutive weekends)
 *            Monday Motivation (10 consecutive Mondays)
 *            Top 10 / Podium / King / Consistent (weekly leaderboard snapshot)
 *   Monthly: Full Immersion (final check: logged every day of the last calendar month)
 */

import { CronJob } from 'cron';
import { Types } from 'mongoose';
import User from '../../models/user.model.js';
import Log from '../../models/log.model.js';
import Achievement from '../../models/achievement.model.js';
import UserAchievement from '../../models/userAchievement.model.js';
import WeeklyRankSnapshot from '../../models/weeklyRankSnapshot.model.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Grant an achievement if not already owned. Returns true if newly granted. */
async function grantIfUnowned(
  userId: Types.ObjectId,
  achievementKey: string,
  progress = 0
): Promise<boolean> {
  const achievement = await Achievement.findOne({
    key: achievementKey,
    isActive: true,
  })
    .select('_id')
    .lean();
  if (!achievement) return false;

  const result = await UserAchievement.findOneAndUpdate(
    { user: userId, achievement: achievement._id },
    {
      $setOnInsert: {
        user: userId,
        achievement: achievement._id,
        unlockedAt: new Date(),
        progress,
        notified: false,
      },
    },
    { upsert: true, new: false }
  );

  // If result is null the document was upserted (newly created)
  return result === null;
}

/** Return all active user IDs (non-banned). */
async function getActiveUserIds(): Promise<Types.ObjectId[]> {
  const users = await User.find({
    $or: [
      { 'moderation.rankingBanned': { $exists: false } },
      { 'moderation.rankingBanned': false },
    ],
  })
    .select('_id')
    .lean();
  return users.map((u) => u._id as Types.ObjectId);
}

/** UTC midnight for a given date offset (0 = today, -1 = yesterday…). */
function utcDayBoundary(offsetDays = 0): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d;
}

/** Days in a given UTC month (1-indexed). */
function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

// ─── Individual Checkers ─────────────────────────────────────────────────────

/**
 * FULL IMMERSION
 * Check whether the user has logged on every day of the LAST calendar month.
 */
async function checkFullImmersionMonth(
  userId: Types.ObjectId,
  year: number,
  month: number // 1-indexed
): Promise<boolean> {
  const total = daysInMonth(year, month);
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1)); // exclusive

  const distinctDays = await Log.aggregate<{ count: number }>([
    {
      $match: {
        user: userId,
        date: { $gte: start, $lt: end },
      },
    },
    {
      $group: {
        _id: {
          d: { $dayOfMonth: '$date' },
        },
      },
    },
    { $count: 'count' },
  ]);

  return (distinctDays[0]?.count ?? 0) >= total;
}

/**
 * CLOCKWORK
 * Every day for the last 14 consecutive calendar days, user must have logged,
 * and all their logs must cluster within a ±1h UTC window (same daily habit).
 */
async function checkClockwork14Days(userId: Types.ObjectId): Promise<boolean> {
  const start = utcDayBoundary(-13); // 14 days ago (inclusive)
  const end = utcDayBoundary(1);     // tomorrow (exclusive)

  const dailyHours = await Log.aggregate<{
    _id: { d: number };
    hours: number[];
  }>([
    { $match: { user: userId, date: { $gte: start, $lt: end } } },
    {
      $group: {
        _id: { d: { $dayOfMonth: '$date' }, m: { $month: '$date' }, y: { $year: '$date' } },
        hours: { $addToSet: { $hour: '$date' } },
      },
    },
  ]);

  // Must have exactly 14 distinct logged days
  if (dailyHours.length < 14) return false;

  // Collect all hours logged across all days
  const allHours = dailyHours.flatMap((d) => d.hours);
  const minH = Math.min(...allHours);
  const maxH = Math.max(...allHours);

  // Allow wrap-around (e.g. 23:xx and 00:xx are 1h apart)
  const spread = Math.min(maxH - minH, 24 - (maxH - minH));
  return spread <= 2; // within a 2-hour window across all days
}

/**
 * WEEKEND WARRIOR
 * User must have logged on every Saturday AND Sunday for the last 4 weekends.
 * We look back 28 days and find the 4 most recent complete weekends.
 */
async function checkWeekendWarrior(userId: Types.ObjectId): Promise<boolean> {
  const start = utcDayBoundary(-27); // 28 days ago
  const end = utcDayBoundary(1);

  const loggedDays = await Log.aggregate<{ _id: { ts: number } }>([
    { $match: { user: userId, date: { $gte: start, $lt: end } } },
    {
      $group: {
        _id: {
          ts: {
            $dateToString: { format: '%Y-%m-%d', date: '$date' },
          },
        },
      },
    },
  ]);

  const loggedSet = new Set(loggedDays.map((d) => d._id.ts as unknown as string));

  // Walk back through the last 4 weekends (Sat + Sun pairs)
  const now = new Date();
  let weekendsChecked = 0;
  let weekendsHit = 0;

  // Find the most recent Saturday
  const day = now.getUTCDay(); // 0=Sun … 6=Sat
  const daysToLastSat = day === 6 ? 7 : (day + 1); // skip current if today is Sat
  let cursor = utcDayBoundary(-daysToLastSat);

  for (let w = 0; w < 4; w++) {
    const satStr = cursor.toISOString().slice(0, 10);
    const sunCursor = new Date(cursor);
    sunCursor.setUTCDate(sunCursor.getUTCDate() + 1);
    const sunStr = sunCursor.toISOString().slice(0, 10);

    weekendsChecked++;
    if (loggedSet.has(satStr) && loggedSet.has(sunStr)) {
      weekendsHit++;
    }

    // Move back one week
    cursor.setUTCDate(cursor.getUTCDate() - 7);
  }

  return weekendsChecked === 4 && weekendsHit === 4;
}

/**
 * MONDAY MOTIVATION
 * 10 consecutive Mondays with at least one log each.
 */
async function checkMondayMotivation(userId: Types.ObjectId): Promise<boolean> {
  // Get the last 70 days of logs; extract distinct Monday dates
  const start = utcDayBoundary(-69);
  const end = utcDayBoundary(1);

  const mondayLogs = await Log.aggregate<{ _id: { ts: string } }>([
    {
      $match: {
        user: userId,
        date: { $gte: start, $lt: end },
        $expr: { $eq: [{ $dayOfWeek: '$date' }, 2] }, // 2 = Monday in MongoDB ($dayOfWeek: 1=Sun…7=Sat)
      },
    },
    {
      $group: {
        _id: {
          ts: {
            $dateToString: { format: '%Y-%m-%d', date: '$date' },
          },
        },
      },
    },
    { $sort: { '_id.ts': -1 } },
    { $limit: 10 },
  ]);

  if (mondayLogs.length < 10) return false;

  // Verify the 10 are consecutive (each exactly 7 days apart)
  const dates = mondayLogs
    .map((d) => new Date(d._id.ts as unknown as string).getTime())
    .sort((a, b) => b - a); // most recent first

  for (let i = 0; i < dates.length - 1; i++) {
    const diff = dates[i] - dates[i + 1];
    if (diff !== 7 * 24 * 60 * 60 * 1000) return false;
  }
  return true;
}

/**
 * NO DAYS OFF
 * Has the user logged on all three of: Christmas (12-25), New Year (01-01), and account anniversary?
 * We check historically (any year), and the anniversary is the account creation month+day.
 */
async function checkNoDaysOff(
  userId: Types.ObjectId,
  accountCreatedAt: Date
): Promise<boolean> {
  const checkDate = async (month: number, day: number) => {
    const doc = await Log.findOne({
      user: userId,
      $expr: {
        $and: [
          { $eq: [{ $month: '$date' }, month] },
          { $eq: [{ $dayOfMonth: '$date' }, day] },
        ],
      },
    })
      .select('_id')
      .lean();
    return !!doc;
  };

  const christmasLogged = await checkDate(12, 25);
  const newYearLogged = await checkDate(1, 1);
  const annivMonth = accountCreatedAt.getUTCMonth() + 1;
  const annivDay = accountCreatedAt.getUTCDate();
  const anniversaryLogged = await checkDate(annivMonth, annivDay);

  return christmasLogged && newYearLogged && anniversaryLogged;
}

/**
 * LEADERBOARD RANK
 * Compute current weekly XP leaderboard and return each user's position.
 * Returns a Map<userId_string, position> (1-based).
 */
async function computeWeeklyLeaderboard(): Promise<Map<string, number>> {
  const weekStart = utcDayBoundary(-(new Date().getUTCDay())); // Sunday
  const ranked = await Log.aggregate<{ _id: Types.ObjectId; totalXp: number }>([
    {
      $match: {
        date: { $gte: weekStart },
        private: { $ne: true },
        unknownDate: { $ne: true },
      },
    },
    { $group: { _id: '$user', totalXp: { $sum: '$xp' } } },
    { $sort: { totalXp: -1 } },
  ]);

  const map = new Map<string, number>();
  ranked.forEach((entry, idx) => {
    map.set(entry._id.toString(), idx + 1);
  });
  return map;
}

// ─── Daily Cron ─────────────────────────────────────────────────────────────

export async function runDailyCronAchievements(): Promise<void> {
  try {
    console.log('🏆 [cron:daily] Starting daily achievement checks...');
    const userIds = await getActiveUserIds();
    let granted = 0;

    const now = new Date();
    const prevMonth = now.getUTCMonth() === 0 ? 12 : now.getUTCMonth();
    const prevMonthYear =
      now.getUTCMonth() === 0 ? now.getUTCFullYear() - 1 : now.getUTCFullYear();

    // Also check current month on the last day
    const currentMonth = now.getUTCMonth() + 1;
    const currentYear = now.getUTCFullYear();
    const isLastDayOfMonth =
      now.getUTCDate() === daysInMonth(currentYear, currentMonth);

    for (const userId of userIds) {
      try {
        const user = await User.findById(userId).select('createdAt').lean();
        if (!user) continue;

        // 1. Full Immersion — check previous month (always) and current month if last day
        const monthsToCheck = [{ year: prevMonthYear, month: prevMonth }];
        if (isLastDayOfMonth) {
          monthsToCheck.push({ year: currentYear, month: currentMonth });
        }
        for (const { year, month } of monthsToCheck) {
          if (await checkFullImmersionMonth(userId, year, month)) {
            if (await grantIfUnowned(userId, 'full_immersion_month')) {
              granted++;
            }
          }
        }

        // 2. Clockwork — check last 14 days
        if (await checkClockwork14Days(userId)) {
          if (await grantIfUnowned(userId, 'clockwork')) {
            granted++;
          }
        }

        // 3. No Days Off
        if (await checkNoDaysOff(userId, user.createdAt as Date)) {
          if (await grantIfUnowned(userId, 'no_days_off')) {
            granted++;
          }
        }
      } catch (err) {
        console.error(`[cron:daily] Error for user ${userId}:`, err);
      }
    }

    console.log(`🏆 [cron:daily] Done — ${granted} achievements granted.`);
  } catch (err) {
    console.error('[cron:daily] Achievement cron failed:', err);
  }
}

// ─── Weekly Cron ─────────────────────────────────────────────────────────────

export async function runWeeklyCronAchievements(): Promise<void> {
  try {
    console.log('🏆 [cron:weekly] Starting weekly achievement checks...');
    const userIds = await getActiveUserIds();
    let granted = 0;

    // Compute current weekly leaderboard
    const leaderboard = await computeWeeklyLeaderboard();
    const weekStart = utcDayBoundary(-(new Date().getUTCDay()));

    for (const userId of userIds) {
      try {
        // 1. Weekend Warrior
        if (await checkWeekendWarrior(userId)) {
          if (await grantIfUnowned(userId, 'weekend_warrior')) {
            granted++;
          }
        }

        // 2. Monday Motivation
        if (await checkMondayMotivation(userId)) {
          if (await grantIfUnowned(userId, 'monday_motivation')) {
            granted++;
          }
        }

        // 3. Leaderboard achievements
        const position = leaderboard.get(userId.toString());
        if (position !== undefined) {
          if (position <= 10 && (await grantIfUnowned(userId, 'rank_top10', position))) {
            granted++;
          }
          if (position <= 3 && (await grantIfUnowned(userId, 'rank_podium', position))) {
            granted++;
          }
          if (position === 1 && (await grantIfUnowned(userId, 'rank_king', position))) {
            granted++;
          }

          // Save weekly snapshot for Consistent tracking
          await WeeklyRankSnapshot.findOneAndUpdate(
            { userId, weekStart },
            { userId, weekStart, position },
            { upsert: true }
          );
        }

        // 4. Consistent — top 25 for 4 consecutive weeks
        const snapshots = await WeeklyRankSnapshot.find({ userId })
          .sort({ weekStart: -1 })
          .limit(4)
          .lean();

        if (
          snapshots.length === 4 &&
          snapshots.every((s) => s.position <= 25)
        ) {
          // Verify they are truly 4 consecutive weeks apart
          const sorted = snapshots.map((s) => s.weekStart.getTime()).sort((a, b) => b - a);
          const allConsecutive = sorted.every((ts, i) => {
            if (i === 0) return true;
            return sorted[i - 1] - ts === 7 * 24 * 60 * 60 * 1000;
          });
          if (allConsecutive && (await grantIfUnowned(userId, 'rank_consistent'))) {
            granted++;
          }
        }
      } catch (err) {
        console.error(`[cron:weekly] Error for user ${userId}:`, err);
      }
    }

    console.log(`🏆 [cron:weekly] Done — ${granted} achievements granted.`);
  } catch (err) {
    console.error('[cron:weekly] Achievement cron failed:', err);
  }
}

// ─── Scheduler Initializer ───────────────────────────────────────────────────

export function initAchievementCronScheduler(): void {
  // Daily at 00:30 UTC
  new CronJob(
    '30 0 * * *',
    () => {
      runDailyCronAchievements().catch((e) =>
        console.error('Daily achievement cron error:', e)
      );
    },
    null,
    true,
    'UTC'
  );

  // Weekly every Monday at 01:00 UTC
  new CronJob(
    '0 1 * * 1',
    () => {
      runWeeklyCronAchievements().catch((e) =>
        console.error('Weekly achievement cron error:', e)
      );
    },
    null,
    true,
    'UTC'
  );

  console.log('🏆 Achievement cron jobs scheduled (daily 00:30 UTC, weekly Mon 01:00 UTC)');
}

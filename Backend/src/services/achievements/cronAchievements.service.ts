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
 *            Clockwork (same hour every day for 14 consecutive days)
 *            No Days Off (logged on Christmas + New Year + account anniversary)
 *   Weekly:  Weekend Warrior (every Sat+Sun for 4 consecutive weekends)
 *            Monday Motivation (10 consecutive Mondays)
 *            Top 10 / Podium / King / Consistent (weekly leaderboard snapshot)
 *   Monthly: Full Immersion (final check: logged every day of the last calendar month)
 *
 * The jobs themselves are scheduled in UTC, but every per-user calendar question
 * ("which day is this log on", "was that a Saturday", "same hour each day") is
 * answered in that user's own timezone — see getUserDayKey. The weekly
 * leaderboard window stays UTC on purpose: it is a single global contest week.
 */

import { CronJob } from 'cron';
import { Types } from 'mongoose';
import User from '../../models/user.model.js';
import Log from '../../models/log.model.js';
import Achievement from '../../models/achievement.model.js';
import UserAchievement from '../../models/userAchievement.model.js';
import WeeklyRankSnapshot from '../../models/weeklyRankSnapshot.model.js';
import { recordCurrentRankSnapshot } from '../rankSnapshot.service.js';
import { getUserDayKey, getUTCDateFromDayKey } from '../streaks.js';
import { isValidTimezone } from '../../constants/timezone.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** A user's timezone, or UTC when unset/invalid (Mongo rejects unknown zones). */
function resolveTimezone(timezone?: string): string {
  return timezone && isValidTimezone(timezone) ? timezone : 'UTC';
}

/** Shift a 'YYYY-MM-DD' key by n days (day keys are anchored at UTC midnight). */
function shiftDayKey(dayKey: string, days: number): string {
  const d = getUTCDateFromDayKey(dayKey);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Weekday of a day key, 0=Sun … 6=Sat. */
function dayKeyWeekday(dayKey: string): number {
  return getUTCDateFromDayKey(dayKey).getUTCDay();
}

/**
 * Distinct day keys (in the user's timezone) the user logged on, within a UTC
 * range. The range is padded by a day on each side by callers so logs that fall
 * into the target local days from a neighbouring UTC day aren't missed.
 */
async function getLoggedDayKeys(
  userId: Types.ObjectId,
  timezone: string,
  start: Date,
  end: Date
): Promise<Set<string>> {
  const rows = await Log.aggregate<{ _id: string }>([
    {
      $match: {
        user: userId,
        date: { $gte: start, $lt: end },
        unknownDate: { $ne: true },
      },
    },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$date', timezone } },
      },
    },
  ]);
  return new Set(rows.map((r) => r._id));
}

/** Widen a day-key range into the UTC instants that can possibly contain it. */
function paddedUtcRange(startKey: string, endKey: string): [Date, Date] {
  const start = getUTCDateFromDayKey(shiftDayKey(startKey, -1));
  const end = getUTCDateFromDayKey(shiftDayKey(endKey, 2));
  return [start, end];
}

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

interface CronUser {
  _id: Types.ObjectId;
  createdAt: Date;
  timezone: string;
}

/** Return all active users (non-banned) with the fields the checks need. */
async function getActiveUsers(): Promise<CronUser[]> {
  const users = await User.find({
    $or: [
      { 'moderation.rankingBanned': { $exists: false } },
      { 'moderation.rankingBanned': false },
    ],
  })
    .select('_id createdAt settings.timezone')
    .lean();

  return users.map((u) => ({
    _id: u._id as Types.ObjectId,
    createdAt: u.createdAt as Date,
    timezone: resolveTimezone(u.settings?.timezone),
  }));
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
 * Check whether the user has logged on every day of the LAST calendar month,
 * as that month is experienced in the user's timezone.
 */
async function checkFullImmersionMonth(
  userId: Types.ObjectId,
  year: number,
  month: number, // 1-indexed
  timezone: string
): Promise<boolean> {
  const total = daysInMonth(year, month);
  const monthPrefix = `${year}-${String(month).padStart(2, '0')}-`;
  const firstKey = `${monthPrefix}01`;
  const lastKey = `${monthPrefix}${String(total).padStart(2, '0')}`;

  const [start, end] = paddedUtcRange(firstKey, lastKey);
  const loggedKeys = await getLoggedDayKeys(userId, timezone, start, end);

  let daysLogged = 0;
  for (const key of loggedKeys) {
    if (key.startsWith(monthPrefix)) daysLogged++;
  }

  return daysLogged >= total;
}

/**
 * CLOCKWORK
 * Every day for the last 14 consecutive calendar days (in the user's timezone),
 * user must have logged, and all their logs must cluster within a ±1h local
 * window (same daily habit).
 */
async function checkClockwork14Days(
  userId: Types.ObjectId,
  timezone: string
): Promise<boolean> {
  const todayKey = getUserDayKey(new Date(), timezone);
  const startKey = shiftDayKey(todayKey, -13);
  const [start, end] = paddedUtcRange(startKey, todayKey);

  const dailyHours = await Log.aggregate<{
    _id: string;
    hours: number[];
  }>([
    {
      $match: {
        user: userId,
        date: { $gte: start, $lt: end },
        unknownDate: { $ne: true },
      },
    },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$date', timezone } },
        hours: { $addToSet: { $hour: { date: '$date', timezone } } },
      },
    },
  ]);

  // Every one of the 14 local days must have a log (the padded query can also
  // return days just outside the window, so check the keys rather than count)
  const byKey = new Map(dailyHours.map((d) => [d._id, d.hours]));
  const windowKeys = Array.from({ length: 14 }, (_, i) =>
    shiftDayKey(startKey, i)
  );
  if (!windowKeys.every((key) => byKey.has(key))) return false;

  // Collect all hours logged across the 14 days
  const allHours = windowKeys.flatMap((key) => byKey.get(key) ?? []);
  const minH = Math.min(...allHours);
  const maxH = Math.max(...allHours);

  // Allow wrap-around (e.g. 23:xx and 00:xx are 1h apart)
  const spread = Math.min(maxH - minH, 24 - (maxH - minH));
  return spread <= 2; // within a 2-hour window across all days
}

/**
 * WEEKEND WARRIOR
 * User must have logged on every Saturday AND Sunday for the last 4 weekends,
 * with weekends resolved against the user's own calendar.
 * We look back 28 days and find the 4 most recent complete weekends.
 */
async function checkWeekendWarrior(
  userId: Types.ObjectId,
  timezone: string
): Promise<boolean> {
  const todayKey = getUserDayKey(new Date(), timezone);

  // Most recent Saturday, skipping today if today is Saturday (0=Sun … 6=Sat)
  const weekday = dayKeyWeekday(todayKey);
  const daysToLastSat = weekday === 6 ? 7 : weekday + 1;
  const lastSatKey = shiftDayKey(todayKey, -daysToLastSat);

  // Oldest day we need is the Saturday 3 weeks before that
  const oldestKey = shiftDayKey(lastSatKey, -21);
  const [start, end] = paddedUtcRange(oldestKey, todayKey);
  const loggedSet = await getLoggedDayKeys(userId, timezone, start, end);

  // Walk back through the last 4 weekends (Sat + Sun pairs)
  for (let w = 0; w < 4; w++) {
    const satKey = shiftDayKey(lastSatKey, -7 * w);
    const sunKey = shiftDayKey(satKey, 1);
    if (!loggedSet.has(satKey) || !loggedSet.has(sunKey)) return false;
  }

  return true;
}

/** How many weeks of history the Monday check scans. */
const MONDAY_LOOKBACK_WEEKS = 16;

/**
 * MONDAY MOTIVATION
 * 10 consecutive Mondays with at least one log each, Mondays being the user's
 * local Mondays.
 *
 * The lookback is deliberately longer than the 10 weeks required: this job runs
 * at 01:00 UTC on a Monday, so the current Monday is almost never logged yet. A
 * 10-week window would have demanded a log from a Monday that had barely begun,
 * making the achievement unobtainable — so scan further back and look for any
 * run of 10 consecutive Mondays inside the window.
 */
async function checkMondayMotivation(
  userId: Types.ObjectId,
  timezone: string
): Promise<boolean> {
  const todayKey = getUserDayKey(new Date(), timezone);
  const startKey = shiftDayKey(todayKey, -(MONDAY_LOOKBACK_WEEKS * 7));
  const [start, end] = paddedUtcRange(startKey, todayKey);

  const loggedSet = await getLoggedDayKeys(userId, timezone, start, end);

  const mondayKeys = Array.from(loggedSet)
    .filter((key) => key >= startKey && key <= todayKey)
    .filter((key) => dayKeyWeekday(key) === 1)
    .sort(); // oldest first

  if (mondayKeys.length < 10) return false;

  // Longest run of Mondays exactly 7 days apart
  let run = 1;
  for (let i = 1; i < mondayKeys.length; i++) {
    run = shiftDayKey(mondayKeys[i - 1], 7) === mondayKeys[i] ? run + 1 : 1;
    if (run >= 10) return true;
  }
  return false;
}

/**
 * NO DAYS OFF
 * Has the user logged on all three of: Christmas (12-25), New Year (01-01), and account anniversary?
 * We check historically (any year), and the anniversary is the account creation month+day.
 */
async function checkNoDaysOff(
  userId: Types.ObjectId,
  accountCreatedAt: Date,
  timezone: string
): Promise<boolean> {
  const checkDate = async (month: number, day: number) => {
    const doc = await Log.findOne({
      user: userId,
      unknownDate: { $ne: true },
      $expr: {
        $and: [
          { $eq: [{ $month: { date: '$date', timezone } }, month] },
          { $eq: [{ $dayOfMonth: { date: '$date', timezone } }, day] },
        ],
      },
    })
      .select('_id')
      .lean();
    return !!doc;
  };

  const christmasLogged = await checkDate(12, 25);
  const newYearLogged = await checkDate(1, 1);
  // Anniversary is the signup date as the user saw it, not as UTC saw it
  const [, annivMonth, annivDay] = getUserDayKey(accountCreatedAt, timezone)
    .split('-')
    .map(Number);
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
    const users = await getActiveUsers();
    let granted = 0;

    const now = new Date();

    for (const { _id: userId, createdAt, timezone } of users) {
      try {
        // Which month is "last month" depends on where the user is: the job runs
        // at 00:30 UTC, which is still the previous day/month for some users.
        const [localYear, localMonth, localDay] = getUserDayKey(now, timezone)
          .split('-')
          .map(Number);
        const prevMonth = localMonth === 1 ? 12 : localMonth - 1;
        const prevMonthYear = localMonth === 1 ? localYear - 1 : localYear;
        const isLastDayOfMonth = localDay === daysInMonth(localYear, localMonth);

        // 1. Full Immersion — check previous month (always) and current month if last day
        const monthsToCheck = [{ year: prevMonthYear, month: prevMonth }];
        if (isLastDayOfMonth) {
          monthsToCheck.push({ year: localYear, month: localMonth });
        }
        for (const { year, month } of monthsToCheck) {
          if (await checkFullImmersionMonth(userId, year, month, timezone)) {
            if (await grantIfUnowned(userId, 'full_immersion_month')) {
              granted++;
            }
          }
        }

        // 2. Clockwork — check last 14 days
        if (await checkClockwork14Days(userId, timezone)) {
          if (await grantIfUnowned(userId, 'clockwork')) {
            granted++;
          }
        }

        // 3. No Days Off
        if (await checkNoDaysOff(userId, createdAt, timezone)) {
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
    const users = await getActiveUsers();
    let granted = 0;

    // Compute current weekly leaderboard (a single global UTC week for everyone)
    const leaderboard = await computeWeeklyLeaderboard();
    const weekStart = utcDayBoundary(-(new Date().getUTCDay()));

    for (const { _id: userId, timezone } of users) {
      try {
        // 1. Weekend Warrior
        if (await checkWeekendWarrior(userId, timezone)) {
          if (await grantIfUnowned(userId, 'weekend_warrior')) {
            granted++;
          }
        }

        // 2. Monday Motivation
        if (await checkMondayMotivation(userId, timezone)) {
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

    // Record global + monthly rank snapshot for the ranking-over-time graph
    try {
      const count = await recordCurrentRankSnapshot();
      console.log(`📈 [cron:weekly] Recorded ${count} rank snapshots.`);
    } catch (err) {
      console.error('[cron:weekly] Rank snapshot failed:', err);
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

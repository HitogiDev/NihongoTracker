/**
 * Achievement Cron Service
 * Handles achievements that require periodic evaluation instead of per-log checking.
 *
 * Schedule:
 *   runDailyCronAchievements  — runs once per day (00:30 UTC)
 *   runWeeklyCronAchievements — runs every Sunday at 01:00 UTC, scoring the
 *                               Sunday→Saturday week that just closed
 *
 * Cron-based achievements covered:
 *   Daily:   Full Immersion (logged every day this month so far)
 *            Clockwork (same hour every day for 14 consecutive days)
 *            No Days Off (logged on Christmas + New Year + account anniversary)
 *   Weekly:  Weekend Warrior (every Sat+Sun for 4 consecutive weekends)
 *            Monday Motivation (10 consecutive Mondays)
 *            Top 10 / Podium / King / Consistent (weekly leaderboard snapshot)
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
 * The week the weekly cron reports on: the last *completed* Sunday→Saturday
 * week, as [weekStart, weekEnd) in UTC.
 *
 * The job fires Monday 01:00 UTC, so the Sunday boundary nearest "now" is the
 * start of the week that just began — ranking that window would score ~25h of
 * logs instead of the week users actually competed in. Step back one week.
 */
function lastCompletedWeek(): { weekStart: Date; weekEnd: Date } {
  const weekEnd = utcDayBoundary(-(new Date().getUTCDay())); // Sunday 00:00 UTC
  const weekStart = new Date(weekEnd.getTime() - 7 * 24 * 60 * 60 * 1000);
  return { weekStart, weekEnd };
}

/**
 * LEADERBOARD RANK
 * Compute the weekly XP leaderboard over [weekStart, weekEnd) and return each
 * user's position. Returns a Map<userId_string, position> (1-based).
 */
async function computeWeeklyLeaderboard(
  weekStart: Date,
  weekEnd: Date
): Promise<Map<string, number>> {
  const ranked = await Log.aggregate<{ _id: Types.ObjectId; totalXp: number }>([
    {
      $match: {
        date: { $gte: weekStart, $lt: weekEnd },
        private: { $ne: true },
        unknownDate: { $ne: true },
      },
    },
    { $group: { _id: '$user', totalXp: { $sum: '$xp' } } },
    // Ranking-banned users must not occupy a slot — leaving them in shifts every
    // legitimate user one position down and can push #11 out of the top 10.
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
    { $sort: { totalXp: -1 } },
    { $project: { _id: 1, totalXp: 1 } },
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

// ─── Weekly Rank Awards ──────────────────────────────────────────────────────

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Grant the leaderboard achievements for one completed week and record every
 * ranked user's snapshot. Shared by the weekly cron and the retroactive
 * backfill so both score a week exactly the same way.
 *
 * Only users in `eligibleUserIds` (non-banned, still existing) can be awarded,
 * but the leaderboard positions themselves come from the full week's logs.
 */
async function awardWeeklyRanks(
  weekStart: Date,
  weekEnd: Date,
  eligibleUserIds: Set<string>
): Promise<number> {
  const leaderboard = await computeWeeklyLeaderboard(weekStart, weekEnd);
  let granted = 0;

  for (const [userIdString, position] of leaderboard) {
    if (!eligibleUserIds.has(userIdString)) continue;
    const userId = new Types.ObjectId(userIdString);

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

  return granted;
}

/**
 * Consistent — top 25 for 4 consecutive weeks. Scans the user's whole snapshot
 * history rather than only the latest 4: the achievement records something the
 * user *did*, so a qualifying run stays earned even after they drop off.
 */
async function checkRankConsistent(userId: Types.ObjectId): Promise<boolean> {
  const snapshots = await WeeklyRankSnapshot.find({ userId })
    .select('weekStart position')
    .sort({ weekStart: 1 })
    .lean();

  let run = 0;
  let previousWeek: number | null = null;

  for (const snapshot of snapshots) {
    const week = snapshot.weekStart.getTime();
    const isConsecutive = previousWeek !== null && week - previousWeek === WEEK_MS;

    if (snapshot.position <= 25) {
      run = isConsecutive ? run + 1 : 1;
    } else {
      run = 0;
    }
    previousWeek = week;

    if (run >= 4) return true;
  }

  return false;
}

/** The UTC Sunday 00:00 on/before the given date. */
function sundayOfUtc(date: Date): Date {
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return d;
}

/**
 * Replay every completed Sunday→Saturday week and grant the leaderboard
 * achievements the weekly cron should have given at the time.
 *
 * Needed because the cron used to score the wrong window (it ranked the ~25h of
 * the week that had just *started* rather than the week that had just ended),
 * so users who genuinely finished a week in the top 10 were never awarded.
 *
 * Idempotent — grants go through grantIfUnowned and snapshots are upserted, so
 * this is safe to re-run and will not re-award anything already held.
 */
export async function backfillRankAchievements(options?: {
  onWeek?: (info: { weekStart: Date; index: number; total: number }) => void;
}): Promise<{ weeks: number; granted: number }> {
  const users = await getActiveUsers();
  const eligible = new Set(users.map((u) => u._id.toString()));

  const [firstLog] = await Log.aggregate<{ first: Date }>([
    { $match: { private: { $ne: true }, unknownDate: { $ne: true } } },
    { $group: { _id: null, first: { $min: '$date' } } },
  ]);
  if (!firstLog?.first) return { weeks: 0, granted: 0 };

  // The in-progress week is not scored — only weeks that have fully closed.
  const { weekEnd: openWeekStart } = lastCompletedWeek();

  const MAX_WEEKS = 520; // ~10 years — bounds work and ignores mis-dated old logs
  let cursor = sundayOfUtc(new Date(firstLog.first));
  const spanWeeks =
    Math.floor((openWeekStart.getTime() - cursor.getTime()) / WEEK_MS) + 1;
  if (spanWeeks > MAX_WEEKS) {
    cursor = new Date(openWeekStart.getTime() - MAX_WEEKS * WEEK_MS);
  }

  const total = Math.max(
    0,
    Math.floor((openWeekStart.getTime() - cursor.getTime()) / WEEK_MS)
  );

  let weeks = 0;
  let granted = 0;

  while (cursor.getTime() < openWeekStart.getTime()) {
    const weekEnd = new Date(cursor.getTime() + WEEK_MS);
    granted += await awardWeeklyRanks(cursor, weekEnd, eligible);
    weeks++;
    options?.onWeek?.({ weekStart: cursor, index: weeks, total });
    cursor = weekEnd;
  }

  // Consistent depends on the full snapshot history, so evaluate it only once
  // every week has been replayed.
  for (const { _id: userId } of users) {
    if (await checkRankConsistent(userId)) {
      if (await grantIfUnowned(userId, 'rank_consistent')) granted++;
    }
  }

  return { weeks, granted };
}

// ─── Weekly Cron ─────────────────────────────────────────────────────────────

export async function runWeeklyCronAchievements(): Promise<void> {
  try {
    console.log('🏆 [cron:weekly] Starting weekly achievement checks...');
    const users = await getActiveUsers();
    let granted = 0;

    // Rank the week that just closed (a single global UTC week for everyone).
    // The snapshot is keyed to that week's Sunday, not to "now".
    const { weekStart, weekEnd } = lastCompletedWeek();
    granted += await awardWeeklyRanks(
      weekStart,
      weekEnd,
      new Set(users.map((u) => u._id.toString()))
    );

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

        // 3. Consistent — top 25 for 4 consecutive weeks
        //    (rank_top10/podium/king were already granted by awardWeeklyRanks)
        if (await checkRankConsistent(userId)) {
          if (await grantIfUnowned(userId, 'rank_consistent')) {
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

  // Weekly every Sunday at 01:00 UTC — one hour after the Sunday→Saturday week
  // closes, so the leaderboard result lands while it is still fresh.
  new CronJob(
    '0 1 * * 0',
    () => {
      runWeeklyCronAchievements().catch((e) =>
        console.error('Weekly achievement cron error:', e)
      );
    },
    null,
    true,
    'UTC'
  );

  console.log('🏆 Achievement cron jobs scheduled (daily 00:30 UTC, weekly Sun 01:00 UTC)');
}

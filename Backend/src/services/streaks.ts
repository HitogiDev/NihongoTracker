import User from '../models/user.model.js';
import Log from '../models/log.model.js';
import { Types } from 'mongoose';

const FALLBACK_TIMEZONE = 'UTC';

export function getUserDayKey(date: Date, timezone: string): string {
  // Use Intl parts to avoid locale formatting surprises
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const y = parts.find((p) => p.type === 'year')?.value;
  const m = parts.find((p) => p.type === 'month')?.value;
  const d = parts.find((p) => p.type === 'day')?.value;
  return `${y}-${m}-${d}`; // YYYY-MM-DD
}

export function getUTCDateFromDayKey(dayKey: string): Date {
  const [y, m, d] = dayKey.split('-').map((n) => parseInt(n, 10));
  // Create a UTC midnight moment for the day key
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
}

function getDayKeyFromUTCDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function dayDiff(aKey: string, bKey: string): number {
  const a = getUTCDateFromDayKey(aKey).getTime();
  const b = getUTCDateFromDayKey(bKey).getTime();
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((b - a) / msPerDay);
}

export async function recalculateStreaksForUser(
  userId: Types.ObjectId
): Promise<void> {
  const user = await User.findById(userId);
  if (!user || !user.stats) return;

  const timezone = user.settings?.timezone || FALLBACK_TIMEZONE;

  // Exclude unknownDate logs — they have no real date to streak on
  const logs = await Log.find({
    user: user._id,
    unknownDate: { $ne: true },
  }).sort({ date: 1 });

  if (!logs.length) {
    user.stats.currentStreak = 0;
    user.stats.longestStreak = Math.max(user.stats.longestStreak || 0, 0);
    user.stats.lastStreakDate = null;
    await user.save();
    return;
  }

  // Build unique SORTED set of user-day keys.
  // Use a Set first (handles non-adjacent duplicates caused by UTC sort vs user-tz
  // day-boundary mismatch), then sort lexicographically (YYYY-MM-DD sorts correctly).
  const dayKeySet = new Set<string>();
  for (const log of logs) {
    dayKeySet.add(getUserDayKey(new Date(log.date), timezone));
  }
  const dayKeys = Array.from(dayKeySet).sort();

  let current = 0;
  let longest = 0;
  for (let i = 0; i < dayKeys.length; i++) {
    if (i === 0) {
      current = 1;
      longest = 1;
    } else {
      const diff = dayDiff(dayKeys[i - 1], dayKeys[i]);
      if (diff === 1) {
        current += 1;
      } else if (diff > 1) {
        current = 1;
      }
      // diff === 0 cannot occur — Set guarantees uniqueness
      if (current > longest) longest = current;
    }
  }

  // Check if streak is still active: lastKey must be today or yesterday in user tz.
  // If the last log was 2+ days ago the streak is broken — zero currentStreak so
  // the stored value doesn't lie when read back without a live check.
  const todayKey = getUserDayKey(new Date(), timezone);
  const lastKey = dayKeys[dayKeys.length - 1];
  const diffFromToday = dayDiff(lastKey, todayKey);
  if (diffFromToday > 1) {
    current = 0;
  }

  user.stats.currentStreak = current;
  // Use the recalculated value directly — recalc has ground truth from all remaining logs.
  // Math.max would prevent longestStreak from decreasing after log deletions.
  user.stats.longestStreak = longest;
  user.stats.lastStreakDate = getUTCDateFromDayKey(lastKey);
  await user.save();
}

/**
 * Returns the live current streak, accounting for a potentially stale lastStreakDate.
 * Use this at read-time so users who stopped logging but haven't triggered a recalc
 * don't see a falsely non-zero streak.
 */
export function getLiveCurrentStreak(
  currentStreak: number,
  lastStreakDate: Date | null,
  timezone: string
): number {
  if (!lastStreakDate || currentStreak <= 0) return 0;
  const lastKey = getDayKeyFromUTCDate(new Date(lastStreakDate));
  const todayKey = getUserDayKey(new Date(), timezone);
  const diff = dayDiff(lastKey, todayKey);
  // Streak active if last log was today (0) or yesterday (1)
  return diff <= 1 ? currentStreak : 0;
}

// Incremental update on new log; falls back to full recalc for backfill/out-of-order
export async function updateStreakWithLog(
  userId: Types.ObjectId,
  logDate: Date
): Promise<void> {
  const user = await User.findById(userId);
  if (!user || !user.stats) return;
  const timezone = user.settings?.timezone || FALLBACK_TIMEZONE;
  const newKey = getUserDayKey(new Date(logDate), timezone);
  const todayKey = getUserDayKey(new Date(), timezone);

  // Reject future-dated logs from advancing the streak (clock drift / bad client date)
  if (newKey > todayKey) return;

  const lastDate = user.stats.lastStreakDate;
  if (!lastDate) {
    user.stats.currentStreak = 1;
    user.stats.longestStreak = Math.max(user.stats.longestStreak || 0, 1);
    user.stats.lastStreakDate = getUTCDateFromDayKey(newKey);
    await user.save();
    return;
  }

  // lastStreakDate stores a UTC day key anchor; read it back in UTC to avoid timezone day shifts
  const lastKey = getDayKeyFromUTCDate(new Date(lastDate));
  const diff = dayDiff(lastKey, newKey);

  if (diff === 0) {
    // Same day — nothing to change, ensure anchor is up to date
    user.stats.lastStreakDate = getUTCDateFromDayKey(newKey);
    await user.save();
    return;
  }

  if (diff === 1) {
    // Validate stored currentStreak isn't stale first
    const liveCurrent = getLiveCurrentStreak(
      user.stats.currentStreak,
      lastDate,
      timezone
    );
    user.stats.currentStreak = liveCurrent + 1;
  } else {
    // diff > 1: the new log is not adjacent to lastStreakDate, or
    // diff < 0: backfill/out-of-order.
    // Either way, the incremental path can't determine the correct streak
    // without examining all logs — fall back to full recalc.
    await recalculateStreaksForUser(user._id);
    return;
  }

  if (user.stats.currentStreak > (user.stats.longestStreak || 0)) {
    user.stats.longestStreak = user.stats.currentStreak;
  }
  user.stats.lastStreakDate = getUTCDateFromDayKey(newKey);
  await user.save();
}

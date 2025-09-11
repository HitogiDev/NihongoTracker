import User from '../models/user.model.js';
import Log from '../models/log.model.js';
import { Types } from 'mongoose';

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

  const timezone = user.settings?.timezone || 'UTC';
  const logs = await Log.find({ user: user._id }).sort({ date: 1 });
  if (!logs.length) {
    user.stats.currentStreak = 0;
    user.stats.longestStreak = Math.max(user.stats.longestStreak || 0, 0);
    user.stats.lastStreakDate = null;
    await user.save();
    return;
  }

  // Build unique ordered set of user-day keys
  const dayKeys: string[] = [];
  let lastKey: string | null = null;
  for (const log of logs) {
    const key = getUserDayKey(new Date(log.date), timezone);
    if (lastKey !== key) {
      dayKeys.push(key);
      lastKey = key;
    }
  }

  let current = 0;
  let longest = 0;
  for (let i = 0; i < dayKeys.length; i++) {
    if (i === 0) {
      current = 1;
      longest = 1;
    } else {
      const diff = dayDiff(dayKeys[i - 1], dayKeys[i]);
      if (diff === 0) {
        // same day already deduped, should not occur
      } else if (diff === 1) {
        current += 1;
      } else {
        current = 1;
      }
      if (current > longest) longest = current;
    }
  }

  user.stats.currentStreak = current;
  user.stats.longestStreak = Math.max(user.stats.longestStreak || 0, longest);
  user.stats.lastStreakDate = getUTCDateFromDayKey(dayKeys[dayKeys.length - 1]);
  await user.save();
}

// Incremental update on new log; falls back to full recalc for non-sequential/backfill cases
export async function updateStreakWithLog(
  userId: Types.ObjectId,
  logDate: Date
): Promise<void> {
  const user = await User.findById(userId);
  if (!user || !user.stats) return;
  const timezone = user.settings?.timezone || 'UTC';
  const newKey = getUserDayKey(new Date(logDate), timezone);

  const lastDate = user.stats.lastStreakDate;
  if (!lastDate) {
    user.stats.currentStreak = 1;
    user.stats.longestStreak = Math.max(user.stats.longestStreak || 0, 1);
    user.stats.lastStreakDate = getUTCDateFromDayKey(newKey);
    await user.save();
    return;
  }

  const lastKey = getUserDayKey(new Date(lastDate), timezone);
  const diff = dayDiff(lastKey, newKey);

  if (diff === 0) {
    // same day, nothing to change, but ensure lastStreakDate is set to that day
    user.stats.lastStreakDate = getUTCDateFromDayKey(newKey);
    await user.save();
    return;
  }

  if (diff === 1) {
    user.stats.currentStreak += 1;
  } else if (diff > 1) {
    // gap
    user.stats.currentStreak = 1;
  } else {
    // backfill or out-of-order, run full recalc
    await recalculateStreaksForUser(user._id);
    return;
  }

  if (user.stats.currentStreak > (user.stats.longestStreak || 0)) {
    user.stats.longestStreak = user.stats.currentStreak;
  }
  user.stats.lastStreakDate = getUTCDateFromDayKey(newKey);
  await user.save();
}

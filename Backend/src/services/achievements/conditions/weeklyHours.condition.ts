import { Types } from 'mongoose';
import Log from '../../../models/log.model.js';

/**
 * Checks whether the user has logged threshold hours within any rolling 7-day window.
 * Used for "Did You Sleep?" (24h in a single week).
 *
 * Strategy:
 *  1. Aggregate total minutes per calendar day.
 *  2. Slide a 7-day window over all logged days and find the max sum.
 */
export async function evaluateWeeklyHours(
  userId: Types.ObjectId,
  threshold: number,
  timezone = 'UTC'
): Promise<{ met: boolean; progress: number }> {
  const dailyTotals = await Log.aggregate<{
    _id: string;
    totalMinutes: number;
  }>([
    // unknownDate logs have a placeholder date — they don't belong to any real week
    { $match: { user: userId, time: { $gt: 0 }, unknownDate: { $ne: true } } },
    {
      $group: {
        // Day buckets follow the user's timezone, not UTC
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$date', timezone },
        },
        totalMinutes: { $sum: '$time' },
      },
    },
    // 'YYYY-MM-DD' strings sort chronologically
    { $sort: { _id: 1 } },
  ]);

  if (dailyTotals.length === 0) return { met: false, progress: 0 };

  // Convert each bucket to a Date + minutes pair for the sliding window. Day keys
  // are anchored at UTC midnight so every day is exactly 24h apart — using local
  // Date construction would make DST days 23h/25h and shift the window edge.
  const days = dailyTotals.map((d) => {
    const [y, m, day] = d._id.split('-').map(Number);
    return {
      date: Date.UTC(y, m - 1, day),
      minutes: d.totalMinutes,
    };
  });

  let maxHours = 0;
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

  let windowStart = 0;
  let windowMinutes = 0;

  for (let i = 0; i < days.length; i++) {
    windowMinutes += days[i].minutes;

    // Shrink window from the left while it exceeds 7 days
    while (days[i].date - days[windowStart].date >= SEVEN_DAYS_MS) {
      windowMinutes -= days[windowStart].minutes;
      windowStart++;
    }

    const windowHours = Math.floor(windowMinutes / 60);
    if (windowHours > maxHours) maxHours = windowHours;
  }

  return { met: maxHours >= threshold, progress: maxHours };
}

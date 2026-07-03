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
  threshold: number
): Promise<{ met: boolean; progress: number }> {
  const dailyTotals = await Log.aggregate<{
    _id: { y: number; m: number; d: number };
    totalMinutes: number;
  }>([
    { $match: { user: userId, time: { $gt: 0 } } },
    {
      $group: {
        _id: {
          y: { $year: '$date' },
          m: { $month: '$date' },
          d: { $dayOfMonth: '$date' },
        },
        totalMinutes: { $sum: '$time' },
      },
    },
    { $sort: { '_id.y': 1, '_id.m': 1, '_id.d': 1 } },
  ]);

  if (dailyTotals.length === 0) return { met: false, progress: 0 };

  // Convert each bucket to a Date + minutes pair for the sliding window
  const days = dailyTotals.map((d) => ({
    date: new Date(d._id.y, d._id.m - 1, d._id.d).getTime(),
    minutes: d.totalMinutes,
  }));

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

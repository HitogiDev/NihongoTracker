import { Types } from 'mongoose';
import Log from '../../../models/log.model.js';

/**
 * Counts logs where the hour of the log date, read in the user's timezone, falls
 * within [startHour, endHour).
 * Used for Night Owl (0-6), Early Bird (5-7), Lunch Break (12-13).
 * threshold = number of such logs needed.
 */
export async function evaluateLogTimeRange(
  userId: Types.ObjectId,
  startHour: number,
  endHour: number,
  threshold: number,
  timezone = 'UTC'
): Promise<{ met: boolean; progress: number }> {
  const result = await Log.aggregate([
    // unknownDate logs carry a placeholder date — they say nothing about when
    // the user actually immersed, so they can't earn time-of-day achievements
    { $match: { user: userId, unknownDate: { $ne: true } } },
    {
      $project: {
        hour: { $hour: { date: '$date', timezone } },
      },
    },
    {
      $match: {
        hour: { $gte: startHour, $lt: endHour },
      },
    },
    { $count: 'total' },
  ]);
  const count = result[0]?.total ?? 0;
  return { met: count >= threshold, progress: count };
}

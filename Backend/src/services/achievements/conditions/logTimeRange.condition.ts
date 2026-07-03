import { Types } from 'mongoose';
import Log from '../../../models/log.model.js';

/**
 * Counts logs where the hour of the log date (UTC) falls within [startHour, endHour).
 * Used for Night Owl (0-6), Early Bird (5-7), Lunch Break (12-13).
 * threshold = number of such logs needed.
 */
export async function evaluateLogTimeRange(
  userId: Types.ObjectId,
  startHour: number,
  endHour: number,
  threshold: number
): Promise<{ met: boolean; progress: number }> {
  const result = await Log.aggregate([
    { $match: { user: userId } },
    {
      $project: {
        hour: { $hour: '$date' },
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

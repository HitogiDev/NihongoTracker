import { Types } from 'mongoose';
import Log from '../../../models/log.model.js';

/**
 * Finds the maximum hours logged in any single calendar day, using the user's
 * timezone to decide where each day starts and ends.
 * Used for the Marathon achievement (10+ hours in a day).
 */
export async function evaluateSingleDayHours(
  userId: Types.ObjectId,
  threshold: number,
  timezone = 'UTC'
): Promise<{ met: boolean; progress: number }> {
  const result = await Log.aggregate([
    // unknownDate logs have a placeholder date — they don't belong to any real day
    { $match: { user: userId, time: { $gt: 0 }, unknownDate: { $ne: true } } },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$date', timezone },
        },
        totalMinutes: { $sum: '$time' },
      },
    },
    {
      $project: {
        totalHours: { $floor: { $divide: ['$totalMinutes', 60] } },
      },
    },
    { $sort: { totalHours: -1 } },
    { $limit: 1 },
  ]);
  const maxHours = result[0]?.totalHours ?? 0;
  return { met: maxHours >= threshold, progress: maxHours };
}

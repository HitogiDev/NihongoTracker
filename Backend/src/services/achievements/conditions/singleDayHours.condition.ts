import { Types } from 'mongoose';
import Log from '../../../models/log.model.js';

/**
 * Finds the maximum hours logged in any single calendar day.
 * Used for the Marathon achievement (10+ hours in a day).
 */
export async function evaluateSingleDayHours(
  userId: Types.ObjectId,
  threshold: number
): Promise<{ met: boolean; progress: number }> {
  const result = await Log.aggregate([
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

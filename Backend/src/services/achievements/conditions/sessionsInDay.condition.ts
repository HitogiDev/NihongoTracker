import { Types } from 'mongoose';
import Log from '../../../models/log.model.js';

/**
 * Finds the maximum number of log sessions in any single calendar day.
 * Used for the Sprinter achievement (5+ sessions in one day).
 */
export async function evaluateSessionsInDay(
  userId: Types.ObjectId,
  threshold: number
): Promise<{ met: boolean; progress: number }> {
  const result = await Log.aggregate([
    { $match: { user: userId } },
    {
      $group: {
        _id: {
          y: { $year: '$date' },
          m: { $month: '$date' },
          d: { $dayOfMonth: '$date' },
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 } },
    { $limit: 1 },
  ]);
  const maxSessions = result[0]?.count ?? 0;
  return { met: maxSessions >= threshold, progress: maxSessions };
}

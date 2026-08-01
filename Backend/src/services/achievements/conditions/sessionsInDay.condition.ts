import { Types } from 'mongoose';
import Log from '../../../models/log.model.js';

/**
 * Finds the maximum number of log sessions in any single calendar day, using the
 * user's timezone to decide where each day starts and ends.
 * Used for the Sprinter achievement (5+ sessions in one day).
 */
export async function evaluateSessionsInDay(
  userId: Types.ObjectId,
  threshold: number,
  timezone = 'UTC'
): Promise<{ met: boolean; progress: number }> {
  const result = await Log.aggregate([
    // unknownDate logs have a placeholder date — they don't belong to any real day
    { $match: { user: userId, unknownDate: { $ne: true } } },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$date', timezone },
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

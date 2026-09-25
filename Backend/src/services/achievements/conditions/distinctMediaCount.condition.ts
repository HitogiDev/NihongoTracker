import { Types } from 'mongoose';
import Log from '../../../models/log.model.js';

/**
 * Counts how many distinct titles the user has logged.
 * Used for Century Club (100 different titles).
 *
 * Logs with no linked media (free-form entries) can't be told apart, so they
 * are skipped rather than each counting as a title.
 */
export async function evaluateDistinctMediaCount(
  userId: Types.ObjectId,
  threshold: number
): Promise<{ met: boolean; progress: number }> {
  const result = await Log.aggregate<{ total: number }>([
    { $match: { user: userId, mediaId: { $nin: [null, ''] } } },
    { $group: { _id: { mediaId: '$mediaId', type: '$type' } } },
    { $count: 'total' },
  ]);

  const count = result[0]?.total ?? 0;
  return { met: count >= threshold, progress: count };
}

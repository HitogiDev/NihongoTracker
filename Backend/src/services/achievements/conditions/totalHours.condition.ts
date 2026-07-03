import { Types } from 'mongoose';
import Log from '../../../models/log.model.js';

/**
 * Sums all logged time (in minutes) across all of a user's logs
 * and checks whether total hours >= threshold.
 */
export async function evaluateTotalHours(
  userId: Types.ObjectId,
  threshold: number
): Promise<{ met: boolean; progress: number }> {
  const result = await Log.aggregate([
    { $match: { user: userId, time: { $gt: 0 } } },
    { $group: { _id: null, totalMinutes: { $sum: '$time' } } },
  ]);
  const totalMinutes = result[0]?.totalMinutes ?? 0;
  const totalHours = Math.floor(totalMinutes / 60);
  return { met: totalHours >= threshold, progress: totalHours };
}

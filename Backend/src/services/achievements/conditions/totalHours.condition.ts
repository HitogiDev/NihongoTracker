import { Types } from 'mongoose';
import Log from '../../../models/log.model.js';
import {
  EFFECTIVE_MINUTES_EXPR,
  HAS_EFFECTIVE_TIME_MATCH,
} from './effectiveMinutes.js';

/**
 * Sums all logged time (in minutes) across all of a user's logs
 * and checks whether total hours >= threshold.
 *
 * Episode-only anime logs count as 24 min/episode, exactly as the profile
 * stats do — otherwise the achievement disagrees with the hours the user sees.
 */
export async function evaluateTotalHours(
  userId: Types.ObjectId,
  threshold: number
): Promise<{ met: boolean; progress: number }> {
  const result = await Log.aggregate([
    { $match: { user: userId, ...HAS_EFFECTIVE_TIME_MATCH } },
    { $group: { _id: null, totalMinutes: { $sum: EFFECTIVE_MINUTES_EXPR } } },
  ]);
  const totalMinutes = result[0]?.totalMinutes ?? 0;
  const totalHours = Math.floor(totalMinutes / 60);
  return { met: totalHours >= threshold, progress: totalHours };
}

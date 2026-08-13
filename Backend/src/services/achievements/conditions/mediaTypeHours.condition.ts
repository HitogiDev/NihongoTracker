import { Types } from 'mongoose';
import Log from '../../../models/log.model.js';
import {
  EFFECTIVE_MINUTES_EXPR,
  HAS_EFFECTIVE_TIME_MATCH,
} from './effectiveMinutes.js';

/**
 * Sums logged time (in minutes) for a specific media type
 * and checks whether total hours >= threshold.
 * For 'reading', combines manga + reading + vn for "reading hours" intent.
 *
 * Episode-only anime logs count as 24 min/episode, matching the profile stats.
 */
export async function evaluateMediaTypeHours(
  userId: Types.ObjectId,
  mediaType: string,
  threshold: number
): Promise<{ met: boolean; progress: number }> {
  // Special case: 'reading_combined' groups manga + reading for Bookworm
  const matchTypes =
    mediaType === 'reading_combined'
      ? { $in: ['manga', 'light-novel', 'reading'] }
      : mediaType;

  const result = await Log.aggregate([
    {
      $match: {
        user: userId,
        type: matchTypes,
        ...HAS_EFFECTIVE_TIME_MATCH,
      },
    },
    { $group: { _id: null, totalMinutes: { $sum: EFFECTIVE_MINUTES_EXPR } } },
  ]);
  const totalMinutes = result[0]?.totalMinutes ?? 0;
  const totalHours = Math.floor(totalMinutes / 60);
  return { met: totalHours >= threshold, progress: totalHours };
}

import { Types } from 'mongoose';
import Log from '../../../models/log.model.js';
import {
  EFFECTIVE_MINUTES_EXPR,
  HAS_EFFECTIVE_TIME_MATCH,
} from './effectiveMinutes.js';

/**
 * 夢中 (Absorbed): a single logged session of `threshold` hours or more.
 *
 * One log entry is one session, so this is simply the user's longest single
 * log — unlike singleDayHours, which sums a whole day.
 */
export async function evaluateSingleSessionHours(
  userId: Types.ObjectId,
  threshold: number
): Promise<{ met: boolean; progress: number }> {
  const result = await Log.aggregate<{ longestMinutes: number }>([
    { $match: { user: userId, ...HAS_EFFECTIVE_TIME_MATCH } },
    { $group: { _id: null, longestMinutes: { $max: EFFECTIVE_MINUTES_EXPR } } },
  ]);

  const hours = Math.floor((result[0]?.longestMinutes ?? 0) / 60);
  return { met: hours >= threshold, progress: hours };
}

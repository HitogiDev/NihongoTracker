import { Types } from 'mongoose';
import Log from '../../../models/log.model.js';

/**
 * Counts logs of a specific media type and checks against threshold.
 * For 'anime', counts total episodes logged. For all others, counts log entries.
 */
export async function evaluateMediaType(
  userId: Types.ObjectId,
  mediaType: string,
  threshold: number
): Promise<{ met: boolean; progress: number }> {
  if (mediaType === 'anime') {
    // Count episodes
    const result = await Log.aggregate([
      { $match: { user: userId, type: 'anime' } },
      { $group: { _id: null, total: { $sum: { $ifNull: ['$episodes', 0] } } } },
    ]);
    const total = result[0]?.total ?? 0;
    return { met: total >= threshold, progress: total };
  }

  // Count log entries for the given type
  const count = await Log.countDocuments({ user: userId, type: mediaType });
  return { met: count >= threshold, progress: count };
}

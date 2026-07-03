import { Types } from 'mongoose';
import Log from '../../../models/log.model.js';

/**
 * Sums logged time (in minutes) for a specific media type
 * and checks whether total hours >= threshold.
 * For 'reading', combines manga + reading + vn for "reading hours" intent.
 */
export async function evaluateMediaTypeHours(
  userId: Types.ObjectId,
  mediaType: string,
  threshold: number
): Promise<{ met: boolean; progress: number }> {
  // Special case: 'reading_combined' groups manga + reading for Bookworm
  const matchTypes =
    mediaType === 'reading_combined'
      ? { $in: ['manga', 'reading'] }
      : mediaType;

  const result = await Log.aggregate([
    {
      $match: {
        user: userId,
        type: matchTypes,
        time: { $gt: 0 },
      },
    },
    { $group: { _id: null, totalMinutes: { $sum: '$time' } } },
  ]);
  const totalMinutes = result[0]?.totalMinutes ?? 0;
  const totalHours = Math.floor(totalMinutes / 60);
  return { met: totalHours >= threshold, progress: totalHours };
}

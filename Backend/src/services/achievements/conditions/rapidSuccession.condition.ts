import { Types } from 'mongoose';
import Log from '../../../models/log.model.js';

/**
 * Speedrunner: two logs created within `seconds` of each other.
 *
 * Uses createdAt (when the entry was submitted), not date (when the immersion
 * happened) — this is about how fast the user filled the form, so backdated
 * logs entered back to back still count.
 */
export async function evaluateRapidSuccession(
  userId: Types.ObjectId,
  seconds: number
): Promise<{ met: boolean; progress: number }> {
  const result = await Log.aggregate([
    { $match: { user: userId } },
    { $sort: { createdAt: 1 } },
    {
      $setWindowFields: {
        partitionBy: '$user',
        sortBy: { createdAt: 1 },
        output: {
          previousCreatedAt: {
            $shift: { output: '$createdAt', by: -1, default: null },
          },
        },
      },
    },
    {
      $match: {
        previousCreatedAt: { $ne: null },
        $expr: {
          $lte: [
            { $subtract: ['$createdAt', '$previousCreatedAt'] },
            seconds * 1000,
          ],
        },
      },
    },
    { $limit: 1 },
    { $count: 'total' },
  ]);

  const met = (result[0]?.total ?? 0) > 0;
  return { met, progress: met ? 1 : 0 };
}

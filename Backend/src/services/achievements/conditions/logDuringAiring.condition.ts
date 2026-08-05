import { Types } from 'mongoose';
import Log from '../../../models/log.model.js';

/**
 * Checks whether the user logged an anime while it was still on air — the log's
 * date falls inside the show's AniList airing window.
 * Used for Currently Airing.
 *
 * A null airingEndDate means the show hadn't finished when the metadata was
 * fetched, so anything from the start date onwards counts.
 */
export async function evaluateLogDuringAiring(
  userId: Types.ObjectId
): Promise<{ met: boolean; progress: number }> {
  const result = await Log.aggregate([
    {
      $match: {
        user: userId,
        type: 'anime',
        mediaId: { $ne: null },
        // A placeholder date can't prove the log happened during the airing run
        unknownDate: { $ne: true },
      },
    },
    {
      $lookup: {
        from: 'media',
        localField: 'mediaId',
        foreignField: 'contentId',
        as: 'media',
        pipeline: [
          { $match: { type: 'anime', airingStartDate: { $ne: null } } },
          { $project: { airingStartDate: 1, airingEndDate: 1 } },
        ],
      },
    },
    { $unwind: '$media' },
    {
      $match: {
        $expr: {
          $and: [
            { $gte: ['$date', '$media.airingStartDate'] },
            {
              $or: [
                { $eq: ['$media.airingEndDate', null] },
                { $lte: ['$date', '$media.airingEndDate'] },
              ],
            },
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

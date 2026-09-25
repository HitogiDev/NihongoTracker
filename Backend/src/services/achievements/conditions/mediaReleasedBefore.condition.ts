import { Types } from 'mongoose';
import Log from '../../../models/log.model.js';

/**
 * Checks whether the user logged any media of `mediaType` whose release year is
 * earlier than `year`. Used for Old School (a visual novel released before 2005).
 *
 * Release years come from the source dumps (VNDB for visual novels) and live on
 * the media document, so logs are joined to media by contentId.
 */
export async function evaluateMediaReleasedBefore(
  userId: Types.ObjectId,
  mediaType: string,
  year: number
): Promise<{ met: boolean; progress: number }> {
  const result = await Log.aggregate([
    { $match: { user: userId, type: mediaType, mediaId: { $ne: null } } },
    {
      $lookup: {
        from: 'media',
        localField: 'mediaId',
        foreignField: 'contentId',
        as: 'media',
        pipeline: [
          {
            $match: {
              type: mediaType,
              releaseYear: { $ne: null, $lt: year },
            },
          },
          { $project: { _id: 1 } },
        ],
      },
    },
    { $match: { 'media.0': { $exists: true } } },
    { $limit: 1 },
    { $count: 'total' },
  ]);

  const met = (result[0]?.total ?? 0) > 0;
  return { met, progress: met ? 1 : 0 };
}

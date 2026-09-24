import { Types } from 'mongoose';
import UserMediaStatus from '../../../models/userMediaStatus.model.js';

/** Counts distinct completed titles for a user. */
export async function evaluateCompletedMediaCount(
  userId: Types.ObjectId,
  threshold: number
): Promise<{ met: boolean; progress: number }> {
  const rows = await UserMediaStatus.aggregate<{ total: number }>([
    {
      $match: {
        user: userId,
        hiddenFromList: { $ne: true },
        $or: [{ completed: true }, { status: 'completed' }],
      },
    },
    { $group: { _id: { mediaId: '$mediaId', type: '$type' } } },
    { $count: 'total' },
  ]);

  const count = rows[0]?.total ?? 0;
  return { met: count >= threshold, progress: count };
}

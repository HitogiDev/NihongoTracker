import { Types } from 'mongoose';
import User from '../../../models/user.model.js';

/**
 * 創始者 (Early Adopter): the user is among the first `threshold` accounts ever
 * created on the platform.
 *
 * Progress is their 1-based signup position.
 */
export async function evaluateEarlyAdopter(
  userId: Types.ObjectId,
  threshold: number
): Promise<{ met: boolean; progress: number }> {
  const user = await User.findById(userId).select('createdAt').lean();
  if (!user?.createdAt) return { met: false, progress: 0 };

  const earlier = await User.countDocuments({
    createdAt: { $lt: user.createdAt },
  });
  const position = earlier + 1;

  return { met: position <= threshold, progress: position };
}

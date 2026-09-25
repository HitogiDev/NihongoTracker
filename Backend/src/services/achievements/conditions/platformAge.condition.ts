import { Types } from 'mongoose';
import User from '../../../models/user.model.js';

/**
 * Checks whether the user's account has existed for at least threshold days.
 * Used for "The Long Game" (365 days on the platform).
 */
export async function evaluatePlatformAge(
  userId: Types.ObjectId,
  threshold: number
): Promise<{ met: boolean; progress: number }> {
  const user = await User.findById(userId).select('createdAt').lean();
  if (!user?.createdAt) return { met: false, progress: 0 };

  const daysSinceJoin = Math.floor(
    (Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24)
  );
  return { met: daysSinceJoin >= threshold, progress: daysSinceJoin };
}

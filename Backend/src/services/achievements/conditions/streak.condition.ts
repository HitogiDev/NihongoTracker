import { Types } from 'mongoose';
import User from '../../../models/user.model.js';

/**
 * Evaluates whether the user meets the streak condition.
 * Returns { met: true, progress } if passed, { met: false, progress } otherwise.
 */
export async function evaluateStreak(
  userId: Types.ObjectId,
  threshold: number
): Promise<{ met: boolean; progress: number }> {
  const user = await User.findById(userId).select('stats settings').lean();
  if (!user?.stats) return { met: false, progress: 0 };

  // We check longestStreak so that past achievements aren't revoked if the streak breaks
  const longestStreak = user.stats.longestStreak ?? 0;
  const currentStreak = user.stats.currentStreak ?? 0;
  const best = Math.max(longestStreak, currentStreak);

  return { met: best >= threshold, progress: best };
}

import { Types } from 'mongoose';
import UserAchievement from '../../../models/userAchievement.model.js';

/**
 * Counts the number of achievements the user has earned
 * and checks whether count >= threshold.
 * Used for Completionist / Achievement Hunter meta-achievements.
 */
export async function evaluateAchievementCount(
  userId: Types.ObjectId,
  threshold: number
): Promise<{ met: boolean; progress: number }> {
  const count = await UserAchievement.countDocuments({ user: userId });
  return { met: count >= threshold, progress: count };
}

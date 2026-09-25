import { Types } from 'mongoose';
import UserAchievement from '../../../models/userAchievement.model.js';
import { IAchievement } from '../../../types.js';

/**
 * Secret Keeper: the user has uncovered a number of secret achievements.
 *
 * The achievement doing the counting is itself secret, so it never counts
 * itself — otherwise unlocking it would inflate its own progress.
 */
export async function evaluateSecretAchievementCount(
  userId: Types.ObjectId,
  threshold: number,
  excludeKey = 'secret_keeper'
): Promise<{ met: boolean; progress: number }> {
  const owned = await UserAchievement.find({ user: userId })
    .populate<{ achievement: IAchievement }>('achievement', 'key rarity isSecret')
    .lean();

  const count = owned.filter(
    (ua) =>
      ua.achievement &&
      ua.achievement.key !== excludeKey &&
      (ua.achievement.isSecret || ua.achievement.rarity === 'secret')
  ).length;

  return { met: count >= threshold, progress: count };
}

import { Types } from 'mongoose';
import Achievement from '../../models/achievement.model.js';
import UserAchievement from '../../models/userAchievement.model.js';
import { removeNotifications } from '../notifications.service.js';

/** Achievement keys whose feedback is explicitly about competing on rankings. */
export const RANKING_ACHIEVEMENT_KEYS = [
  'rank_top10',
  'rank_podium',
  'rank_king',
  'rank_consistent',
  'secret_dethroned',
] as const;

export function isRankingAchievementKey(key?: string | null): boolean {
  return Boolean(
    key &&
      (RANKING_ACHIEVEMENT_KEYS as readonly string[]).includes(key)
  );
}

/**
 * Clear competitive achievement feedback already waiting for a user who just
 * enabled the quiet ranking preference. The achievements themselves remain.
 */
export async function suppressPendingRankingAchievementFeedback(
  userId: Types.ObjectId
): Promise<void> {
  const rankingAchievements = await Achievement.find({
    key: { $in: RANKING_ACHIEVEMENT_KEYS },
  })
    .select('_id')
    .lean();
  const achievementIds = rankingAchievements.map(
    (achievement) => achievement._id
  );
  if (achievementIds.length === 0) return;

  await UserAchievement.updateMany(
    { user: userId, achievement: { $in: achievementIds }, notified: false },
    { $set: { notified: true } }
  );
  await Promise.all(
    achievementIds.map((achievementId) =>
      removeNotifications({
        recipient: userId,
        type: 'achievement_unlocked',
        entityType: 'achievement',
        entityId: achievementId.toString(),
      })
    )
  );
}

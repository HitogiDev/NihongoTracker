import { Types } from 'mongoose';
import Achievement from '../../models/achievement.model.js';
import UserAchievement from '../../models/userAchievement.model.js';
import { IAchievement, IAchievementCheckContext } from '../../types.js';
import { evaluateStreak } from './conditions/streak.condition.js';
import { evaluateTotalXp } from './conditions/totalXp.condition.js';
import { evaluateLogCount } from './conditions/logCount.condition.js';
import { evaluateMediaType } from './conditions/mediaType.condition.js';
import { evaluateLevel } from './conditions/level.condition.js';
import { evaluateTotalHours } from './conditions/totalHours.condition.js';
import { evaluateMediaTypeHours } from './conditions/mediaTypeHours.condition.js';
import { evaluateAchievementCount } from './conditions/achievementCount.condition.js';
import { evaluateLogTimeRange } from './conditions/logTimeRange.condition.js';
import { evaluateLogOnDate } from './conditions/logOnDate.condition.js';
import { evaluateSingleDayHours } from './conditions/singleDayHours.condition.js';
import { evaluateWeeklyHours } from './conditions/weeklyHours.condition.js';
import { evaluateSessionsInDay } from './conditions/sessionsInDay.condition.js';
import { evaluatePlatformAge } from './conditions/platformAge.condition.js';
import { createNotification } from '../notifications.service.js';

/**
 * Evaluate a single achievement condition for a given user.
 * Returns { met, progress } — progress is the raw current value for progress bars.
 */
async function evaluateCondition(
  userId: Types.ObjectId,
  achievement: IAchievement
): Promise<{ met: boolean; progress: number }> {
  const { condition } = achievement;

  switch (condition.type) {
    case 'streak':
      return evaluateStreak(userId, condition.threshold ?? 1);

    case 'totalXp':
      return evaluateTotalXp(userId, condition.threshold ?? 1);

    case 'logCount':
      return evaluateLogCount(userId, condition.threshold ?? 1);

    case 'mediaType':
      return evaluateMediaType(
        userId,
        condition.mediaType ?? 'anime',
        condition.threshold ?? 1
      );

    case 'level':
      return evaluateLevel(
        userId,
        condition.stat ?? 'userLevel',
        condition.threshold ?? 1
      );

    case 'totalHours':
      return evaluateTotalHours(userId, condition.threshold ?? 1);

    case 'mediaTypeHours':
      return evaluateMediaTypeHours(
        userId,
        condition.mediaType ?? 'anime',
        condition.threshold ?? 1
      );

    case 'achievementCount':
      return evaluateAchievementCount(userId, condition.threshold ?? 1);

    case 'logTimeRange':
      return evaluateLogTimeRange(
        userId,
        condition.startHour ?? 0,
        condition.endHour ?? 24,
        condition.threshold ?? 1
      );

    case 'logOnDate':
      return evaluateLogOnDate(userId, condition.datePattern ?? '01-01');

    case 'singleDayHours':
      return evaluateSingleDayHours(userId, condition.threshold ?? 1);

    case 'weeklyHours':
      return evaluateWeeklyHours(userId, condition.threshold ?? 1);

    case 'sessionsInDay':
      return evaluateSessionsInDay(userId, condition.threshold ?? 1);

    case 'platformAge':
      return evaluatePlatformAge(userId, condition.threshold ?? 365);

    case 'manualGrant':
      // Manual grants are handled by the admin endpoint; never auto-evaluate
      return { met: false, progress: 0 };

    default:
      return { met: false, progress: 0 };
  }
}

/**
 * Check all active achievements for a user and grant any newly earned ones.
 *
 * Context is used to filter which achievements are checked to avoid redundant DB queries:
 * - 'log' trigger: checks logCount, mediaType, totalXp, level
 * - 'streak' trigger: checks streak
 * - 'levelup' trigger: checks level
 * - 'manual' trigger: skipped (admin uses grantAchievement directly)
 *
 * Returns the list of achievements that were newly granted in this call.
 */
export async function checkAchievements(
  userId: Types.ObjectId,
  context: IAchievementCheckContext
): Promise<IAchievement[]> {
  try {
    // Determine which condition types are relevant for this trigger
    const relevantConditions: string[] = getRelevantConditions(context.trigger);
    if (relevantConditions.length === 0) return [];

    // Fetch only active achievements relevant to the trigger
    const achievements = await Achievement.find({
      isActive: true,
      'condition.type': { $in: relevantConditions },
    }).lean();

    if (achievements.length === 0) return [];

    // Fetch user's already-earned achievement IDs in one query
    const earned = await UserAchievement.find({ user: userId })
      .select('achievement')
      .lean();
    const earnedIds = new Set(earned.map((ua) => ua.achievement.toString()));

    // Filter out already-earned achievements
    const unearnedAchievements = achievements.filter(
      (a) => !earnedIds.has(a._id.toString())
    );

    if (unearnedAchievements.length === 0) return [];

    const newlyGranted: IAchievement[] = [];

    for (const achievement of unearnedAchievements) {
      try {
        const { met, progress } = await evaluateCondition(userId, achievement as unknown as IAchievement);

        if (met) {
          // Use upsert to avoid race condition duplicate inserts
          await UserAchievement.findOneAndUpdate(
            { user: userId, achievement: achievement._id },
            {
              $setOnInsert: {
                user: userId,
                achievement: achievement._id,
                unlockedAt: new Date(),
                progress,
                notified: false,
              },
            },
            { upsert: true, new: false }
          );
          newlyGranted.push(achievement as unknown as IAchievement);

          await createNotification({
            recipient: userId,
            type: 'achievement_unlocked',
            title: `Achievement unlocked: ${achievement.name}`,
            body: achievement.description,
            link: '/achievements',
            entityType: 'achievement',
            entityId: achievement._id.toString(),
            meta: { iconSlug: achievement.iconSlug },
          });
        } else if (progress > 0) {
          // Update progress for countable achievements (non-blocking)
          UserAchievement.findOneAndUpdate(
            { user: userId, achievement: achievement._id },
            { $max: { progress } }
          ).exec().catch(() => {});
        }
      } catch (err) {
        // Don't fail the whole check if one achievement errors
        console.error(`Achievement check failed for key="${achievement.key}":`, err);
      }
    }

    return newlyGranted;
  } catch (err) {
    // Achievement errors should never break the main request
    console.error('checkAchievements failed:', err);
    return [];
  }
}

/**
 * Manually grant an achievement to a user (admin use).
 * Returns true if granted, false if already owned.
 */
export async function grantAchievement(
  userId: Types.ObjectId,
  achievementId: Types.ObjectId
): Promise<boolean> {
  const existing = await UserAchievement.findOne({
    user: userId,
    achievement: achievementId,
  });
  if (existing) return false;

  await UserAchievement.create({
    user: userId,
    achievement: achievementId,
    unlockedAt: new Date(),
    progress: 0,
    notified: false,
  });

  const achievement = await Achievement.findById(achievementId)
    .select('name description iconSlug')
    .lean();

  if (achievement) {
    await createNotification({
      recipient: userId,
      type: 'achievement_unlocked',
      title: `Achievement unlocked: ${achievement.name}`,
      body: achievement.description,
      link: '/achievements',
      entityType: 'achievement',
      entityId: achievementId.toString(),
      meta: { iconSlug: achievement.iconSlug },
    });
  }

  return true;
}

function getRelevantConditions(trigger: IAchievementCheckContext['trigger']): string[] {
  switch (trigger) {
    case 'log':
      return [
        'logCount', 'mediaType', 'totalXp', 'level',
        'totalHours', 'mediaTypeHours', 'achievementCount',
        'logTimeRange', 'logOnDate', 'singleDayHours',
        'weeklyHours', 'sessionsInDay', 'platformAge',
      ];
    case 'streak':
      return ['streak'];
    case 'levelup':
      return ['level', 'totalXp'];
    case 'manual':
      return [];
    default:
      return [];
  }
}

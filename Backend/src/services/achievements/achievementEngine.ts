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
import { evaluateClubsCreated } from './conditions/clubsCreated.condition.js';
import { evaluateClubMvp } from './conditions/clubMvp.condition.js';
import { evaluateMediaTypesInWeek } from './conditions/mediaTypesInWeek.condition.js';
import { evaluateMediaReleasedBefore } from './conditions/mediaReleasedBefore.condition.js';
import { evaluateLogDuringAiring } from './conditions/logDuringAiring.condition.js';
import { evaluateClubsJoined } from './conditions/clubsJoined.condition.js';
import { evaluateDistinctMediaCount } from './conditions/distinctMediaCount.condition.js';
import { evaluateConsecutiveDaysWithHours } from './conditions/consecutiveDaysWithHours.condition.js';
import { evaluateSingleSessionHours } from './conditions/singleSessionHours.condition.js';
import { evaluateRapidSuccession } from './conditions/rapidSuccession.condition.js';
import { evaluateStreakComeback } from './conditions/streakComeback.condition.js';
import { evaluateStreakAfterBreak } from './conditions/streakAfterBreak.condition.js';
import { evaluateRankDethroned } from './conditions/rankDethroned.condition.js';
import { evaluateSecretAchievementCount } from './conditions/secretAchievementCount.condition.js';
import { evaluateEarlyAdopter } from './conditions/earlyAdopter.condition.js';
import {
  createNotification,
  removeNotifications,
} from '../notifications.service.js';
import User from '../../models/user.model.js';
import { isValidTimezone } from '../../constants/timezone.js';

// Condition types whose result depends on where calendar days / clock hours fall
const TIMEZONE_SENSITIVE_CONDITIONS = new Set([
  'logTimeRange',
  'logOnDate',
  'singleDayHours',
  'weeklyHours',
  'sessionsInDay',
  'mediaTypesInWeek',
  'consecutiveDaysWithHours',
  'streakComeback',
  'streakAfterBreak',
]);

/**
 * Evaluate a single achievement condition for a given user.
 * Returns { met, progress } — progress is the raw current value for progress bars.
 *
 * `timezone` decides where calendar days and clock hours fall for the date-based
 * conditions, so "10 hours in one day" or "logged between 0-6h" mean what the
 * user experienced rather than what UTC saw.
 */
export async function evaluateCondition(
  userId: Types.ObjectId,
  achievement: IAchievement,
  timezone: string
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
        condition.threshold ?? 1,
        timezone
      );

    case 'logOnDate':
      return evaluateLogOnDate(
        userId,
        condition.datePattern ?? '01-01',
        timezone
      );

    case 'singleDayHours':
      return evaluateSingleDayHours(userId, condition.threshold ?? 1, timezone);

    case 'weeklyHours':
      return evaluateWeeklyHours(userId, condition.threshold ?? 1, timezone);

    case 'sessionsInDay':
      return evaluateSessionsInDay(userId, condition.threshold ?? 1, timezone);

    case 'platformAge':
      return evaluatePlatformAge(userId, condition.threshold ?? 365);

    case 'clubsCreated':
      return evaluateClubsCreated(userId, condition.threshold ?? 1);

    case 'clubMvp':
      return evaluateClubMvp(userId, condition.threshold ?? 1);

    case 'mediaTypesInWeek':
      return evaluateMediaTypesInWeek(
        userId,
        condition.threshold ?? 6,
        timezone,
        condition.days ?? 7
      );

    case 'clubsJoined':
      return evaluateClubsJoined(userId, condition.threshold ?? 1);

    case 'distinctMediaCount':
      return evaluateDistinctMediaCount(userId, condition.threshold ?? 1);

    case 'consecutiveDaysWithHours':
      return evaluateConsecutiveDaysWithHours(
        userId,
        condition.threshold ?? 7,
        condition.hours ?? 4,
        timezone
      );

    case 'singleSessionHours':
      return evaluateSingleSessionHours(userId, condition.threshold ?? 6);

    case 'rapidSuccession':
      return evaluateRapidSuccession(userId, condition.seconds ?? 60);

    case 'streakComeback':
      return evaluateStreakComeback(userId, condition.threshold ?? 1, timezone);

    case 'streakAfterBreak':
      return evaluateStreakAfterBreak(
        userId,
        condition.threshold ?? 7,
        timezone
      );

    case 'rankDethroned':
      return evaluateRankDethroned(userId);

    case 'secretAchievementCount':
      return evaluateSecretAchievementCount(userId, condition.threshold ?? 5);

    case 'earlyAdopter':
      return evaluateEarlyAdopter(userId, condition.threshold ?? 100);

    case 'mediaReleasedBefore':
      return evaluateMediaReleasedBefore(
        userId,
        condition.mediaType ?? 'vn',
        condition.year ?? 2005
      );

    case 'logDuringAiring':
      return evaluateLogDuringAiring(userId);

    case 'manualGrant':
      // Manual grants are handled by the admin endpoint; never auto-evaluate
      return { met: false, progress: 0 };

    default:
      return { met: false, progress: 0 };
  }
}

/**
 * Resolve the timezone the date-based conditions should be evaluated in.
 * Falls back to UTC when unset or invalid — an unknown zone would make
 * Mongo reject the whole aggregation.
 */
export async function getAchievementTimezone(
  userId: Types.ObjectId
): Promise<string> {
  const user = await User.findById(userId).select('settings.timezone').lean();
  const timezone = user?.settings?.timezone;
  return timezone && isValidTimezone(timezone) ? timezone : 'UTC';
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

    // One lookup per check, and only when a date-based condition is in play
    const needsTimezone = unearnedAchievements.some((a) =>
      TIMEZONE_SENSITIVE_CONDITIONS.has(a.condition?.type)
    );
    const timezone = needsTimezone
      ? await getAchievementTimezone(userId)
      : 'UTC';

    const newlyGranted: IAchievement[] = [];

    for (const achievement of unearnedAchievements) {
      try {
        const { met, progress } = await evaluateCondition(
          userId,
          achievement as unknown as IAchievement,
          timezone
        );

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
            // The client already translates achievement text from its key, so
            // it only needs the key here, not the English name.
            titleKey: 'achievement.unlocked',
            body: achievement.description,
            bodyKey: 'achievement.unlockedBody',
            link: '/achievements',
            entityType: 'achievement',
            entityId: achievement._id.toString(),
            meta: {
              iconSlug: achievement.iconSlug,
              achievementKey: achievement.key,
            },
          });
        } else if (progress > 0) {
          // Update progress for countable achievements (non-blocking)
          UserAchievement.findOneAndUpdate(
            { user: userId, achievement: achievement._id },
            { $max: { progress } }
          )
            .exec()
            .catch(() => {});
        }
      } catch (err) {
        // Don't fail the whole check if one achievement errors
        console.error(
          `Achievement check failed for key="${achievement.key}":`,
          err
        );
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
 * Re-evaluate everything a user already owns and take back what they no longer
 * (or never legitimately) qualify for — e.g. unlocks earned under the old
 * UTC-based day boundaries, or off the back of logs with an unknown date.
 *
 * Deliberately conservative. Only unlocks whose condition the engine can
 * actually evaluate are considered:
 *  - 'manualGrant' conditions are skipped (cron- and admin-awarded achievements
 *    have no evaluable condition, so "not met" would be meaningless).
 *  - Rows flagged manuallyGranted are skipped for the same reason.
 *
 * Returns the achievements that were revoked.
 */
export async function revokeUnearnedAchievements(
  userId: Types.ObjectId
): Promise<IAchievement[]> {
  const owned = await UserAchievement.find({ user: userId })
    .populate<{ achievement: IAchievement }>('achievement')
    .lean();

  const evaluable = owned.filter(
    (ua) =>
      !ua.manuallyGranted &&
      ua.achievement &&
      ua.achievement.condition?.type &&
      ua.achievement.condition.type !== 'manualGrant'
  );

  if (evaluable.length === 0) return [];

  const needsTimezone = evaluable.some((ua) =>
    TIMEZONE_SENSITIVE_CONDITIONS.has(ua.achievement.condition.type)
  );
  const timezone = needsTimezone
    ? await getAchievementTimezone(userId)
    : 'UTC';

  const revoked: IAchievement[] = [];

  for (const ua of evaluable) {
    try {
      const { met } = await evaluateCondition(
        userId,
        ua.achievement,
        timezone
      );
      if (met) continue;

      await UserAchievement.deleteOne({ _id: ua._id });

      // Drop the "unlocked" notification too — it now points at nothing
      await removeNotifications({
        recipient: userId,
        type: 'achievement_unlocked',
        entityId: ua.achievement._id.toString(),
      });

      revoked.push(ua.achievement);
    } catch (err) {
      // A failing evaluation must never cost a user an achievement
      console.error(
        `Achievement re-check failed for key="${ua.achievement.key}":`,
        err
      );
    }
  }

  return revoked;
}

/**
 * Drop the bell entries for achievements the user is about to be shown.
 *
 * Every unlock writes a notification when it happens, because most of them are
 * discovered outside a request the client is watching (cron, imports). When the
 * reveal animation does play — inline after a log, or from the `/me/pending`
 * drain — that animation is the notification, so the row would only repeat it.
 */
export async function dismissAchievementNotifications(
  userId: Types.ObjectId,
  achievementIds: Types.ObjectId[]
): Promise<void> {
  await Promise.all(
    achievementIds.map((id) =>
      removeNotifications({
        recipient: userId,
        entityType: 'achievement',
        entityId: id.toString(),
      })
    )
  );
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
    manuallyGranted: true,
  });

  const achievement = await Achievement.findById(achievementId)
    // `key` is what the client translates the name from — without it the
    // notification renders its raw `{{name}}` placeholder.
    .select('key name description iconSlug')
    .lean();

  if (achievement) {
    await createNotification({
      recipient: userId,
      type: 'achievement_unlocked',
      title: `Achievement unlocked: ${achievement.name}`,
      titleKey: 'achievement.unlocked',
      body: achievement.description,
      bodyKey: 'achievement.unlockedBody',
      link: '/achievements',
      entityType: 'achievement',
      entityId: achievementId.toString(),
      meta: {
        iconSlug: achievement.iconSlug,
        achievementKey: achievement.key,
      },
    });
  }

  return true;
}

function getRelevantConditions(
  trigger: IAchievementCheckContext['trigger']
): string[] {
  switch (trigger) {
    case 'log':
      return [
        'logCount',
        'mediaType',
        'totalXp',
        'level',
        'totalHours',
        'mediaTypeHours',
        'achievementCount',
        'logTimeRange',
        'logOnDate',
        'singleDayHours',
        'weeklyHours',
        'sessionsInDay',
        'platformAge',
        'clubsCreated',
        'clubMvp',
        'mediaTypesInWeek',
        'mediaReleasedBefore',
        'logDuringAiring',
        'clubsJoined',
        'distinctMediaCount',
        'consecutiveDaysWithHours',
        'singleSessionHours',
        'rapidSuccession',
        'streakComeback',
        'streakAfterBreak',
        'rankDethroned',
        'secretAchievementCount',
        'earlyAdopter',
      ];
    case 'streak':
      return ['streak', 'streakComeback', 'streakAfterBreak'];
    case 'levelup':
      return ['level', 'totalXp'];
    case 'manual':
      return [];
    default:
      return [];
  }
}

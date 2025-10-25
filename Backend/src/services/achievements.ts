import User from '../models/user.model.js';
import Achievement from '../models/achievement.model.js';
import Log from '../models/log.model.js';
import { Types } from 'mongoose';
import { IAchievement } from '../types.js';

/**
 * Check if a user meets the criteria for a specific achievement
 */
export async function checkAchievementCriteria(
  userId: Types.ObjectId,
  achievement: IAchievement
): Promise<{ met: boolean; progress: number }> {
  const user = await User.findById(userId);
  if (!user) {
    return { met: false, progress: 0 };
  }

  const { criteria } = achievement;
  let currentValue = 0;

  switch (criteria.type) {
    case 'total_xp':
      currentValue = user.stats.userXp;
      break;

    case 'category_xp':
      if (criteria.category === 'reading') {
        currentValue = user.stats.readingXp;
      } else if (criteria.category === 'listening') {
        currentValue = user.stats.listeningXp;
      }
      break;

    case 'level_reached':
      currentValue = user.stats.userLevel;
      break;

    case 'category_level':
      if (criteria.category === 'reading') {
        currentValue = user.stats.readingLevel;
      } else if (criteria.category === 'listening') {
        currentValue = user.stats.listeningLevel;
      }
      break;

    case 'streak_days':
      currentValue = user.stats.longestStreak;
      break;

    case 'total_logs':
      currentValue = await Log.countDocuments({ user: userId });
      break;

    case 'category_logs':
      const logTypes =
        criteria.category === 'reading'
          ? ['reading', 'manga', 'vn']
          : ['anime', 'video', 'movie', 'tv show'];
      currentValue = await Log.countDocuments({
        user: userId,
        type: { $in: logTypes },
      });
      break;

    case 'episodes_watched':
      const episodeLogs = await Log.find({
        user: userId,
        type: 'anime',
      });
      currentValue = episodeLogs.reduce(
        (sum, log) => sum + (log.episodes || 0),
        0
      );
      break;

    case 'pages_read':
      const pageLogs = await Log.find({
        user: userId,
        type: { $in: ['reading', 'manga'] },
      });
      currentValue = pageLogs.reduce((sum, log) => sum + (log.pages || 0), 0);
      break;

    case 'chars_read':
      const charLogs = await Log.find({
        user: userId,
        type: { $in: ['reading', 'vn'] },
      });
      currentValue = charLogs.reduce((sum, log) => sum + (log.chars || 0), 0);
      break;

    case 'hours_listened':
      const timeLogs = await Log.find({
        user: userId,
        type: { $in: ['anime', 'video', 'movie', 'tv show'] },
      });
      const totalMinutes = timeLogs.reduce(
        (sum, log) => sum + (log.time || 0),
        0
      );
      currentValue = Math.floor(totalMinutes / 60);
      break;

    case 'club_member':
      currentValue = user.clubs?.length || 0;
      break;

    case 'club_owner':
      // This will need to be implemented when club ownership tracking is added
      currentValue = 0;
      break;

    default:
      return { met: false, progress: 0 };
  }

  const met = currentValue >= criteria.threshold;
  const progress = Math.min(
    100,
    Math.floor((currentValue / criteria.threshold) * 100)
  );

  return { met, progress };
}

/**
 * Award an achievement to a user
 */
export async function awardAchievement(
  userId: Types.ObjectId,
  achievementId: Types.ObjectId
): Promise<{ awarded: boolean; message: string }> {
  const user = await User.findById(userId);
  const achievement = await Achievement.findById(achievementId);

  if (!user || !achievement) {
    return { awarded: false, message: 'User or achievement not found' };
  }

  // Check if user already has this achievement
  const hasAchievement = user.achievements?.some(
    (a) => a.achievement.toString() === achievementId.toString()
  );

  if (hasAchievement) {
    return { awarded: false, message: 'Achievement already unlocked' };
  }

  // Add achievement to user
  user.achievements = user.achievements || [];
  user.achievements.push({
    achievement: achievementId,
    unlockedAt: new Date(),
  });

  // Add achievement points
  user.achievementPoints = (user.achievementPoints || 0) + achievement.points;

  await user.save();

  return {
    awarded: true,
    message: `Achievement unlocked: ${achievement.name}`,
  };
}

/**
 * Check all achievements for a user and award any that are met
 */
export async function checkAndAwardAchievements(
  userId: Types.ObjectId
): Promise<IAchievement[]> {
  const user = await User.findById(userId);
  if (!user) {
    return [];
  }

  // Get all achievements that the user doesn't already have
  const unlockedAchievementIds =
    user.achievements?.map((a) => a.achievement.toString()) || [];
  const availableAchievements = await Achievement.find({
    _id: { $nin: unlockedAchievementIds },
  });

  const newlyUnlocked: IAchievement[] = [];

  for (const achievement of availableAchievements) {
    const { met } = await checkAchievementCriteria(userId, achievement);

    if (met) {
      const { awarded } = await awardAchievement(userId, achievement._id);
      if (awarded) {
        newlyUnlocked.push(achievement);
      }
    }
  }

  return newlyUnlocked;
}

/**
 * Get achievement progress for a specific achievement
 */
export async function getAchievementProgress(
  userId: Types.ObjectId,
  achievementId: Types.ObjectId
): Promise<{ progress: number; unlocked: boolean }> {
  const user = await User.findById(userId);
  const achievement = await Achievement.findById(achievementId);

  if (!user || !achievement) {
    return { progress: 0, unlocked: false };
  }

  const unlocked = user.achievements?.some(
    (a) => a.achievement.toString() === achievementId.toString()
  );

  if (unlocked) {
    return { progress: 100, unlocked: true };
  }

  const { progress } = await checkAchievementCriteria(userId, achievement);
  return { progress, unlocked: false };
}

/**
 * Get all achievements with progress for a user
 */
export async function getUserAchievementsWithProgress(userId: Types.ObjectId) {
  const user = await User.findById(userId).populate('achievements.achievement');
  if (!user) {
    return { unlocked: [], locked: [] };
  }

  const allAchievements = await Achievement.find({ hidden: false });
  const unlockedIds =
    user.achievements?.map((a) => a.achievement.toString()) || [];

  const unlocked =
    user.achievements?.map((ua) => ({
      ...ua,
      progress: 100,
    })) || [];

  const locked = await Promise.all(
    allAchievements
      .filter((a) => !unlockedIds.includes(a._id.toString()))
      .map(async (achievement) => {
        const { progress } = await checkAchievementCriteria(
          userId,
          achievement
        );
        return {
          achievement,
          progress,
          unlocked: false,
        };
      })
  );

  return { unlocked, locked };
}

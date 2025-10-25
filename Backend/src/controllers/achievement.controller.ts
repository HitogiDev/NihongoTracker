import { Request, Response, NextFunction } from 'express';
import Achievement from '../models/achievement.model.js';
import User from '../models/user.model.js';
import {
  checkAndAwardAchievements,
  getUserAchievementsWithProgress,
  getAchievementProgress,
} from '../services/achievements.js';
import { customError } from '../middlewares/errorMiddleware.js';
import { Types } from 'mongoose';

/**
 * Get all achievements (admin only - for management)
 * GET /api/achievements/all
 */
export const getAllAchievements = async (
  _req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const achievements = await Achievement.find().sort({
      category: 1,
      rarity: 1,
    });
    res.status(200).json(achievements);
  } catch (error) {
    next(error as customError);
  }
};

/**
 * Get all public (non-hidden) achievements
 * GET /api/achievements/public
 */
export const getPublicAchievements = async (
  _req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const achievements = await Achievement.find({ hidden: false }).sort({
      category: 1,
      rarity: 1,
    });
    res.status(200).json(achievements);
  } catch (error) {
    next(error as customError);
  }
};

/**
 * Get user's achievements with progress
 * GET /api/achievements/user/:userId
 */
export const getUserAchievements = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId } = req.params;
    const requestingUser = res.locals.user;

    // Only allow users to view their own achievements unless admin
    if (
      userId !== requestingUser._id.toString() &&
      !requestingUser.roles.includes('admin')
    ) {
      const error = new customError('Unauthorized', 403);
      return next(error);
    }

    const achievements = await getUserAchievementsWithProgress(
      new Types.ObjectId(userId)
    );

    res.status(200).json(achievements);
  } catch (error) {
    next(error as customError);
  }
};

/**
 * Get current user's achievements with progress
 * GET /api/achievements/me
 */
export const getMyAchievements = async (
  _req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = res.locals.user;
    const achievements = await getUserAchievementsWithProgress(user._id);

    res.status(200).json(achievements);
  } catch (error) {
    next(error as customError);
  }
};

/**
 * Check and award achievements for current user
 * POST /api/achievements/check
 */
export const checkUserAchievements = async (
  _req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = res.locals.user;
    const newlyUnlocked = await checkAndAwardAchievements(user._id);

    res.status(200).json({
      message: `Checked achievements. ${newlyUnlocked.length} newly unlocked.`,
      newlyUnlocked,
    });
  } catch (error) {
    next(error as customError);
  }
};

/**
 * Get progress for a specific achievement
 * GET /api/achievements/:achievementId/progress
 */
export const getAchievementProgressById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { achievementId } = req.params;
    const user = res.locals.user;

    const progress = await getAchievementProgress(
      user._id,
      new Types.ObjectId(achievementId)
    );

    res.status(200).json(progress);
  } catch (error) {
    next(error as customError);
  }
};

/**
 * Create a new achievement (admin only)
 * POST /api/achievements
 */
export const createAchievement = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const {
      key,
      name,
      description,
      icon,
      category,
      rarity,
      criteria,
      points,
      hidden,
    } = req.body;

    // Validate required fields
    if (!key || !name || !description || !category || !rarity || !criteria) {
      const error = new customError('Missing required fields', 400);
      return next(error);
    }

    // Check if achievement with key already exists
    const existing = await Achievement.findOne({ key });
    if (existing) {
      const error = new customError(
        'Achievement with this key already exists',
        400
      );
      return next(error);
    }

    const achievement = await Achievement.create({
      key,
      name,
      description,
      icon: icon || '🏆',
      category,
      rarity,
      criteria,
      points: points || 10,
      hidden: hidden || false,
    });

    res.status(201).json(achievement);
  } catch (error) {
    next(error as customError);
  }
};

/**
 * Update an achievement (admin only)
 * PATCH /api/achievements/:id
 */
export const updateAchievement = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const achievement = await Achievement.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    });

    if (!achievement) {
      const error = new customError('Achievement not found', 404);
      return next(error);
    }

    res.status(200).json(achievement);
  } catch (error) {
    next(error as customError);
  }
};

/**
 * Delete an achievement (admin only)
 * DELETE /api/achievements/:id
 */
export const deleteAchievement = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    const achievement = await Achievement.findByIdAndDelete(id);

    if (!achievement) {
      const error = new customError('Achievement not found', 404);
      return next(error);
    }

    // Remove achievement from all users
    await User.updateMany(
      { 'achievements.achievement': id },
      { $pull: { achievements: { achievement: id } } }
    );

    res.status(200).json({ message: 'Achievement deleted successfully' });
  } catch (error) {
    next(error as customError);
  }
};

/**
 * Get user's achievement stats
 * GET /api/achievements/stats/:userId
 */
export const getUserAchievementStats = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId).populate(
      'achievements.achievement'
    );

    if (!user) {
      const error = new customError('User not found', 404);
      return next(error);
    }

    const totalAchievements = await Achievement.countDocuments({
      hidden: false,
    });
    const unlockedCount = user.achievements?.length || 0;
    const achievementPoints = user.achievementPoints || 0;

    // Count by rarity
    const unlockedAchievements = await Achievement.find({
      _id: { $in: user.achievements?.map((a) => a.achievement) || [] },
    });

    const rarityCounts = {
      C: 0,
      B: 0,
      A: 0,
      S: 0,
      SS: 0,
      SSR: 0,
    };

    unlockedAchievements.forEach((achievement) => {
      rarityCounts[achievement.rarity]++;
    });

    // Count by category
    const categoryCounts: Record<string, number> = {};
    unlockedAchievements.forEach((achievement) => {
      categoryCounts[achievement.category] =
        (categoryCounts[achievement.category] || 0) + 1;
    });

    res.status(200).json({
      total: totalAchievements,
      unlocked: unlockedCount,
      locked: totalAchievements - unlockedCount,
      points: achievementPoints,
      completionPercentage: Math.floor(
        (unlockedCount / totalAchievements) * 100
      ),
      rarityCounts,
      categoryCounts,
      recentUnlocks:
        user.achievements
          ?.sort((a, b) => b.unlockedAt.getTime() - a.unlockedAt.getTime())
          .slice(0, 5) || [],
    });
  } catch (error) {
    next(error as customError);
  }
};

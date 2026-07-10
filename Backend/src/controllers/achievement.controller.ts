import { Request, Response, NextFunction } from 'express';
import Achievement from '../models/achievement.model.js';
import UserAchievement from '../models/userAchievement.model.js';
import User from '../models/user.model.js';
import { customError } from '../middlewares/errorMiddleware.js';
import { grantAchievement, checkAchievements } from '../services/achievements/achievementEngine.js';
import { IAchievementCheckContext } from '../types.js';
import { Types } from 'mongoose';

// ─── Public / User endpoints ──────────────────────────────────────────────────

/**
 * GET /api/achievements
 * Returns all active achievement definitions (public).
 * Secret/hidden achievements only return minimal stub info (count, rarity).
 * Optionally includes the requesting user's earned status if authenticated.
 */
export async function getAchievements(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const achievements = await Achievement.find({ isActive: true })
      .sort({ order: 1 })
      .lean();

    // Total user count for rarity % computation
    const totalUsers = await User.countDocuments();

    // Earned counts per achievement for rarity %
    const earnedCounts = await UserAchievement.aggregate([
      { $group: { _id: '$achievement', count: { $sum: 1 } } },
    ]);
    const earnedCountMap = new Map(
      earnedCounts.map((e) => [e._id.toString(), e.count])
    );

    const mapped = achievements.map((a) => {
      const earnedCount = earnedCountMap.get(a._id.toString()) ?? 0;
      const rarityPercent =
        totalUsers > 0
          ? Math.round((earnedCount / totalUsers) * 1000) / 10 // 1 decimal place
          : 0;

      // For isHidden secret achievements — return only stub data
      if (a.isHidden) {
        return {
          _id: a._id,
          key: a.key,
          rarity: a.rarity,
          category: a.category,
          isHidden: true,
          isSecret: a.isSecret,
          points: a.points,
          rarityPercent,
        };
      }

      // For non-hidden secret achievements — show hint but not name/description
      if (a.isSecret) {
        return {
          _id: a._id,
          key: a.key,
          rarity: a.rarity,
          category: a.category,
          isHidden: false,
          isSecret: true,
          hint: a.hint || '',
          iconSlug: a.iconSlug, // show icon slug (icon is still revealed as ?)
          points: a.points,
          rarityPercent,
        };
      }

      return {
        ...a,
        rarityPercent,
      };
    });

    return res.status(200).json(mapped);
  } catch (error) {
    return next(error as customError);
  }
}

/**
 * GET /api/achievements/me  (auth required)
 * Returns achievements merged with the user's earned status and progress.
 */
export async function getMyAchievements(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = res.locals.user._id as Types.ObjectId;
    return getUserAchievementsById(userId, true, res, next);
  } catch (error) {
    return next(error as customError);
  }
}

/**
 * GET /api/achievements/user/:username  (public)
 * Returns achievements for a specific user's public profile.
 * Secret unearned achievements are completely hidden.
 */
export async function getUserAchievementsByUsername(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const user = await User.findOne({ username: req.params.username })
      .select('_id')
      .lean();
    if (!user) throw new customError('User not found', 404);

    return getUserAchievementsById(user._id as Types.ObjectId, false, res, next);
  } catch (error) {
    return next(error as customError);
  }
}

async function getUserAchievementsById(
  userId: Types.ObjectId,
  isOwner: boolean,
  res: Response,
  next: NextFunction
) {
  try {
    const [achievements, userAchievements, totalUsers] = await Promise.all([
      Achievement.find({ isActive: true }).sort({ order: 1 }).lean(),
      UserAchievement.find({ user: userId })
        .populate('achievement')
        .lean(),
      User.countDocuments(),
    ]);

    const earnedCounts = await UserAchievement.aggregate([
      { $group: { _id: '$achievement', count: { $sum: 1 } } },
    ]);
    const earnedCountMap = new Map(
      earnedCounts.map((e) => [e._id.toString(), e.count])
    );

    const earnedMap = new Map(
      userAchievements.map((ua) => [
        ua.achievement._id?.toString() ?? ua.achievement.toString(),
        ua,
      ])
    );

    const result = achievements.map((a) => {
      const earned = earnedMap.get(a._id.toString());
      const isEarned = Boolean(earned);
      const earnedCount = earnedCountMap.get(a._id.toString()) ?? 0;
      const rarityPercent =
        totalUsers > 0
          ? Math.round((earnedCount / totalUsers) * 1000) / 10
          : 0;

      // Unearned secret — hide completely from non-owners
      if (a.isSecret && !isEarned && !isOwner) {
        return null;
      }

      // isHidden unearned — stub only
      if (a.isHidden && !isEarned) {
        return {
          _id: a._id,
          key: a.key,
          rarity: a.rarity,
          category: a.category,
          isHidden: true,
          isSecret: a.isSecret,
          isEarned: false,
          points: a.points,
          rarityPercent,
        };
      }

      // Secret unearned (non-hidden) — show hint + icon slug only
      if (a.isSecret && !isEarned) {
        return {
          _id: a._id,
          key: a.key,
          rarity: a.rarity,
          category: a.category,
          isHidden: false,
          isSecret: true,
          hint: a.hint || '',
          iconSlug: a.iconSlug,
          isEarned: false,
          points: a.points,
          rarityPercent,
        };
      }

      return {
        ...a,
        isEarned,
        unlockedAt: earned?.unlockedAt ?? null,
        progress: earned?.progress ?? 0,
        rarityPercent,
      };
    });

    // Filter out nulls (hidden secret unearned for non-owners)
    return res.status(200).json(result.filter(Boolean));
  } catch (error) {
    return next(error as customError);
  }
}

/**
 * GET /api/achievements/me/pending  (auth required)
 * Returns newly earned achievements that haven't been shown to the user yet,
 * then marks them as notified.
 */
export async function getPendingAchievements(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = res.locals.user._id as Types.ObjectId;

    const pending = await UserAchievement.find({
      user: userId,
      notified: false,
    })
      .populate('achievement')
      .sort({ unlockedAt: 1 })
      .lean();

    if (pending.length === 0) {
      return res.status(200).json([]);
    }

    // Mark as notified
    await UserAchievement.updateMany(
      { user: userId, notified: false },
      { $set: { notified: true } }
    );

    const result = pending.map((ua) => {
      const a = ua.achievement as any;
      const rarityPercent = 0; // will be computed on the client from the main list
      return {
        userAchievementId: ua._id,
        unlockedAt: ua.unlockedAt,
        achievement: a,
        rarityPercent,
      };
    });

    return res.status(200).json(result);
  } catch (error) {
    return next(error as customError);
  }
}

/**
 * GET /api/achievements/me/showcase  (auth required)
 * Returns the user's pinned showcase achievements (up to 5).
 */
export async function getShowcase(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = res.locals.user._id as Types.ObjectId;
    const user = await User.findById(userId)
      .select('settings')
      .lean();

    const showcaseIds: string[] = (user?.settings as any)?.achievementShowcase ?? [];

    if (showcaseIds.length === 0) {
      return res.status(200).json([]);
    }

    const earned = await UserAchievement.find({
      user: userId,
      achievement: { $in: showcaseIds.map((id) => new Types.ObjectId(id)) },
    })
      .populate('achievement')
      .lean();

    // Preserve showcase order
    const earnedMap = new Map(
      earned.map((ua) => [
        ua.achievement._id?.toString() ?? ua.achievement.toString(),
        ua,
      ])
    );
    const ordered = showcaseIds
      .map((id) => earnedMap.get(id))
      .filter(Boolean);

    return res.status(200).json(ordered);
  } catch (error) {
    return next(error as customError);
  }
}

/**
 * PUT /api/achievements/me/showcase  (auth required)
 * Updates the user's showcase pin list (max 5).
 */
export async function updateShowcase(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = res.locals.user._id as Types.ObjectId;
    const { showcaseIds } = req.body as { showcaseIds: string[] };

    if (!Array.isArray(showcaseIds)) {
      throw new customError('showcaseIds must be an array', 400);
    }
    if (showcaseIds.length > 5) {
      throw new customError('Maximum 5 achievements in showcase', 400);
    }

    // Validate that all provided IDs are achievements the user has earned
    if (showcaseIds.length > 0) {
      const earned = await UserAchievement.find({
        user: userId,
        achievement: {
          $in: showcaseIds.map((id) => new Types.ObjectId(id)),
        },
      })
        .select('achievement')
        .lean();

      if (earned.length !== showcaseIds.length) {
        throw new customError(
          'One or more achievements are not earned by this user',
          400
        );
      }
    }

    await User.findByIdAndUpdate(userId, {
      $set: { 'settings.achievementShowcase': showcaseIds },
    });

    return res.status(200).json({ message: 'Showcase updated', showcaseIds });
  } catch (error) {
    return next(error as customError);
  }
}

// ─── Admin endpoints ──────────────────────────────────────────────────────────

export async function adminGetAchievements(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const achievements = await Achievement.find({})
      .sort({ order: 1 })
      .lean();

    const earnedCounts = await UserAchievement.aggregate([
      { $group: { _id: '$achievement', count: { $sum: 1 } } },
    ]);
    const earnedCountMap = new Map(
      earnedCounts.map((e) => [e._id.toString(), e.count])
    );

    const totalUsers = await User.countDocuments();

    const result = achievements.map((a) => ({
      ...a,
      earnedCount: earnedCountMap.get(a._id.toString()) ?? 0,
      rarityPercent:
        totalUsers > 0
          ? Math.round(
              ((earnedCountMap.get(a._id.toString()) ?? 0) / totalUsers) * 1000
            ) / 10
          : 0,
    }));

    return res.status(200).json(result);
  } catch (error) {
    return next(error as customError);
  }
}

export async function adminCreateAchievement(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const data = req.body;
    if (!data.key || !data.name || !data.condition) {
      throw new customError('key, name, and condition are required', 400);
    }

    const existing = await Achievement.findOne({ key: data.key });
    if (existing) throw new customError('Achievement key already exists', 409);

    const achievement = await Achievement.create(data);
    return res.status(201).json(achievement);
  } catch (error) {
    return next(error as customError);
  }
}

export async function adminUpdateAchievement(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const achievement = await Achievement.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );
    if (!achievement) throw new customError('Achievement not found', 404);
    return res.status(200).json(achievement);
  } catch (error) {
    return next(error as customError);
  }
}

export async function adminDeleteAchievement(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    // Soft delete
    const achievement = await Achievement.findByIdAndUpdate(
      req.params.id,
      { $set: { isActive: false } },
      { new: true }
    );
    if (!achievement) throw new customError('Achievement not found', 404);
    return res.status(200).json({ message: 'Achievement deactivated', achievement });
  } catch (error) {
    return next(error as customError);
  }
}

export async function adminGrantAchievement(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { username, achievementKey } = req.body as {
      username: string;
      achievementKey: string;
    };

    if (!username || !achievementKey) {
      throw new customError('username and achievementKey are required', 400);
    }

    const user = await User.findOne({ username }).select('_id').lean();
    if (!user) throw new customError('User not found', 404);

    const achievement = await Achievement.findOne({ key: achievementKey }).lean();
    if (!achievement) throw new customError('Achievement not found', 404);

    const granted = await grantAchievement(
      user._id as Types.ObjectId,
      achievement._id as Types.ObjectId
    );

    if (!granted) {
      return res.status(200).json({
        message: 'User already has this achievement',
        alreadyOwned: true,
      });
    }

    return res.status(201).json({
      message: `Achievement "${achievement.name}" granted to ${username}`,
      alreadyOwned: false,
    });
  } catch (error) {
    return next(error as customError);
  }
}

export async function adminRevokeAchievement(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { username, achievementKey } = req.body as {
      username: string;
      achievementKey: string;
    };

    if (!username || !achievementKey) {
      throw new customError('username and achievementKey are required', 400);
    }

    const user = await User.findOne({ username }).select('_id').lean();
    if (!user) throw new customError('User not found', 404);

    const achievement = await Achievement.findOne({ key: achievementKey }).lean();
    if (!achievement) throw new customError('Achievement not found', 404);

    const result = await UserAchievement.findOneAndDelete({
      user: user._id,
      achievement: achievement._id,
    });

    if (!result) {
      return res.status(200).json({ message: 'User did not have this achievement' });
    }

    return res.status(200).json({
      message: `Achievement "${achievement.name}" revoked from ${username}`,
    });
  } catch (error) {
    return next(error as customError);
  }
}

/**
 * POST /api/achievements/admin/backfill-all  (admin)
 * Checks all achievement conditions for every user and grants any that are
 * now satisfied but weren't previously awarded.
 * This is a potentially long-running operation — it processes users sequentially.
 */
export async function adminBackfillAchievementsForAllUsers(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const allUsers = await User.find({}).select('_id').lean();
    const triggers: IAchievementCheckContext['trigger'][] = ['log', 'streak', 'levelup'];

    let totalGranted = 0;
    let usersProcessed = 0;
    let usersWithNewAchievements = 0;

    for (const user of allUsers) {
      const userId = user._id as Types.ObjectId;
      let userGranted = 0;

      for (const trigger of triggers) {
        const granted = await checkAchievements(userId, { trigger });
        userGranted += granted.length;
      }

      totalGranted += userGranted;
      usersProcessed++;
      if (userGranted > 0) usersWithNewAchievements++;
    }

    return res.status(200).json({
      message: `Backfill complete: ${totalGranted} achievement(s) granted across ${usersWithNewAchievements} user(s) out of ${usersProcessed} processed.`,
      totalGranted,
      usersProcessed,
      usersWithNewAchievements,
    });
  } catch (error) {
    return next(error as customError);
  }
}

/**
 * GET /api/achievements/feed  (public)
 * Global feed of recent rare/legendary/secret achievement unlocks.
 */
export async function getAchievementFeed(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);

    const feed = await UserAchievement.find({})
      .populate({
        path: 'achievement',
        match: {
          isActive: true,
          isHidden: false,
        },
      })
      .populate('user', 'username avatar')
      .sort({ unlockedAt: -1 })
      .limit(limit * 3) // overfetch since populate match may filter some
      .lean();

    // Filter out items where achievement didn't match (populate match returned null)
    const filtered = feed
      .filter((ua) => ua.achievement !== null)
      .slice(0, limit);

    return res.status(200).json(filtered);
  } catch (error) {
    return next(error as customError);
  }
}

/**
 * GET /api/achievements/user/:username/recent  (public)
 * Returns the most recent achievement unlocks for a user's profile activity feed.
 */
export async function getUserAchievementActivity(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);

    const user = await User.findOne({ username: req.params.username })
      .select('_id username avatar')
      .lean();
    if (!user) throw new customError('User not found', 404);

    const recentUnlocks = await UserAchievement.find({ user: user._id })
      .populate({
        path: 'achievement',
        match: { isActive: true, isHidden: false },
      })
      .sort({ unlockedAt: -1 })
      .limit(limit * 2)
      .lean();

    const filtered = recentUnlocks
      .filter((ua) => ua.achievement !== null)
      .slice(0, limit)
      .map((ua) => ({
        userAchievementId: ua._id,
        achievement: ua.achievement,
        unlockedAt: ua.unlockedAt,
        user,
      }));

    return res.status(200).json(filtered);
  } catch (error) {
    return next(error as customError);
  }
}

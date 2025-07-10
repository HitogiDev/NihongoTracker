import { Request, Response, NextFunction } from 'express';
import { ParamsDictionary } from 'express-serve-static-core';
import DailyGoal from '../models/dailyGoal.model.js';
import Log from '../models/log.model.js';
import User from '../models/user.model.js';
import { Anime } from '../models/media.model.js';
import { IDailyGoal, IDailyGoalProgress, IMediaDocument } from '../types.js';
import { customError } from '../middlewares/errorMiddleware.js';

export async function getDailyGoals(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { username } = req.params;
    console.log('Fetching daily goals for user:', username);
    if (!username) {
      throw new customError('Username is required', 400);
    }
    // Find user by username
    const foundUser = await User.findOne({ username });

    if (!foundUser) {
      throw new customError('User not found', 404);
    }

    // Get user's goals
    const goals = await DailyGoal.find({ user: foundUser._id }).sort({
      createdAt: -1,
    });

    // Calculate today's progress
    const today = new Date();
    const startOfDay = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    );
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    const todayLogs = await Log.find({
      user: foundUser._id,
      date: { $gte: startOfDay, $lt: endOfDay },
    });

    // Calculate progress for each type
    const progress: IDailyGoalProgress = {
      date: startOfDay.toISOString().split('T')[0],
      time: 0,
      chars: 0,
      episodes: 0,
      pages: 0,
      completed: {
        time: false,
        chars: false,
        episodes: false,
        pages: false,
      },
    };

    // Get media documents for anime logs to check episode duration
    const animeLogMediaIds = todayLogs
      .filter((log) => log.type === 'anime' && log.mediaId && log.episodes)
      .map((log) => log.mediaId);

    const mediaDocuments: IMediaDocument[] | [] =
      animeLogMediaIds.length > 0
        ? await Anime.find({ contentId: { $in: animeLogMediaIds } })
        : [];

    const mediaMap = new Map(
      mediaDocuments.map((media) => [media.contentId, media])
    );

    // Sum up today's activity
    todayLogs.forEach((log) => {
      // Time calculation - always include anime episodes as time
      if (log.time) {
        progress.time += log.time;
      }

      // For anime logs, always add episode time
      if (log.type === 'anime' && log.episodes) {
        const media = log.mediaId ? mediaMap.get(log.mediaId) : null;
        const episodeDuration = media?.episodeDuration || 24; // Use media duration or fallback to 24 minutes
        progress.time += log.episodes * episodeDuration;
      }

      // Count characters from any log that has chars field
      if (log.chars) progress.chars += log.chars;
      if (log.episodes) progress.episodes += log.episodes;
      if (log.pages) progress.pages += log.pages;
    });

    // Check completion status for each active goal
    goals.forEach((goal) => {
      if (goal.isActive) {
        const currentProgress = progress[goal.type];
        progress.completed[goal.type] = currentProgress >= goal.target;
      }
    });

    return res.status(200).json({
      goals,
      todayProgress: progress,
    });
  } catch (error) {
    return next(error as customError);
  }
}

export async function createDailyGoal(
  req: Request<
    ParamsDictionary,
    any,
    Omit<IDailyGoal, '_id' | 'user' | 'createdAt' | 'updatedAt'>
  >,
  res: Response,
  next: NextFunction
) {
  try {
    const { user } = res.locals;
    const { type, target, isActive } = req.body;

    if (!type || !target) {
      throw new customError('Type and target are required', 400);
    }

    if (target <= 0) {
      throw new customError('Target must be greater than 0', 400);
    }

    const validTypes = ['time', 'chars', 'episodes', 'pages'];
    if (!validTypes.includes(type)) {
      throw new customError('Invalid goal type', 400);
    }

    // Check if user already has an active goal of this type
    const existingGoal = await DailyGoal.findOne({
      user: user._id,
      type,
      isActive: true,
    });

    if (existingGoal) {
      throw new customError(
        `You already have an active ${type} goal. Please deactivate it first.`,
        400
      );
    }

    const newGoal = new DailyGoal({
      user: user._id,
      type,
      target,
      isActive: isActive !== undefined ? isActive : true,
    });

    const savedGoal = await newGoal.save();
    return res.status(201).json(savedGoal);
  } catch (error) {
    return next(error as customError);
  }
}

export async function updateDailyGoal(
  req: Request<{ goalId: string }, any, Partial<IDailyGoal>>,
  res: Response,
  next: NextFunction
) {
  try {
    const { user } = res.locals;
    const { goalId } = req.params;
    const { type, target, isActive } = req.body;

    const goal = await DailyGoal.findOne({
      _id: goalId,
      user: user._id,
    });

    if (!goal) {
      throw new customError('Goal not found', 404);
    }

    // Validate target if provided
    if (target !== undefined && target <= 0) {
      throw new customError('Target must be greater than 0', 400);
    }

    // Validate type if provided
    if (type !== undefined) {
      const validTypes = ['time', 'chars', 'episodes', 'pages'];
      if (!validTypes.includes(type)) {
        throw new customError('Invalid goal type', 400);
      }

      // Check if changing type would conflict with existing active goals
      if (type !== goal.type && isActive !== false) {
        const existingGoal = await DailyGoal.findOne({
          user: user._id,
          type,
          isActive: true,
          _id: { $ne: goalId },
        });

        if (existingGoal) {
          throw new customError(
            `You already have an active ${type} goal. Please deactivate it first.`,
            400
          );
        }
      }
    }

    // Update goal fields
    if (type !== undefined) goal.type = type;
    if (target !== undefined) goal.target = target;
    if (isActive !== undefined) goal.isActive = isActive;

    const updatedGoal = await goal.save();
    return res.status(200).json(updatedGoal);
  } catch (error) {
    return next(error as customError);
  }
}

export async function deleteDailyGoal(
  req: Request<{ goalId: string }>,
  res: Response,
  next: NextFunction
) {
  try {
    const { user } = res.locals;
    const { goalId } = req.params;

    const deletedGoal = await DailyGoal.findOneAndDelete({
      _id: goalId,
      user: user._id,
    });

    if (!deletedGoal) {
      throw new customError('Goal not found', 404);
    }

    return res.status(204).send();
  } catch (error) {
    return next(error as customError);
  }
}

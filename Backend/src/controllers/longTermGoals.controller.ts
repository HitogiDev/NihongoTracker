import { Request, Response, NextFunction } from 'express';
import { ParamsDictionary } from 'express-serve-static-core';
import LongTermGoal from '../models/longTermGoal.model.js';
import Log from '../models/log.model.js';
import User from '../models/user.model.js';
import { Anime } from '../models/media.model.js';
import {
  ILongTermGoal,
  ILongTermGoalProgress,
  IMediaDocument,
} from '../types.js';
import { customError } from '../middlewares/errorMiddleware.js';

const FALLBACK_TIMEZONE = 'UTC';

export async function getLongTermGoals(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { username } = req.params;
    if (!username) {
      throw new customError('Username is required', 400);
    }

    // Find user by username
    const foundUser = await User.findOne({ username });
    if (!foundUser) {
      throw new customError('User not found', 404);
    }

    // Get user's long-term goals
    const goals = await LongTermGoal.find({ user: foundUser._id }).sort({
      createdAt: -1,
    });

    // Calculate progress for each goal
    const goalsWithProgress = await Promise.all(
      goals.map(async (goal) => {
        const progress = await calculateLongTermGoalProgress(goal, foundUser);
        return {
          ...goal.toObject(),
          progress,
        };
      })
    );

    return res.status(200).json({ goals: goalsWithProgress });
  } catch (error) {
    return next(error as customError);
  }
}

export async function createLongTermGoal(
  req: Request<
    ParamsDictionary,
    any,
    Omit<ILongTermGoal, '_id' | 'user' | 'createdAt' | 'updatedAt'>
  >,
  res: Response,
  next: NextFunction
) {
  try {
    const { user } = res.locals;
    const {
      type,
      totalTarget,
      targetDate,
      displayTimeframe,
      startDate,
      isActive,
    } = req.body;

    if (!type || !totalTarget || !targetDate || !startDate) {
      throw new customError(
        'Type, totalTarget, targetDate, and startDate are required',
        400
      );
    }

    if (totalTarget <= 0) {
      throw new customError('Total target must be greater than 0', 400);
    }

    const validTypes = ['time', 'chars', 'episodes', 'pages'];
    if (!validTypes.includes(type)) {
      throw new customError('Invalid goal type', 400);
    }

    const validTimeframes = ['daily', 'weekly', 'monthly'];
    if (displayTimeframe && !validTimeframes.includes(displayTimeframe)) {
      throw new customError('Invalid display timeframe', 400);
    }

    const targetDateObj = new Date(targetDate);
    const startDateObj = new Date(startDate);

    if (targetDateObj <= new Date()) {
      throw new customError('Target date must be in the future', 400);
    }

    if (startDateObj >= targetDateObj) {
      throw new customError('Start date must be before target date', 400);
    }

    const newGoal = new LongTermGoal({
      user: user._id,
      type,
      totalTarget,
      targetDate: targetDateObj,
      displayTimeframe: displayTimeframe || 'daily',
      startDate: startDateObj,
      isActive: isActive !== undefined ? isActive : true,
    });

    const savedGoal = await newGoal.save();

    // Calculate initial progress
    const progress = await calculateLongTermGoalProgress(savedGoal, user);

    return res.status(201).json({
      ...savedGoal.toObject(),
      progress,
    });
  } catch (error) {
    return next(error as customError);
  }
}

export async function updateLongTermGoal(
  req: Request<{ goalId: string }, any, Partial<ILongTermGoal>>,
  res: Response,
  next: NextFunction
) {
  try {
    const { user } = res.locals;
    const { goalId } = req.params;
    const {
      type,
      totalTarget,
      targetDate,
      displayTimeframe,
      startDate,
      isActive,
    } = req.body;

    const goal = await LongTermGoal.findOne({
      _id: goalId,
      user: user._id,
    });

    if (!goal) {
      throw new customError('Goal not found', 404);
    }

    // Validate updates
    if (totalTarget && totalTarget <= 0) {
      throw new customError('Total target must be greater than 0', 400);
    }

    if (type && !['time', 'chars', 'episodes', 'pages'].includes(type)) {
      throw new customError('Invalid goal type', 400);
    }

    if (
      displayTimeframe &&
      !['daily', 'weekly', 'monthly'].includes(displayTimeframe)
    ) {
      throw new customError('Invalid display timeframe', 400);
    }

    if (targetDate) {
      const targetDateObj = new Date(targetDate);
      if (targetDateObj <= new Date()) {
        throw new customError('Target date must be in the future', 400);
      }
      goal.targetDate = targetDateObj;
    }

    if (startDate) {
      const startDateObj = new Date(startDate);
      if (
        startDateObj >= (targetDate ? new Date(targetDate) : goal.targetDate)
      ) {
        throw new customError('Start date must be before target date', 400);
      }
      goal.startDate = startDateObj;
    }

    // Update fields
    if (type) goal.type = type;
    if (totalTarget) goal.totalTarget = totalTarget;
    if (displayTimeframe) goal.displayTimeframe = displayTimeframe;
    if (isActive !== undefined) goal.isActive = isActive;

    const updatedGoal = await goal.save();

    // Calculate updated progress
    const progress = await calculateLongTermGoalProgress(updatedGoal, user);

    return res.status(200).json({
      ...updatedGoal.toObject(),
      progress,
    });
  } catch (error) {
    return next(error as customError);
  }
}

export async function deleteLongTermGoal(
  req: Request<{ goalId: string }>,
  res: Response,
  next: NextFunction
) {
  try {
    const { user } = res.locals;
    const { goalId } = req.params;

    const goal = await LongTermGoal.findOneAndDelete({
      _id: goalId,
      user: user._id,
    });

    if (!goal) {
      throw new customError('Goal not found', 404);
    }

    return res
      .status(200)
      .json({ message: 'Long-term goal deleted successfully' });
  } catch (error) {
    return next(error as customError);
  }
}

// Helper function to calculate long-term goal progress
async function calculateLongTermGoalProgress(
  goal: ILongTermGoal,
  user: any
): Promise<ILongTermGoalProgress> {
  const userTimezone = user.settings?.timezone || FALLBACK_TIMEZONE;
  const now = new Date();

  // Calculate remaining days
  const targetDate = new Date(goal.targetDate);
  const remainingMs = targetDate.getTime() - now.getTime();
  const remainingDays = Math.max(
    0,
    Math.ceil(remainingMs / (1000 * 60 * 60 * 24))
  );

  // Get all logs since goal start date
  const logs = await Log.find({
    user: goal.user,
    date: { $gte: goal.startDate, $lte: now },
  });

  // Get anime media documents for episode duration calculation
  const animeLogMediaIds = logs
    .filter((log) => log.type === 'anime' && log.mediaId && log.episodes)
    .map((log) => log.mediaId);

  const mediaDocuments: IMediaDocument[] | [] =
    animeLogMediaIds.length > 0
      ? await Anime.find({ contentId: { $in: animeLogMediaIds } })
      : [];

  const mediaMap = new Map(
    mediaDocuments.map((media) => [media.contentId, media])
  );

  // Calculate total progress
  let totalProgress = 0;
  let progressToday = 0;
  let progressThisWeek = 0;
  let progressThisMonth = 0;

  // Date boundaries - calculate in user timezone
  const userNow = new Date(
    now.toLocaleString('en-US', { timeZone: userTimezone })
  );

  const startOfDay = new Date(
    userNow.getFullYear(),
    userNow.getMonth(),
    userNow.getDate()
  );
  const startOfWeek = new Date(startOfDay);
  startOfWeek.setDate(startOfDay.getDate() - startOfDay.getDay()); // Sunday
  const startOfMonth = new Date(userNow.getFullYear(), userNow.getMonth(), 1);

  logs.forEach((log) => {
    let logValue = 0;

    if (goal.type === 'time') {
      if (log.time && log.time > 0) {
        logValue = log.time;
      } else if (log.type === 'anime' && log.episodes) {
        const media = log.mediaId ? mediaMap.get(log.mediaId) : null;
        const episodeDuration = media?.episodeDuration || 24;
        logValue = log.episodes * episodeDuration;
      }
    } else if (goal.type === 'chars' && log.chars) {
      logValue = log.chars;
    } else if (goal.type === 'episodes' && log.episodes) {
      logValue = log.episodes;
    } else if (goal.type === 'pages' && log.pages) {
      logValue = log.pages;
    }

    totalProgress += logValue;

    // Convert log date to user timezone for comparison
    const logDateInUserTz = new Date(
      log.date.toLocaleString('en-US', { timeZone: userTimezone })
    );

    // Create comparable dates (same timezone)
    const logDayStart = new Date(
      logDateInUserTz.getFullYear(),
      logDateInUserTz.getMonth(),
      logDateInUserTz.getDate()
    );

    if (logDayStart.getTime() === startOfDay.getTime()) {
      progressToday += logValue;
    }
    if (logDateInUserTz >= startOfWeek) {
      progressThisWeek += logValue;
    }
    if (logDateInUserTz >= startOfMonth) {
      progressThisMonth += logValue;
    }
  });

  const remainingTarget = Math.max(0, goal.totalTarget - totalProgress);

  // Calculate required progress per timeframe
  let requiredPerTimeframe = 0;
  let timeframeName = '';

  if (remainingDays > 0) {
    if (goal.displayTimeframe === 'daily') {
      requiredPerTimeframe = remainingTarget / remainingDays;
      timeframeName = 'today';
    } else if (goal.displayTimeframe === 'weekly') {
      const remainingWeeks = Math.max(1, Math.ceil(remainingDays / 7));
      requiredPerTimeframe = remainingTarget / remainingWeeks;
      timeframeName = 'this week';
    } else if (goal.displayTimeframe === 'monthly') {
      const remainingMonths = Math.max(1, Math.ceil(remainingDays / 30));
      requiredPerTimeframe = remainingTarget / remainingMonths;
      timeframeName = 'this month';
    }
  }

  // Check if on track
  const isOnTrack =
    remainingTarget <= 0 || (remainingDays > 0 && requiredPerTimeframe > 0);

  return {
    goalId: goal._id,
    totalProgress,
    requiredPerTimeframe: Math.ceil(requiredPerTimeframe),
    remainingDays,
    remainingTarget,
    isOnTrack,
    timeframeName,
    progressToday,
    progressThisWeek,
    progressThisMonth,
  };
}

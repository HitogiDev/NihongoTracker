import { Request, Response, NextFunction } from 'express';
import { ParamsDictionary } from 'express-serve-static-core';
import LongTermGoal from '../models/longTermGoal.model.js';
import Log from '../models/log.model.js';
import User from '../models/user.model.js';
import { Anime } from '../models/media.model.js';
import {
  ILongTermGoal,
  ILongTermGoalProgress,
  IMediaDocument
} from '../types.js';
import { customError } from '../middlewares/errorMiddleware.js';
import { apiError } from '../i18n/errorCodes.js';
import { isValidGoalMediaType } from '../services/goalMediaType.js';
import { goalTodayKey, isGoalTargetDatePast } from '../services/goalPeriod.js';
import { requireGoalVisibility } from '../services/goalVisibility.js';

const FALLBACK_TIMEZONE = 'UTC';

export async function getLongTermGoals(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { username } = req.params;
    if (!username) {
      throw apiError('user.usernameRequired', 400, 'Username is required');
    }

    // Find user by username
    const foundUser = await User.findOne({ username });
    if (!foundUser) {
      throw apiError('user.notFound', 404, 'User not found');
    }

    await requireGoalVisibility(foundUser, res.locals.user);

    // Get user's long-term goals
    const goals = await LongTermGoal.find({ user: foundUser._id }).sort({
      createdAt: -1
    });

    // Calculate progress for each goal
    const goalsWithProgress = await Promise.all(
      goals.map(async (goal) => {
        const progress = await calculateLongTermGoalProgress(goal, foundUser);
        return {
          ...goal.toObject(),
          progress
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
      mediaType,
      totalTarget,
      targetDate,
      displayTimeframe,
      startDate,
      isActive
    } = req.body;

    if (!type || !totalTarget || !targetDate || !startDate) {
      throw apiError(
        'goal.longTermFieldsRequired',
        400,
        'Type, totalTarget, targetDate, and startDate are required'
      );
    }

    if (totalTarget <= 0) {
      throw apiError(
        'goal.totalTargetPositive',
        400,
        'Total target must be greater than 0'
      );
    }

    const validTypes = ['time', 'chars', 'episodes', 'pages'];
    if (!validTypes.includes(type)) {
      throw apiError('goal.invalidType', 400, 'Invalid goal type');
    }
    if (mediaType != null && !isValidGoalMediaType(mediaType)) {
      throw apiError('goal.invalidType', 400, 'Invalid media type');
    }

    const validTimeframes = ['daily', 'weekly', 'monthly'];
    if (displayTimeframe && !validTimeframes.includes(displayTimeframe)) {
      throw apiError('goal.invalidTimeframe', 400, 'Invalid display timeframe');
    }

    const targetDateObj = new Date(targetDate);
    const startDateObj = new Date(startDate);

    if (
      isGoalTargetDatePast(
        targetDateObj,
        user.settings?.timezone || FALLBACK_TIMEZONE
      )
    ) {
      throw apiError(
        'goal.targetInFuture',
        400,
        'Target date must be today or later'
      );
    }

    if (startDateObj > targetDateObj) {
      throw apiError(
        'goal.startBeforeTarget',
        400,
        'Start date must be on or before target date'
      );
    }

    const newGoal = new LongTermGoal({
      user: user._id,
      type,
      mediaType: mediaType ?? null,
      totalTarget,
      targetDate: targetDateObj,
      displayTimeframe: displayTimeframe || 'daily',
      startDate: startDateObj,
      isActive: isActive !== undefined ? isActive : true
    });

    const savedGoal = await newGoal.save();

    // Calculate initial progress
    const progress = await calculateLongTermGoalProgress(savedGoal, user);

    return res.status(201).json({
      ...savedGoal.toObject(),
      progress
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
      mediaType,
      totalTarget,
      targetDate,
      displayTimeframe,
      startDate,
      isActive
    } = req.body;

    const goal = await LongTermGoal.findOne({
      _id: goalId,
      user: user._id
    });

    if (!goal) {
      throw apiError('goal.notFound', 404, 'Goal not found');
    }

    // Validate updates
    if (totalTarget && totalTarget <= 0) {
      throw apiError(
        'goal.totalTargetPositive',
        400,
        'Total target must be greater than 0'
      );
    }

    if (type && !['time', 'chars', 'episodes', 'pages'].includes(type)) {
      throw apiError('goal.invalidType', 400, 'Invalid goal type');
    }
    if (mediaType != null && !isValidGoalMediaType(mediaType)) {
      throw apiError('goal.invalidType', 400, 'Invalid media type');
    }

    if (
      displayTimeframe &&
      !['daily', 'weekly', 'monthly'].includes(displayTimeframe)
    ) {
      throw apiError('goal.invalidTimeframe', 400, 'Invalid display timeframe');
    }

    if (targetDate) {
      const targetDateObj = new Date(targetDate);
      if (
        isGoalTargetDatePast(
          targetDateObj,
          user.settings?.timezone || FALLBACK_TIMEZONE
        )
      ) {
        throw apiError(
          'goal.targetInFuture',
          400,
          'Target date must be today or later'
        );
      }
      goal.targetDate = targetDateObj;
    }

    if (startDate) {
      const startDateObj = new Date(startDate);
      if (startDateObj > goal.targetDate) {
        throw apiError(
          'goal.startBeforeTarget',
          400,
          'Start date must be on or before target date'
        );
      }
      goal.startDate = startDateObj;
    }

    if (goal.startDate > goal.targetDate) {
      throw apiError(
        'goal.startBeforeTarget',
        400,
        'Start date must be on or before target date'
      );
    }

    // Update fields
    if (type) goal.type = type;
    if (mediaType !== undefined) goal.mediaType = mediaType;
    if (totalTarget) goal.totalTarget = totalTarget;
    if (displayTimeframe) goal.displayTimeframe = displayTimeframe;
    if (isActive !== undefined) goal.isActive = isActive;

    const updatedGoal = await goal.save();

    // Calculate updated progress
    const progress = await calculateLongTermGoalProgress(updatedGoal, user);

    return res.status(200).json({
      ...updatedGoal.toObject(),
      progress
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
      user: user._id
    });

    if (!goal) {
      throw apiError('goal.notFound', 404, 'Goal not found');
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

  // Dates represent whole calendar days in the goal owner's timezone.
  const targetDate = new Date(goal.targetDate);
  const todayKey = goalTodayKey(userTimezone, now);
  const targetKey = targetDate.toISOString().slice(0, 10);
  const startKey = new Date(goal.startDate).toISOString().slice(0, 10);
  const remainingMs =
    targetDate.getTime() - Date.parse(`${todayKey}T00:00:00Z`);
  const remainingDays = Math.max(
    0,
    Math.round(remainingMs / (1000 * 60 * 60 * 24))
  );

  // Fetch around the first calendar day, then compare each log in the user's timezone.
  const candidateLogs = await Log.find({
    user: goal.user,
    date: {
      $gte: new Date(new Date(goal.startDate).getTime() - 86_400_000),
      $lte: now
    },
    ...(goal.mediaType ? { type: goal.mediaType } : {})
  });
  const logs = candidateLogs.filter((log) => {
    const logDay = goalTodayKey(userTimezone, log.date);
    return logDay >= startKey && logDay <= targetKey;
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

  if (targetKey >= todayKey) {
    const remainingDaysInclusive = remainingDays + 1;
    if (goal.displayTimeframe === 'daily') {
      requiredPerTimeframe = remainingTarget / remainingDaysInclusive;
      timeframeName = 'today';
    } else if (goal.displayTimeframe === 'weekly') {
      const remainingWeeks = Math.max(1, Math.ceil(remainingDaysInclusive / 7));
      requiredPerTimeframe = remainingTarget / remainingWeeks;
      timeframeName = 'this week';
    } else if (goal.displayTimeframe === 'monthly') {
      const remainingMonths = Math.max(
        1,
        Math.ceil(remainingDaysInclusive / 30)
      );
      requiredPerTimeframe = remainingTarget / remainingMonths;
      timeframeName = 'this month';
    }
  }

  // Check if on track using linear pacing
  const startDate = new Date(goal.startDate);
  const totalDurationMs =
    targetDate.getTime() + 86_400_000 - startDate.getTime();
  const localClock = Date.UTC(
    userNow.getFullYear(),
    userNow.getMonth(),
    userNow.getDate(),
    userNow.getHours(),
    userNow.getMinutes(),
    userNow.getSeconds()
  );
  const elapsedDurationMs = localClock - startDate.getTime();

  const expectedProgress =
    totalDurationMs > 0
      ? goal.totalTarget *
        Math.min(1, Math.max(0, elapsedDurationMs / totalDurationMs))
      : 0;

  const isOnTrack = remainingTarget <= 0 || totalProgress >= expectedProgress;

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
    progressThisMonth
  };
}

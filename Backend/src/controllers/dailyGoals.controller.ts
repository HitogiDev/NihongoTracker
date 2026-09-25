import { Request, Response, NextFunction } from 'express';
import { ParamsDictionary } from 'express-serve-static-core';
import DailyGoal from '../models/dailyGoal.model.js';
import Log from '../models/log.model.js';
import User from '../models/user.model.js';
import { Anime } from '../models/media.model.js';
import { IDailyGoal, IDailyGoalProgress, IMediaDocument } from '../types.js';
import { customError } from '../middlewares/errorMiddleware.js';
import { apiError } from '../i18n/errorCodes.js';

const FALLBACK_TIMEZONE = 'UTC';

function dateParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  return Object.fromEntries(parts.map(({ type, value }) => [type, value]));
}

function zonedMidnightUtc(localDate: Date, timeZone: string) {
  const utcGuess = Date.UTC(
    localDate.getFullYear(),
    localDate.getMonth(),
    localDate.getDate()
  );
  const parts = dateParts(new Date(utcGuess), timeZone);
  const representedUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );
  return new Date(utcGuess - (representedUtc - utcGuess));
}

export async function getDailyGoals(
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
    const foundUserId = foundUser._id;

    // Get user's goals
    const goals = await DailyGoal.find({ user: foundUserId }).sort({
      createdAt: -1,
    });

    // Calculate today's progress using user's timezone
    const userTimezone = foundUser.settings?.timezone || FALLBACK_TIMEZONE;

    // Get the current date in the user's timezone
    const now = new Date();
    const currentParts = dateParts(now, userTimezone);
    const userDate = new Date(
      Number(currentParts.year),
      Number(currentParts.month) - 1,
      Number(currentParts.day)
    );
    const startOfDay = zonedMidnightUtc(userDate, userTimezone);
    const endOfDay = zonedMidnightUtc(
      new Date(userDate.getFullYear(), userDate.getMonth(), userDate.getDate() + 1),
      userTimezone
    );
    // Weekly windows follow the app's Sunday-through-Saturday convention.
    const startOfWeekLocal = new Date(userDate);
    startOfWeekLocal.setDate(
      startOfWeekLocal.getDate() - startOfWeekLocal.getDay()
    );
    const endOfWeekLocal = new Date(startOfWeekLocal);
    endOfWeekLocal.setDate(endOfWeekLocal.getDate() + 7);
    const startOfWeek = zonedMidnightUtc(startOfWeekLocal, userTimezone);
    const endOfWeek = zonedMidnightUtc(endOfWeekLocal, userTimezone);

    async function calculateProgress(
      start: Date,
      end: Date,
      dateLabel: string
    ) {
      const logs = await Log.find({
        user: foundUserId,
        date: { $gte: start, $lt: end },
      });
      const progress: IDailyGoalProgress = {
        date: dateLabel,
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

    // Sum up today's activity
    logs.forEach((log) => {
      if (log.time && log.time > 0) {
        progress.time += log.time;
      } else if (log.type === 'anime' && log.episodes) {
        const media = log.mediaId ? mediaMap.get(log.mediaId) : null;
        const episodeDuration = media?.episodeDuration || 24;
        progress.time += log.episodes * episodeDuration;
      }

      // Count characters from any log that has chars field
      if (log.chars) progress.chars += log.chars;
      if (log.episodes) progress.episodes += log.episodes;
      if (log.pages) progress.pages += log.pages;
    });

      return progress;
    }

    const todayProgress = await calculateProgress(
      startOfDay,
      endOfDay,
      `${currentParts.year}-${currentParts.month}-${currentParts.day}`
    );
    const weekStartParts = dateParts(startOfWeek, userTimezone);
    const weeklyProgress = await calculateProgress(
      startOfWeek,
      endOfWeek,
      `${weekStartParts.year}-${weekStartParts.month}-${weekStartParts.day}`
    );

    // Check completion status for each active goal
    goals.forEach((goal) => {
      if (goal.isActive) {
        const progress =
          goal.cadence === 'weekly' ? weeklyProgress : todayProgress;
        const currentProgress = progress[goal.type];
        progress.completed[goal.type] = currentProgress >= goal.target;
      }
    });

    return res.status(200).json({
      goals,
      todayProgress,
      weeklyProgress,
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
    const { type, target, isActive, cadence = 'daily' } = req.body;

    if (!type || !target) {
      throw apiError(
        'goal.typeAndTargetRequired',
        400,
        'Type and target are required'
      );
    }

    if (target <= 0) {
      throw apiError(
        'goal.targetPositive',
        400,
        'Target must be greater than 0'
      );
    }

    const validTypes = ['time', 'chars', 'episodes', 'pages'];
    if (!validTypes.includes(type)) {
      throw apiError('goal.invalidType', 400, 'Invalid goal type');
    }
    if (!['daily', 'weekly'].includes(cadence)) {
      throw apiError('goal.invalidTimeframe', 400, 'Invalid goal cadence');
    }

    // Check if user already has an active goal of this type
    const existingGoal = await DailyGoal.findOne({
      user: user._id,
      type,
      ...(cadence === 'daily'
        ? { $or: [{ cadence: 'daily' }, { cadence: { $exists: false } }] }
        : { cadence }),
      isActive: true,
    });

    if (existingGoal) {
      throw apiError(
        'goal.alreadyActive',
        400,
        `You already have an active ${type} goal. Please deactivate it first.`,
        { type: String(type) }
      );
    }

    const newGoal = new DailyGoal({
      user: user._id,
      type,
      cadence,
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
    const { type, target, isActive, cadence } = req.body;

    const goal = await DailyGoal.findOne({
      _id: goalId,
      user: user._id,
    });

    if (!goal) {
      throw apiError('goal.notFound', 404, 'Goal not found');
    }

    if (cadence !== undefined && !['daily', 'weekly'].includes(cadence)) {
      throw apiError('goal.invalidTimeframe', 400, 'Invalid goal cadence');
    }

    // Validate target if provided
    if (target !== undefined && target <= 0) {
      throw apiError(
        'goal.targetPositive',
        400,
        'Target must be greater than 0'
      );
    }

    // Validate the resulting type and cadence together when either changes.
    if (type !== undefined) {
      const validTypes = ['time', 'chars', 'episodes', 'pages'];
      if (!validTypes.includes(type)) {
        throw apiError('goal.invalidType', 400, 'Invalid goal type');
      }

      // Check if changing type would conflict with existing active goals
    }

    const nextType = type ?? goal.type;
    const nextCadence = cadence ?? goal.cadence ?? 'daily';
    if (
      isActive !== false &&
      (nextType !== goal.type || nextCadence !== (goal.cadence ?? 'daily'))
    ) {
      const existingGoal = await DailyGoal.findOne({
        user: user._id,
        type: nextType,
        ...(nextCadence === 'daily'
          ? { $or: [{ cadence: 'daily' }, { cadence: { $exists: false } }] }
          : { cadence: nextCadence }),
        isActive: true,
        _id: { $ne: goalId },
      });
      if (existingGoal) {
        throw apiError(
          'goal.alreadyActive',
          400,
          `You already have an active ${nextType} goal. Please deactivate it first.`,
          { type: String(nextType) }
        );
      }
    }

    // Update goal fields
    if (type !== undefined) goal.type = type;
    if (cadence !== undefined) goal.cadence = cadence;
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
      throw apiError('goal.notFound', 404, 'Goal not found');
    }

    return res.status(204).send();
  } catch (error) {
    return next(error as customError);
  }
}

import { Response, NextFunction } from 'express';
import { IEditedFields, ILog, IStats, IUser } from '../types.js';
import { calculateLevel, calculateXp } from './calculateLevel.js';
import { customError } from '../middlewares/errorMiddleware.js';
import User from '../models/user.model.js';

function updateField(
  newValue: number | undefined,
  oldValue: number | undefined
): number {
  return (newValue || 0) - (oldValue || 0);
}

export function updateLevelAndXp(userStats: any, field: string) {
  userStats[`${field}Level`] = calculateLevel(userStats[`${field}Xp`]);
  userStats[`${field}XpToNextLevel`] = calculateXp(
    userStats[`${field}Level`] + 1
  );
  userStats[`${field}XpToCurrentLevel`] = calculateXp(
    userStats[`${field}Level`]
  );
}

export default async function updateStats(
  res: Response,
  _next: NextFunction,
  isDelete: boolean = false
): Promise<void | IStats> {
  try {
    const user: IUser | null = await User.findById(res.locals.user.id);
    if (!user || !user.stats) {
      throw new customError('User does not have stats', 404);
    }
    let type: string,
      xp: number,
      editedFields: IEditedFields | null | undefined;
    let log: ILog | null;
    const userStats = user.stats;
    if (res.locals.importedStats) {
      type = 'imported';
      xp =
        res.locals.importedStats.listeningXp +
        res.locals.importedStats.readingXp;
      log = null;
    } else {
      log = res.locals.log as ILog;
      type = log.type;
      xp = log.xp;
      editedFields = log.editedFields;
    }

    // Modify XP update logic
    const xpUpdate = isDelete ? -xp : updateField(xp, editedFields?.xp);
    userStats.userXp = Math.max(0, userStats.userXp + xpUpdate);

    switch (type) {
      case 'anime':
      case 'video':
      case 'movie':
      case 'audio':
        userStats.listeningXp = Math.max(0, userStats.listeningXp + xpUpdate);
        break;
      case 'manga':
      case 'reading':
      case 'vn':
        userStats.readingXp = Math.max(0, userStats.readingXp + xpUpdate);
        break;
      case 'other':
        break;
      case 'imported':
        userStats.listeningXp += res.locals.importedStats.listeningXp;
        userStats.readingXp += res.locals.importedStats.readingXp;
        break;
      default:
        throw new customError('Invalid content type', 400);
    }

    // Update levels and XP
    updateLevelAndXp(userStats, 'listening');
    updateLevelAndXp(userStats, 'reading');
    updateLevelAndXp(userStats, 'user');

    // Ensure we're handling NaN values
    if (isNaN(userStats.listeningXp)) {
      userStats.listeningXp = 0;
    }
    if (isNaN(userStats.readingXp)) {
      userStats.readingXp = 0;
    }

    user.markModified('stats');
    await user.save();

    return userStats as IStats;
  } catch (error) {
    throw error as customError;
  }
}

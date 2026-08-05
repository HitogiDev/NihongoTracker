import { Response, NextFunction } from 'express';
import { customError } from '../middlewares/errorMiddleware.js';
import { apiError } from '../i18n/errorCodes.js';
import { Types } from 'mongoose';
import { IEditedFields, ILog, IStats, IUser } from '../types.js';
import { calculateLevel, calculateXp } from './calculateLevel.js';
import User from '../models/user.model.js';
import Log from '../models/log.model.js';

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

/**
 * Recompute a user's XP totals/levels from scratch by aggregating all of their
 * remaining logs. Used after bulk deletions, where applying per-log deltas would
 * cause concurrent writes to the same user document (Mongoose VersionError).
 */
export async function recalculateUserXpFromLogs(
  userId: Types.ObjectId | string
): Promise<void> {
  const user = await User.findById(userId);
  if (!user || !user.stats) {
    throw apiError('user.notFound', 404, 'User not found');
  }

  const aggregated = await Log.aggregate([
    { $match: { user: user._id } },
    {
      $group: {
        _id: null,
        totalXp: { $sum: '$xp' },
        listeningXp: {
          $sum: {
            $cond: [
              {
                $in: ['$type', ['anime', 'video', 'movie', 'tv show', 'audio']],
              },
              '$xp',
              0,
            ],
          },
        },
        readingXp: {
          $sum: {
            $cond: [
              { $in: ['$type', ['manga', 'reading', 'vn', 'game', 'book']] },
              '$xp',
              0,
            ],
          },
        },
      },
    },
  ]);

  const totals = aggregated[0] ?? {
    totalXp: 0,
    listeningXp: 0,
    readingXp: 0,
  };

  user.stats.userXp = Math.max(0, totals.totalXp);
  user.stats.listeningXp = Math.max(0, totals.listeningXp);
  user.stats.readingXp = Math.max(0, totals.readingXp);

  updateLevelAndXp(user.stats, 'user');
  updateLevelAndXp(user.stats, 'listening');
  updateLevelAndXp(user.stats, 'reading');

  user.markModified('stats');
  await user.save();
}

export default async function updateStats(
  res: Response,
  _next: NextFunction,
  isDelete: boolean = false
): Promise<void | IStats> {
  try {
    const user: IUser | null = await User.findById(res.locals.user.id);
    if (!user || !user.stats) {
      throw apiError('user.noStats', 404, 'User does not have stats');
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
      case 'tv show':
      case 'audio':
        userStats.listeningXp = Math.max(0, userStats.listeningXp + xpUpdate);
        break;
      case 'manga':
      case 'reading':
      case 'vn':
      case 'game':
      case 'book':
        userStats.readingXp = Math.max(0, userStats.readingXp + xpUpdate);
        break;
      case 'other':
        break;
      case 'imported':
        userStats.listeningXp += res.locals.importedStats.listeningXp;
        userStats.readingXp += res.locals.importedStats.readingXp;
        break;
      default:
        throw apiError('media.invalidContentType', 400, 'Invalid content type');
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

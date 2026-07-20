import { Request, Response, NextFunction } from 'express';
import { ParamsDictionary } from 'express-serve-static-core';
import { MediaBase, Anime, Manga, Reading } from '../models/media.model.js';
import UserMediaStatus from '../models/userMediaStatus.model.js';
import {
  ILog,
  IEditedFields,
  ICreateLog,
  IMediaDocument,
  IManabeLogs,
  ILogCelebration,
  IUser,
  userRoles,
} from '../types.js';
import Log from '../models/log.model.js';
import User from '../models/user.model.js';
import { ObjectId, PipelineStage, Types } from 'mongoose';
import { customError } from '../middlewares/errorMiddleware.js';
import updateStats from '../services/updateStats.js';
import {
  recalculateStreaksForUser,
  updateStreakWithLog,
  getLiveCurrentStreak,
} from '../services/streaks.js';
import { searchAnilist } from '../services/searchAnilist.js';
import { updateLevelAndXp } from '../services/updateStats.js';
import { getYouTubeChannelInfo } from '../services/searchYoutube.js';
import axios from 'axios';
import { evaluateAutoCompleteForUserMedia } from '../services/autoComplete.js';
import { recalculateAllUsersXpV2 } from '../services/xpMigration.js';
import { addDocuments } from '../services/meilisearch/meiliSearch.js';
import { checkAchievements } from '../services/achievements/achievementEngine.js';
import UserAchievement from '../models/userAchievement.model.js';
import { computeMonthlyOvertakes } from '../services/overtake.service.js';

interface IMediaTitleFallback {
  contentTitleNative?: string;
  contentTitleRomaji?: string;
  contentTitleEnglish?: string;
}

interface IMediaWithTitle {
  title?: IMediaTitleFallback;
}

function getMediaTitle(media?: IMediaWithTitle | null): string {
  if (!media?.title) return '';

  return (
    media.title.contentTitleNative ||
    media.title.contentTitleRomaji ||
    media.title.contentTitleEnglish ||
    ''
  );
}

function getDescriptionWithMediaFallback(
  description: string | null | undefined,
  media?: IMediaWithTitle | null
): string {
  if (typeof description === 'string' && description.trim().length > 0) {
    return description;
  }

  return getMediaTitle(media);
}

function hasAdminRole(user?: Partial<IUser> | null): boolean {
  const roles = user?.roles;

  if (!Array.isArray(roles)) {
    return false;
  }

  return roles.includes(userRoles.admin);
}

function isOwner(user: Partial<IUser> | null | undefined, ownerId: unknown) {
  if (!user?._id || !ownerId) {
    return false;
  }

  return user._id.toString() === ownerId.toString();
}

function canViewPrivateLog(
  user: Partial<IUser> | null | undefined,
  ownerId: unknown
) {
  return hasAdminRole(user) || isOwner(user, ownerId);
}

export async function getUntrackedLogs(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  const { user } = res.locals;
  try {
    const untrackedLogs = await Log.find({
      user: user._id,
      type: {
        $in: ['anime', 'manga', 'reading', 'vn', 'video', 'movie', 'game'],
      },
      $or: [
        { mediaId: { $exists: false } },
        { mediaId: null },
        { mediaId: undefined },
        { mediaId: '' },
      ],
    });
    return res.status(200).json(untrackedLogs);
  } catch (error) {
    return next(error as customError);
  }
}

export async function getRecentLogs(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const { user } = res.locals as { user: Omit<IUser, 'password'> };
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 4;

  try {
    const recentLogs = await Log.aggregate([
      {
        $match: {
          user: user._id,
          mediaId: {
            $exists: true,
            $nin: [null, '', ...(user.settings?.hiddenRecentMedia || [])],
          },
        },
      },
      {
        $sort: {
          date: -1,
        },
      },
      {
        $group: {
          _id: '$mediaId',
          log: { $first: '$$ROOT' },
        },
      },
      {
        $replaceRoot: {
          newRoot: '$log',
        },
      },
      {
        $sort: {
          date: -1,
        },
      },
      {
        $lookup: {
          from: 'usermediastatuses',
          let: {
            mediaId: '$mediaId',
            logType: '$type',
            userId: '$user',
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$mediaId', '$$mediaId'] },
                    { $eq: ['$type', '$$logType'] },
                    { $eq: ['$user', '$$userId'] },
                  ],
                },
              },
            },
            {
              $project: {
                completed: 1,
              },
            },
          ],
          as: 'completionStatus',
        },
      },
      {
        $addFields: {
          isCompleted: {
            $ifNull: [{ $first: '$completionStatus.completed' }, false],
          },
        },
      },
      {
        $match: {
          isCompleted: { $ne: true },
        },
      },
      {
        $limit: limit,
      },
      {
        $lookup: {
          from: 'users',
          localField: 'user',
          foreignField: '_id',
          as: 'user',
        },
      },
      {
        $unwind: {
          path: '$user',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: 'media',
          localField: 'mediaId',
          foreignField: 'contentId',
          as: 'media',
        },
      },
      {
        $unwind: {
          path: '$media',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          _id: 1,
          date: 1,
          unknownDate: 1,
          description: 1,
          type: 1,
          time: 1,
          episodes: 1,
          volume: 1,
          mediaId: 1,
          manabeId: 1,
          media: 1,
          xp: 1,
          isAdult: {
            $ifNull: ['$media.isAdult', false],
          },
        },
      },
    ]);

    const normalizedRecentLogs = recentLogs.map((log) => ({
      ...log,
      description: getDescriptionWithMediaFallback(log.description, log.media),
    }));

    return res.status(200).json(normalizedRecentLogs);
  } catch (error) {
    return next(error as customError);
  }
}

export async function getGlobalFeed(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const { user } = res.locals;
  const limitParam = parseInt(req.query.limit as string) || 20;
  const limit = Math.min(limitParam, 100);
  const typeFilter = (req.query.type as string) || 'all';
  const timeRange = (req.query.timeRange as string) || 'day';
  const includeSelf = req.query.includeSelf === 'true';

  try {
    const matchStage: PipelineStage.Match['$match'] = {
      private: { $ne: true },
    };

    if (!includeSelf && user?._id) {
      matchStage.user = { $ne: user._id };
    }

    if (typeFilter !== 'all') {
      matchStage.type = typeFilter;
    }

    const now = new Date();
    const matchDateRange = (date: Date) => {
      matchStage.date = { $gte: date };
    };

    switch (timeRange) {
      case 'day': {
        const threshold = new Date(now);
        threshold.setDate(threshold.getDate() - 1);
        matchDateRange(threshold);
        break;
      }
      case 'week': {
        const threshold = new Date(now);
        threshold.setDate(threshold.getDate() - 7);
        matchDateRange(threshold);
        break;
      }
      case 'month': {
        const threshold = new Date(now);
        threshold.setMonth(threshold.getMonth() - 1);
        matchDateRange(threshold);
        break;
      }
      case 'year': {
        const threshold = new Date(now);
        threshold.setFullYear(threshold.getFullYear() - 1);
        matchDateRange(threshold);
        break;
      }
      default:
        break;
    }

    const feedLogs = await Log.aggregate([
      { $match: matchStage },
      { $sort: { date: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: 'users',
          localField: 'user',
          foreignField: '_id',
          as: 'user',
        },
      },
      {
        $unwind: {
          path: '$user',
          preserveNullAndEmptyArrays: false,
        },
      },
      {
        $lookup: {
          from: 'media',
          localField: 'mediaId',
          foreignField: 'contentId',
          as: 'media',
        },
      },
      {
        $unwind: {
          path: '$media',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          _id: 1,
          date: 1,
          unknownDate: 1,
          description: 1,
          type: 1,
          xp: 1,
          episodes: 1,
          volume: 1,
          pages: 1,
          chars: 1,
          time: 1,
          isAdult: {
            $ifNull: ['$media.isAdult', false],
          },
          mediaTitle: 1,
          user: {
            username: '$user.username',
            avatar: '$user.avatar',
          },
          media: {
            contentId: '$media.contentId',
            title: '$media.title',
            contentImage: '$media.contentImage',
            coverImage: '$media.coverImage',
            type: '$media.type',
            isAdult: '$media.isAdult',
            isAdultImage: '$media.isAdultImage',
          },
        },
      },
    ]);

    const normalizedFeedLogs = feedLogs.map((log) => ({
      ...log,
      description: getDescriptionWithMediaFallback(log.description, log.media),
    }));

    return res.status(200).json(normalizedFeedLogs);
  } catch (error) {
    return next(error as customError);
  }
}

export async function getDashboardHours(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  const { user } = res.locals;
  try {
    // Use user's timezone for date calculations
    const userTimezone = user.settings?.timezone || 'UTC';
    const now = new Date();

    // Get current date in user's timezone
    const userDate = new Date(
      now.toLocaleString('en-US', { timeZone: userTimezone })
    );
    const offsetNow = now.getTime() - userDate.getTime();

    const currentMonthStartLocal = new Date(
      userDate.getFullYear(),
      userDate.getMonth(),
      1
    );

    const currentMonthStart = new Date(
      currentMonthStartLocal.getTime() + offsetNow
    );

    const previousMonthStartLocal = new Date(
      userDate.getFullYear(),
      userDate.getMonth() - 1,
      1
    );
    const previousMonthStart = new Date(
      previousMonthStartLocal.getTime() + offsetNow
    );

    const lastDayOfPreviousMonth = new Date(
      userDate.getFullYear(),
      userDate.getMonth(),
      0
    ).getDate();

    const dayToUse = Math.min(userDate.getDate(), lastDayOfPreviousMonth);

    const previousMonthActualDateLocal = new Date(
      userDate.getFullYear(),
      userDate.getMonth() - 1,
      dayToUse
    );
    const previousMonthActualDate = new Date(
      previousMonthActualDateLocal.getTime() + offsetNow
    );

    const readingTypes = ['reading', 'manga', 'vn', 'game'];
    const listeningTypes = ['anime', 'audio', 'video'];

    const currentMonthStats = await Log.aggregate([
      {
        $match: {
          user: user._id,
          date: { $gte: currentMonthStart, $lte: now },
        },
      },
      {
        $group: {
          _id: null,
          totalTime: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$type', 'anime'] },
                    {
                      $or: [
                        { $eq: ['$time', 0] },
                        { $eq: ['$time', null] },
                        { $eq: [{ $type: '$time' }, 'missing'] },
                      ],
                    },
                    { $gt: ['$episodes', 0] },
                  ],
                },
                { $multiply: ['$episodes', 24] },
                '$time',
              ],
            },
          },
          readingTime: {
            $sum: {
              $cond: [{ $in: ['$type', readingTypes] }, '$time', 0],
            },
          },
          listeningTime: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$type', 'anime'] },
                    {
                      $or: [
                        { $eq: ['$time', 0] },
                        { $eq: ['$time', null] },
                        { $eq: [{ $type: '$time' }, 'missing'] },
                      ],
                    },
                    { $gt: ['$episodes', 0] },
                  ],
                },
                { $multiply: ['$episodes', 24] },
                {
                  $cond: [{ $in: ['$type', listeningTypes] }, '$time', 0],
                },
              ],
            },
          },
        },
      },
    ]);

    const previousMonthStats = await Log.aggregate([
      {
        $match: {
          user: user._id,
          date: { $gte: previousMonthStart, $lte: previousMonthActualDate },
        },
      },
      {
        $group: {
          _id: null,
          totalTime: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$type', 'anime'] },
                    {
                      $or: [
                        { $eq: ['$time', 0] },
                        { $eq: ['$time', null] },
                        { $eq: [{ $type: '$time' }, 'missing'] },
                      ],
                    },
                    { $gt: ['$episodes', 0] },
                  ],
                },
                { $multiply: ['$episodes', 24] },
                '$time',
              ],
            },
          },
          readingTime: {
            $sum: {
              $cond: [{ $in: ['$type', readingTypes] }, '$time', 0],
            },
          },
          listeningTime: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$type', 'anime'] },
                    {
                      $or: [
                        { $eq: ['$time', 0] },
                        { $eq: ['$time', null] },
                        { $eq: [{ $type: '$time' }, 'missing'] },
                      ],
                    },
                    { $gt: ['$episodes', 0] },
                  ],
                },
                { $multiply: ['$episodes', 24] },
                {
                  $cond: [{ $in: ['$type', listeningTypes] }, '$time', 0],
                },
              ],
            },
          },
        },
      },
    ]);

    const current =
      currentMonthStats.length > 0
        ? currentMonthStats[0]
        : {
            totalTime: 0,
            readingTime: 0,
            listeningTime: 0,
          };

    const previous =
      previousMonthStats.length > 0
        ? previousMonthStats[0]
        : {
            totalTime: 0,
            readingTime: 0,
            listeningTime: 0,
          };

    delete current._id;
    delete previous._id;

    return res.status(200).json({
      currentMonth: current,
      previousMonth: previous,
    });
  } catch (error) {
    return next(error as customError);
  }
}

interface IInitialMatch {
  user: Types.ObjectId;
  type?: string | { $in: string[] };
  private?: { $ne: true };
  date?: {
    $gte?: Date;
    $lte?: Date;
  };
  description?: { $regex: string; $options: string };
  mediaTitle?: { $regex: string; $options: string };
  mediaId?: string;
  tags?: { $in: Types.ObjectId[] } | { $all: Types.ObjectId[] };
  volume?: number | { $gte?: number; $lte?: number };
  episodes?: number | { $gte?: number; $lte?: number };
  pages?: number | { $gte?: number; $lte?: number };
  chars?: number | { $gte?: number; $lte?: number };
  time?: number | { $gte?: number; $lte?: number };
}

export async function getUserLogs(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const page =
    req.query.page != undefined && parseInt(req.query.page as string) >= 0
      ? parseInt(req.query.page as string)
      : 1;
  const limit =
    req.query.limit != undefined && parseInt(req.query.limit as string) >= 0
      ? parseInt(req.query.limit as string)
      : 10;
  const skip = (page - 1) * limit;

  const startDate = req.query.start
    ? new Date(req.query.start as string)
    : null;
  const endDate = req.query.end ? new Date(req.query.end as string) : null;

  const type = req.query.type;

  const search = req.query.search as string;
  const sortBy = (req.query.sortBy as string) || 'date';
  const sortDirection = (req.query.sortDirection as string) || 'desc';

  try {
    if (!req.params.username) {
      throw new customError('Username is required', 400);
    }

    const parseNumberParam = (value: unknown): number | null => {
      if (Array.isArray(value)) {
        return parseNumberParam(value[0]);
      }

      if (value === undefined || value === null || value === '') {
        return null;
      }

      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    };

    const buildRangeFilter = (
      field: string,
      minValue: number | null,
      maxValue: number | null
    ) => {
      if (minValue === null && maxValue === null) {
        return null;
      }

      if (minValue !== null && maxValue !== null && minValue > maxValue) {
        throw new customError(
          `${field}Min cannot be greater than ${field}Max`,
          400
        );
      }

      return {
        ...(minValue !== null ? { $gte: minValue } : {}),
        ...(maxValue !== null ? { $lte: maxValue } : {}),
      };
    };

    const parseTagIds = (value: unknown): Types.ObjectId[] => {
      const rawTags = Array.isArray(value)
        ? value
        : typeof value === 'string'
          ? value.split(',')
          : [];

      return rawTags
        .map((tag) => (typeof tag === 'string' ? tag.trim() : ''))
        .filter((tag) => tag.length > 0)
        .filter((tag) => Types.ObjectId.isValid(tag))
        .map((tag) => new Types.ObjectId(tag));
    };

    const userExists = await User.findOne({
      username: req.params.username,
    }).select('_id');
    if (!userExists) {
      throw new customError('User not found', 404);
    }

    const viewer = res.locals.user as IUser | undefined;
    const canViewPrivateLogs = canViewPrivateLog(viewer, userExists._id);

    let initialMatch: IInitialMatch = {
      user: userExists._id,
    };

    if (!canViewPrivateLogs) {
      initialMatch.private = { $ne: true };
    }

    if (type) {
      if (Array.isArray(type)) {
        initialMatch.type = { $in: type as string[] };
      } else {
        initialMatch.type = type as string;
      }
    }

    if (startDate || endDate) {
      initialMatch.date = {
        ...(startDate && { $gte: startDate }),
        ...(endDate && { $lte: endDate }),
      };
    }

    if (search) {
      initialMatch.description = { $regex: search, $options: 'i' };
    }

    if (req.query.mediaTitle && typeof req.query.mediaTitle === 'string') {
      const mediaTitle = req.query.mediaTitle.trim();
      if (mediaTitle.length > 0) {
        initialMatch.mediaTitle = { $regex: mediaTitle, $options: 'i' };
      }
    }

    if (req.query.mediaId && typeof req.query.mediaId === 'string') {
      initialMatch.mediaId = req.query.mediaId;
    }

    const tagsMode =
      typeof req.query.tagsMode === 'string'
        ? req.query.tagsMode.toLowerCase()
        : 'any';
    const tagIds = parseTagIds(req.query.tags);
    if (tagIds.length > 0) {
      initialMatch.tags =
        tagsMode === 'all' ? { $all: tagIds } : { $in: tagIds };
    }

    const volumeExact = parseNumberParam(req.query.volume);
    const volumeRange = buildRangeFilter(
      'volume',
      parseNumberParam(req.query.volumeMin),
      parseNumberParam(req.query.volumeMax)
    );
    if (volumeExact !== null) {
      initialMatch.volume = volumeExact;
    } else if (volumeRange) {
      initialMatch.volume = volumeRange;
    }

    const episodesExact = parseNumberParam(req.query.episodes);
    const episodesRange = buildRangeFilter(
      'episodes',
      parseNumberParam(req.query.episodesMin),
      parseNumberParam(req.query.episodesMax)
    );
    if (episodesExact !== null) {
      initialMatch.episodes = episodesExact;
    } else if (episodesRange) {
      initialMatch.episodes = episodesRange;
    }

    const pagesExact = parseNumberParam(req.query.pages);
    const pagesRange = buildRangeFilter(
      'pages',
      parseNumberParam(req.query.pagesMin),
      parseNumberParam(req.query.pagesMax)
    );
    if (pagesExact !== null) {
      initialMatch.pages = pagesExact;
    } else if (pagesRange) {
      initialMatch.pages = pagesRange;
    }

    const charsExact = parseNumberParam(req.query.chars);
    const charsRange = buildRangeFilter(
      'chars',
      parseNumberParam(req.query.charsMin),
      parseNumberParam(req.query.charsMax)
    );
    if (charsExact !== null) {
      initialMatch.chars = charsExact;
    } else if (charsRange) {
      initialMatch.chars = charsRange;
    }

    const timeExact = parseNumberParam(req.query.time);
    const timeRange = buildRangeFilter(
      'time',
      parseNumberParam(req.query.timeMin),
      parseNumberParam(req.query.timeMax)
    );
    if (timeExact !== null) {
      initialMatch.time = timeExact;
    } else if (timeRange) {
      initialMatch.time = timeRange;
    }

    // Create sort object based on sortBy parameter and direction
    const sortValue = sortDirection === 'asc' ? 1 : -1;
    const sortObject: any = {};
    switch (sortBy) {
      case 'xp':
        sortObject.xp = sortValue;
        break;
      case 'episodes':
        sortObject.episodes = sortValue;
        break;
      case 'chars':
        sortObject.chars = sortValue;
        break;
      case 'pages':
        sortObject.pages = sortValue;
        break;
      case 'time':
        sortObject.time = sortValue;
        break;
      case 'readingSpeed':
        sortObject.readingSpeed = sortValue;
        break;
      case 'date':
      default:
        sortObject.date = sortValue;
        break;
    }

    const sortFieldName = Object.keys(sortObject)[0] || 'date';

    let pipeline: PipelineStage[] = [
      {
        $match: initialMatch,
      },
      {
        $addFields: {
          readingSpeed: {
            $cond: [
              { $and: [{ $gt: ['$chars', 0] }, { $gt: ['$time', 0] }] },
              { $multiply: [{ $divide: ['$chars', '$time'] }, 60] },
              null,
            ],
          },
        },
      },
      ...(sortBy === 'readingSpeed'
        ? [{ $match: { readingSpeed: { $ne: null } } } as PipelineStage]
        : []),
      {
        $sort: sortObject,
      },
      {
        $addFields: {
          _groupKey: {
            $cond: {
              if: {
                $and: [
                  { $ifNull: ['$playlistBatchId', false] },
                  { $ne: ['$playlistBatchId', ''] },
                ],
              },
              then: '$playlistBatchId',
              else: { $toString: '$_id' },
            },
          },
        },
      },
      {
        $group: {
          _id: '$_groupKey',
          logs: { $push: '$$ROOT' },
          sortValue: { $first: `$${sortFieldName}` },
        },
      },
      {
        $sort: { sortValue: sortDirection === 'asc' ? 1 : -1 } as any,
      },
    ];

    if (skip > 0) {
      pipeline.push({ $skip: skip });
    }

    if (limit > 0) {
      pipeline.push({ $limit: limit });
    }

    pipeline.push(
      {
        $unwind: '$logs',
      },
      {
        $replaceRoot: { newRoot: '$logs' },
      },
      {
        $lookup: {
          from: 'media',
          localField: 'mediaId',
          foreignField: 'contentId',
          as: 'media',
          pipeline: [
            {
              $project: {
                contentId: 1,
                title: 1,
                contentImage: 1,
                type: 1,
              },
            },
          ],
        },
      },
      {
        $unwind: {
          path: '$media',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: 'tags',
          localField: 'tags',
          foreignField: '_id',
          as: 'tags',
          pipeline: [
            {
              $project: {
                _id: 1,
                name: 1,
                color: 1,
              },
            },
          ],
        },
      },
      {
        $project: {
          _id: 1,
          type: 1,
          mediaId: 1,
          manabeId: 1,
          xp: 1,
          description: 1,
          playlistBatchId: 1,
          playlistBatchTitle: 1,
          episodes: 1,
          volume: 1,
          pages: 1,
          chars: 1,
          time: 1,
          date: 1,
          unknownDate: 1,
          tags: 1,
          'media.contentId': 1,
          'media.title': 1,
          'media.contentImage': 1,
          'media.type': 1,
        },
      }
    );

    const logs = await Log.aggregate(pipeline);

    if (!logs.length) return res.status(200).json([]);

    const normalizedLogs = logs.map((log) => ({
      ...log,
      description: getDescriptionWithMediaFallback(log.description, log.media),
    }));

    return res.status(200).json(normalizedLogs);
  } catch (error) {
    return next(error as customError);
  }
}

/**
 * Returns the XP a log would earn without saving it. The calculateXp
 * middleware has already computed xp/xpBreakdown into req.body.
 */
export async function previewLogXp(
  req: Request<ParamsDictionary, any, ILog>,
  res: Response,
  next: NextFunction
) {
  try {
    return res.status(200).json({
      xp: req.body.xp,
      xpBreakdown: req.body.xpBreakdown ?? null,
    });
  } catch (error) {
    return next(error as customError);
  }
}

export async function getLog(req: Request, res: Response, next: NextFunction) {
  try {
    const logAggregation = await Log.aggregate([
      {
        $match: {
          _id: new Types.ObjectId(req.params.id),
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'user',
          foreignField: '_id',
          as: 'user',
        },
      },
      {
        $unwind: {
          path: '$user',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: 'media',
          localField: 'mediaId',
          foreignField: 'contentId',
          as: 'mediaData',
        },
      },
      {
        $unwind: {
          path: '$mediaData',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: 'tags',
          localField: 'tags',
          foreignField: '_id',
          as: 'tags',
          pipeline: [
            {
              $project: {
                _id: 1,
                name: 1,
                color: 1,
              },
            },
          ],
        },
      },
      {
        $project: {
          _id: 1,
          user: 1,
          private: 1,
          type: 1,
          description: 1,
          episodes: 1,
          volume: 1,
          pages: 1,
          chars: 1,
          time: 1,
          date: 1,
          unknownDate: 1,
          mediaId: 1,
          manabeId: 1,
          xp: 1,
          tags: 1,
          'mediaData.title': 1,
          'mediaData.contentImage': 1,
          'mediaData.type': 1,
          'mediaData.contentId': 1,
          'mediaData.isAdult': 1,
        },
      },
    ]);

    const foundLog = logAggregation[0];
    if (!foundLog) throw new customError('Log not found', 404);

    const viewer = res.locals.user as IUser | undefined;
    if (foundLog.private && !canViewPrivateLog(viewer, foundLog.user)) {
      throw new customError('Log not found', 404);
    }

    const sharedLogData = {
      _id: foundLog._id,
      type: foundLog.type,
      description: getDescriptionWithMediaFallback(
        foundLog.description,
        foundLog.mediaData
      ),
      episodes: foundLog.type === 'anime' ? foundLog.episodes : undefined,
      volume: foundLog.volume,
      pages: foundLog.pages,
      chars: foundLog.chars,
      time: foundLog.time,
      date: foundLog.date,
      unknownDate: foundLog.unknownDate,
      mediaId: foundLog.mediaId,
      media: foundLog.mediaData,
      xp: foundLog.xp,
      tags: foundLog.tags || [],
      isAdult: foundLog.mediaData?.isAdult || false,
    };

    return res.status(200).json(sharedLogData);
  } catch (error) {
    return next(error as customError);
  }
}

export async function deleteLog(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const deletedLog = await Log.findOneAndDelete({
      _id: req.params.id,
      user: res.locals.user.id,
    });

    res.locals.log = deletedLog;

    if (!deletedLog) {
      throw new customError('Log not found or not authorized', 404);
    }

    await updateStats(res, next, true);

    // After deletion, streaks may change; recalc for this user
    if (deletedLog) {
      await recalculateStreaksForUser(res.locals.user._id);
    }

    // Re-evaluate auto-complete after deletion
    try {
      if (deletedLog?.mediaId) {
        await evaluateAutoCompleteForUserMedia(
          res.locals.user._id,
          String(deletedLog.mediaId),
          String(deletedLog.type)
        );
      }
    } catch (err) {
      console.error('auto-complete evaluation failed after deleteLog', err);
    }

    return res.sendStatus(204);
  } catch (error) {
    return next(error as customError);
  }
}

/**
 * Bulk-delete multiple logs belonging to the authenticated user.
 * All logs are deleted first, then stats are recalculated ONCE to avoid
 * Mongoose VersionError caused by concurrent user-document writes.
 *
 * Body: { ids: string[] }
 */
export async function deleteLogsBulk(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { ids } = req.body as { ids?: unknown };

    if (!Array.isArray(ids) || ids.length === 0) {
      throw new customError('ids must be a non-empty array', 400);
    }

    const userId = res.locals.user.id;

    // Delete all requested logs that belong to this user in one query
    const result = await Log.deleteMany({
      _id: { $in: ids },
      user: userId,
    });

    if (result.deletedCount === 0) {
      throw new customError('No logs found or not authorized', 404);
    }

    // Recalculate stats from scratch for the user (single write, no race)
    const user = await User.findById(userId);
    if (!user || !user.stats) {
      throw new customError('User not found', 404);
    }

    const allUserLogs = await Log.aggregate([
      { $match: { user: user._id } },
      {
        $group: {
          _id: null,
          totalXp: { $sum: '$xp' },
          listeningXp: {
            $sum: {
              $cond: [
                {
                  $in: [
                    '$type',
                    ['anime', 'video', 'movie', 'tv show', 'audio'],
                  ],
                },
                '$xp',
                0,
              ],
            },
          },
          readingXp: {
            $sum: {
              $cond: [
                { $in: ['$type', ['manga', 'reading', 'vn', 'game']] },
                '$xp',
                0,
              ],
            },
          },
        },
      },
    ]);

    const totals = allUserLogs[0] ?? {
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

    // Recalculate streaks once after all deletions
    await recalculateStreaksForUser(userId);

    return res.status(200).json({ deletedCount: result.deletedCount });
  } catch (error) {
    return next(error as customError);
  }
}

/**
 * Admin bulk-delete: delete logs by ID regardless of ownership,
 * then recalculate the affected user's stats once.
 *
 * Body: { ids: string[] }
 */
export async function adminDeleteLogsBulk(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { ids } = req.body as { ids?: unknown };

    if (!Array.isArray(ids) || ids.length === 0) {
      throw new customError('ids must be a non-empty array', 400);
    }

    // Find the logs first to know which user(s) to update stats for
    const logsToDelete = await Log.find({ _id: { $in: ids } })
      .select('_id user xp type')
      .lean();

    if (logsToDelete.length === 0) {
      throw new customError('No logs found', 404);
    }

    await Log.deleteMany({ _id: { $in: ids } });

    // Group affected users (usually all the same one)
    const affectedUserIds = [
      ...new Set(logsToDelete.map((l) => String(l.user))),
    ];

    for (const uid of affectedUserIds) {
      const user = await User.findById(uid);
      if (!user?.stats) continue;

      const allUserLogs = await Log.aggregate([
        { $match: { user: user._id } },
        {
          $group: {
            _id: null,
            totalXp: { $sum: '$xp' },
            listeningXp: {
              $sum: {
                $cond: [
                  {
                    $in: [
                      '$type',
                      ['anime', 'video', 'movie', 'tv show', 'audio'],
                    ],
                  },
                  '$xp',
                  0,
                ],
              },
            },
            readingXp: {
              $sum: {
                $cond: [
                  { $in: ['$type', ['manga', 'reading', 'vn', 'game']] },
                  '$xp',
                  0,
                ],
              },
            },
          },
        },
      ]);

      const totals = allUserLogs[0] ?? {
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
      await recalculateStreaksForUser(user._id as any);
    }

    return res.status(200).json({ deletedCount: logsToDelete.length });
  } catch (error) {
    return next(error as customError);
  }
}

// Admin-only: delete any user's log by id and update that user's stats/streaks
export async function adminDeleteLog(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const deletedLog = await Log.findByIdAndDelete(req.params.id);

    if (!deletedLog) {
      throw new customError('Log not found', 404);
    }

    // Set locals so updateStats can update the correct user's stats
    res.locals.log = deletedLog;
    // Overwrite user context to the log owner for stats update
    (res.locals as any).user = {
      id: deletedLog.user,
      _id: deletedLog.user,
    };

    await updateStats(res, next, true);
    await recalculateStreaksForUser(deletedLog.user);

    return res.sendStatus(204);
  } catch (error) {
    return next(error as customError);
  }
}

export async function updateLog(
  req: Request<ParamsDictionary, any, ILog>,
  res: Response,
  next: NextFunction
) {
  const {
    description,
    time,
    date,
    mediaId,
    episodes,
    volume,
    pages,
    chars,
    type,
    xp,
    tags,
  } = req.body;

  try {
    const log: ILog | null = await Log.findOne({
      _id: new Types.ObjectId(req.params.id),
      user: res.locals.user.id,
    });

    if (!log) throw new customError('Log not found', 404);

    const validKeys: (keyof IEditedFields)[] = [
      'episodes',
      'volume',
      'pages',
      'chars',
      'time',
      'xp',
    ];

    const editedFields: IEditedFields = {};

    for (const key in req.body) {
      if (validKeys.includes(key as keyof IEditedFields)) {
        const value = log[key as keyof IEditedFields];

        if (value !== null && value !== undefined) {
          editedFields[key as keyof IEditedFields] = value;
        }
      }
    }

    const originalDate = log.date ? new Date(log.date) : null;

    log.description = description !== undefined ? description : log.description;
    log.time = time !== undefined ? time : log.time;
    log.date = date !== undefined ? date : log.date;
    log.mediaId = mediaId !== undefined ? mediaId : log.mediaId;
    log.episodes = episodes !== undefined ? episodes : log.episodes;
    log.volume = volume !== undefined ? volume : log.volume;
    log.pages = pages !== undefined ? pages : log.pages;
    log.chars = chars !== undefined ? chars : log.chars;
    log.type = type !== undefined ? type : log.type;
    log.xp = xp !== undefined ? xp : log.xp;
    log.xpBreakdown = req.body.xpBreakdown ?? log.xpBreakdown;
    log.tags = tags !== undefined ? tags : log.tags;
    log.editedFields = editedFields;

    const updatedLog = await log.save();
    res.locals.log = updatedLog;
    await updateStats(res, next);

    log.editedFields = null;
    await log.save();

    // If the date changed or type/time changed enough to affect day counts, recalc streaks
    if (originalDate?.toISOString() !== updatedLog.date?.toISOString()) {
      await recalculateStreaksForUser(res.locals.user._id);
    }

    // Re-evaluate auto-complete after an updated log
    try {
      if (updatedLog.mediaId) {
        await evaluateAutoCompleteForUserMedia(
          res.locals.user._id,
          String(updatedLog.mediaId),
          String(updatedLog.type)
        );
      }
    } catch (err) {
      console.error('auto-complete evaluation failed after updateLog', err);
    }

    return res.status(200).json(updatedLog);
  } catch (error) {
    return next(error as customError);
  }
}

// Admin-only: update any user's log by id and update that user's stats/streaks
export async function adminUpdateLog(
  req: Request<ParamsDictionary, any, ILog>,
  res: Response,
  next: NextFunction
) {
  const {
    description,
    time,
    date,
    mediaId,
    episodes,
    volume,
    pages,
    chars,
    type,
    xp,
  } = req.body;

  try {
    const log: ILog | null = await Log.findById(
      new Types.ObjectId(req.params.id)
    );

    if (!log) throw new customError('Log not found', 404);

    const validKeys: (keyof IEditedFields)[] = [
      'episodes',
      'volume',
      'pages',
      'chars',
      'time',
      'xp',
    ];

    const editedFields: IEditedFields = {};

    for (const key in req.body) {
      if (validKeys.includes(key as keyof IEditedFields)) {
        const value = log[key as keyof IEditedFields];

        if (value !== null && value !== undefined) {
          editedFields[key as keyof IEditedFields] = value;
        }
      }
    }

    const originalDate = log.date ? new Date(log.date) : null;

    log.description = description !== undefined ? description : log.description;
    log.time = time !== undefined ? time : log.time;
    log.date = date !== undefined ? date : log.date;
    log.mediaId = mediaId !== undefined ? mediaId : log.mediaId;
    log.episodes = episodes !== undefined ? episodes : log.episodes;
    log.volume = volume !== undefined ? volume : log.volume;
    log.pages = pages !== undefined ? pages : log.pages;
    log.chars = chars !== undefined ? chars : log.chars;
    log.type = type !== undefined ? type : log.type;
    log.xp = xp !== undefined ? xp : log.xp;
    log.xpBreakdown = req.body.xpBreakdown ?? log.xpBreakdown;
    log.editedFields = editedFields;

    const updatedLog = await log.save();

    // Set locals for stats calculation to target log owner
    res.locals.log = updatedLog;
    (res.locals as any).user = {
      id: updatedLog.user,
      _id: updatedLog.user,
    };

    await updateStats(res, next);

    // Clear editedFields after stats update
    log.editedFields = null;
    await log.save();

    // If the date changed, recalc streaks for the log owner
    if (originalDate?.toISOString() !== updatedLog.date?.toISOString()) {
      await recalculateStreaksForUser(updatedLog.user as any);
    }

    // Re-evaluate auto-complete after admin updated a log
    try {
      if (updatedLog.mediaId) {
        await evaluateAutoCompleteForUserMedia(
          updatedLog.user as any,
          String(updatedLog.mediaId),
          String(updatedLog.type)
        );
      }
    } catch (err) {
      console.error(
        'auto-complete evaluation failed after adminUpdateLog',
        err
      );
    }

    return res.status(200).json(updatedLog);
  } catch (error) {
    return next(error as customError);
  }
}

export async function createLog(
  req: Request<ParamsDictionary, any, ICreateLog>,
  res: Response,
  next: NextFunction
) {
  const {
    type,
    mediaId,
    description,
    playlistBatchId,
    playlistBatchTitle,
    pages,
    episodes,
    volume,
    xp,
    time,
    date,
    chars,
    mediaData,
    tags,
    unknownDate,
  } = req.body;

  try {
    if (!type) throw new customError('Log type is required', 400);
    if (!description) throw new customError('Description is required', 400);

    const isUnknownDate = Boolean(unknownDate);

    let logDate: Date;
    if (!isUnknownDate && date) {
      if (typeof date === 'string') {
        logDate = new Date(date);
      } else {
        logDate = new Date(date);
      }
    } else {
      logDate = new Date();
    }

    let logMedia;
    let createMedia = true;

    if (mediaId) {
      logMedia = await MediaBase.findOne({ contentId: mediaId, type });
      if (logMedia) {
        createMedia = false;
      }
    }
    if (type === 'video' && createMedia && mediaId) {
      const channelInfo = await getYouTubeChannelInfo(mediaId);
      if (channelInfo) {
        const channelMedia = await MediaBase.create({
          contentId: channelInfo.contentId,
          title: channelInfo.title,
          contentImage: channelInfo.contentImage,
          coverImage: channelInfo.contentImage,
          description: channelInfo.description,
          type: 'video',
          isAdult: false,
        });

        logMedia = channelMedia;
      }
    } else if (
      createMedia &&
      type !== 'audio' &&
      type !== 'other' &&
      type !== 'video' &&
      mediaId &&
      mediaData
    ) {
      const createdMedia = await MediaBase.create({
        contentId: mediaId,
        title: {
          contentTitleNative: mediaData.contentTitleNative,
          contentTitleEnglish: mediaData.contentTitleEnglish,
          contentTitleRomaji: mediaData.contentTitleRomaji,
        },
        contentImage: mediaData.contentImage,
        episodes: mediaData.episodes,
        episodeDuration: mediaData.episodeDuration,
        synonyms: mediaData.synonyms,
        chapters: mediaData.chapters,
        volumes: mediaData.volumes,
        isAdult: mediaData.isAdult,
        coverImage: mediaData.coverImage,
        type,
        description: mediaData.description ? mediaData.description : undefined,
      });
      await addDocuments(type.replace(' ', '_'), [
        {
          _id: createdMedia._id,
          contentId: createdMedia.contentId,
          title: createdMedia.title,
          contentImage: createdMedia.contentImage,
          isAdult: createdMedia.isAdult,
          synonyms: mediaData.synonyms,
        },
      ]);
      logMedia = createdMedia;
    }

    if (!logMedia && createMedia) {
      logMedia = await MediaBase.findOne({
        contentId: mediaId,
        type,
      });
    }

    const user: ILog['user'] = res.locals.user._id;
    const newLog: ILog | null = new Log({
      user,
      type,
      mediaId: logMedia ? logMedia.contentId : mediaId,
      pages,
      episodes,
      volume,
      xp,
      xpBreakdown: req.body.xpBreakdown ?? null,
      description,
      playlistBatchId,
      playlistBatchTitle,
      private: false,
      isAdult: logMedia?.isAdult ?? false,
      time,
      unknownDate: isUnknownDate,
      date: logDate,
      chars,
      tags: tags || [],
    });
    if (!newLog) throw new customError('Log could not be created', 500);
    const savedLog = await newLog.save();
    if (!savedLog) throw new customError('Log could not be saved', 500);

    const levelBeforeLog: number = res.locals.user.stats?.userLevel ?? 1;

    res.locals.log = savedLog;
    await updateStats(res, next);

    // Update streaks using user timezone and log date (incremental)
    if (!savedLog.unknownDate) {
      await updateStreakWithLog(res.locals.user._id, savedLog.date);
    }

    // Check achievements after stats + streak are updated
    const newAchievements = await checkAchievements(
      res.locals.user._id,
      { trigger: 'log', log: savedLog }
    );
    // Also check streak-triggered achievements if streak was updated
    if (!savedLog.unknownDate) {
      const streakAchievements = await checkAchievements(
        res.locals.user._id,
        { trigger: 'streak' }
      );
      newAchievements.push(...streakAchievements);
    }

    // These are returned inline and revealed by the client right away, so mark
    // them notified — otherwise the /me/pending drain would replay them later.
    if (newAchievements.length > 0) {
      await UserAchievement.updateMany(
        {
          user: res.locals.user._id,
          achievement: { $in: newAchievements.map((a) => a._id) },
        },
        { $set: { notified: true } }
      );
    }

    const finalMediaId = logMedia ? logMedia.contentId : mediaId;
    const statusType = String(logMedia?.type ?? type).toLowerCase();
    const immersionMediaTypes = new Set([
      'anime',
      'manga',
      'reading',
      'vn',
      'game',
      'video',
      'movie',
      'tv show',
    ]);

    if (finalMediaId && immersionMediaTypes.has(statusType)) {
      const statusFilter = {
        user: res.locals.user._id,
        mediaId: String(finalMediaId),
        type: statusType,
      };

      const existingStatus = await UserMediaStatus.findOne(statusFilter)
        .select('status completed')
        .lean();

      if (!existingStatus) {
        try {
          await UserMediaStatus.create({
            ...statusFilter,
            status: 'in_progress',
            completed: false,
            completedAt: null,
            autoCompleteSuppressed: false,
          });
        } catch (error) {
          const mongoError = error as { code?: number };
          if (mongoError.code !== 11000) {
            throw error;
          }

          await UserMediaStatus.updateOne(
            {
              ...statusFilter,
              completed: { $ne: true },
              $or: [{ status: { $exists: false } }, { status: null }],
            },
            {
              $set: {
                status: 'in_progress',
                completed: false,
                completedAt: null,
                autoCompleteSuppressed: false,
              },
            }
          );
        }
      } else if (!existingStatus.completed && !existingStatus.status) {
        await UserMediaStatus.updateOne(statusFilter, {
          $set: {
            status: 'in_progress',
            completed: false,
            completedAt: null,
            autoCompleteSuppressed: false,
          },
        });
      }
    }

    // Evaluate auto-complete now that the new log exists
    try {
      if (finalMediaId && immersionMediaTypes.has(statusType)) {
        await evaluateAutoCompleteForUserMedia(
          res.locals.user._id,
          String(finalMediaId),
          statusType
        );
      }
    } catch (err) {
      console.error('auto-complete evaluation failed after createLog', err);
    }

    // If this media was hidden from recent media, unhide it since user is actively logging it
    if (finalMediaId) {
      const userDoc = await User.findById(res.locals.user._id);
      if (userDoc?.settings?.hiddenRecentMedia?.includes(finalMediaId)) {
        userDoc.settings.hiddenRecentMedia =
          userDoc.settings.hiddenRecentMedia.filter(
            (id) => id !== finalMediaId
          );
        await userDoc.save();
      }
    }

    // Celebration payload the client plays back after logging (XP roll-up,
    // level up, monthly-rank overtakes). Best-effort — never fails the log.
    let celebration: ILogCelebration | undefined;
    try {
      const freshUser = await User.findById(res.locals.user._id).select(
        'stats'
      );
      if (freshUser?.stats) {
        const stats = freshUser.stats;
        celebration = {
          xpGained: savedLog.xp ?? 0,
          streak: stats.currentStreak ?? 0,
          xp: {
            current: stats.userXp,
            toCurrentLevel: stats.userXpToCurrentLevel,
            toNextLevel: stats.userXpToNextLevel,
            level: stats.userLevel,
          },
        };
        if (stats.userLevel > levelBeforeLog) {
          celebration.levelUp = { from: levelBeforeLog, to: stats.userLevel };
        }
        if (!savedLog.private && !savedLog.unknownDate) {
          const rank = await computeMonthlyOvertakes(
            res.locals.user._id,
            savedLog.xp ?? 0
          );
          if (rank) celebration.rank = rank;
        }
      }
    } catch (err) {
      console.error('celebration payload failed after createLog', err);
    }

    return res
      .status(200)
      .json({ ...savedLog.toObject(), newAchievements, celebration });
  } catch (error) {
    return next(error as customError);
  }
}

interface IImportStats {
  listeningXp: number;
  readingXp: number;
  anilistMediaId: {
    anime: number[];
    manga: number[];
    reading: number[];
  };
}

async function createImportedMedia(
  userId: ObjectId,
  mediaIds?: IImportStats['anilistMediaId']
) {
  try {
    let logsMediaId: IImportStats['anilistMediaId'] | undefined;
    let createdMediaCount = 0;

    logsMediaId = mediaIds;

    if (
      logsMediaId &&
      (logsMediaId.anime.length > 0 ||
        logsMediaId.manga.length > 0 ||
        logsMediaId.reading.length > 0)
    ) {
      const userLogs = await Log.find({ user: userId });
      if (!userLogs) return 0;
      const logsMediaId = userLogs.reduce<IImportStats['anilistMediaId']>(
        (acc, log) => {
          if (log.mediaId) {
            if (log.type === 'anime') {
              acc.anime.push(parseInt(log.mediaId));
            } else if (log.type === 'manga') {
              acc.manga.push(parseInt(log.mediaId));
            } else if (log.type === 'reading') {
              acc.reading.push(parseInt(log.mediaId));
            }
          }
          return acc;
        },
        { anime: [], manga: [], reading: [] }
      );
      if (logsMediaId.anime.length > 0) {
        logsMediaId.anime = [...new Set(logsMediaId.anime)];
      }
      if (logsMediaId.manga.length > 0) {
        logsMediaId.manga = [...new Set(logsMediaId.manga)];
      }
      if (logsMediaId.reading.length > 0) {
        logsMediaId.reading = [...new Set(logsMediaId.reading)];
      }
    }

    for (const type in logsMediaId) {
      if (
        logsMediaId[type as keyof IImportStats['anilistMediaId']].length > 0
      ) {
        const existingMedia = await MediaBase.find({
          contentId: {
            $in: logsMediaId[type as keyof IImportStats['anilistMediaId']].map(
              (id) => id.toString()
            ),
          },
        }).select('contentId');
        const existingContentIds = new Set(
          existingMedia.map((media) => media.contentId)
        );
        const newMediaId = logsMediaId[
          type as keyof IImportStats['anilistMediaId']
        ].filter((id) => !existingContentIds.has(id.toString()));
        const mediaData = await searchAnilist({
          ids: newMediaId,
          type: type === 'anime' ? 'ANIME' : 'MANGA',
        });
        if (mediaData.length > 0) {
          if (type === 'anime') {
            Anime.insertMany(mediaData, {
              ordered: false,
            });
          } else if (type === 'manga') {
            Manga.insertMany(mediaData, {
              ordered: false,
            });
          } else if (type === 'reading') {
            Reading.insertMany(mediaData, {
              ordered: false,
            });
          }
          return (createdMediaCount += mediaData.length);
        }
      }
    }
    return createdMediaCount;
  } catch (error) {
    console.error(error);
    return 0;
  }
}

export async function importLogs(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const logs: ILog[] = req.body.logs;
  try {
    // Filter out logs that already exist based on manabeId
    const manabeIds = logs
      .filter((log) => log.manabeId)
      .map((log) => log.manabeId);

    let existingManabeIds: string[] = [];
    if (manabeIds.length > 0) {
      const existingLogs = await Log.find(
        {
          manabeId: { $in: manabeIds },
        },
        { manabeId: 1 }
      );
      existingManabeIds = existingLogs.map((log) => log.manabeId!);
    }

    // Filter out logs that already exist
    const newLogs = logs.filter(
      (log) => !log.manabeId || !existingManabeIds.includes(log.manabeId)
    );

    const skippedCount = logs.length - newLogs.length;

    const importStats: IImportStats = newLogs.reduce<IImportStats>(
      (acc, log) => {
        if (
          log.type === 'video' ||
          log.type === 'audio' ||
          log.type === 'anime'
        ) {
          acc.listeningXp += log.xp;
        } else if (
          log.type === 'reading' ||
          log.type === 'manga' ||
          log.type === 'vn' ||
          log.type === 'game'
        ) {
          acc.readingXp += log.xp;
        }
        if (
          log.mediaId &&
          (log.type === 'anime' ||
            log.type === 'manga' ||
            log.type === 'reading')
        ) {
          if (!acc.anilistMediaId[log.type].includes(parseInt(log.mediaId))) {
            acc.anilistMediaId[log.type].push(parseInt(log.mediaId));
          }
        }
        return acc;
      },
      {
        listeningXp: 0,
        readingXp: 0,
        anilistMediaId: { anime: [], manga: [], reading: [] },
      }
    );
    res.locals.importedStats = importStats;

    let insertedLogs: any[] = [];
    if (newLogs.length > 0) {
      insertedLogs = await Log.insertMany(newLogs, {
        ordered: false,
      });
    }
    await updateStats(res, next);

    const user = await User.findById(res.locals.user.id);
    if (!user) throw new customError('User not found', 404);
    user.firstImport = false;
    const savedUser = await user.save();
    if (!savedUser) throw new customError('User could not be updated', 500);

    const createdMedia = await createImportedMedia(
      res.locals.user._id,
      importStats.anilistMediaId
    );

    // After bulk import, recalculate streaks for this user
    await recalculateStreaksForUser(res.locals.user._id);

    // Grant achievements earned by the imported logs. Left unnotified on
    // purpose — the client drains /me/pending on its next load and reveals them.
    if (insertedLogs.length > 0) {
      await checkAchievements(res.locals.user._id, { trigger: 'log' });
      await checkAchievements(res.locals.user._id, { trigger: 'streak' });
    }

    let statusMessage = `${insertedLogs.length} log${
      insertedLogs.length > 1 ? 's' : ''
    } imported successfully`;

    if (skippedCount > 0) {
      statusMessage += `\n${skippedCount} duplicate log${
        skippedCount > 1 ? 's' : ''
      } skipped`;
    }

    if (insertedLogs.length < newLogs.length) {
      statusMessage += `\n${newLogs.length - insertedLogs.length} log${
        newLogs.length - insertedLogs.length > 1 ? 's' : ''
      } failed to import`;
    } else if (logs.length === 0) {
      statusMessage = 'No logs to import, your logs are up to date';
    }

    if (createdMedia > 0) {
      statusMessage += `\n${createdMedia} media${
        createdMedia > 1 ? 's' : ''
      } imported successfully`;
    }
    return res.status(200).json({
      message: statusMessage,
    });
  } catch (error) {
    console.error(error);
    return next(error as customError);
  }
}

export async function assignMedia(
  req: Request,
  res: Response,
  next: NextFunction
) {
  interface IAssignData {
    logsId: string[];
    contentMedia: IMediaDocument;
  }
  try {
    const assignData: Array<IAssignData> = req.body;

    const results = await Promise.all(
      assignData.map(async (logsData) => {
        let media = await MediaBase.findOne({
          contentId: logsData.contentMedia.contentId,
        });
        if (!media) {
          media = await MediaBase.create(logsData.contentMedia);
        }

        const shouldConvertType =
          media.type === 'movie' || media.type === 'tv show';
        const updateData: any = { mediaId: media.contentId };

        if (shouldConvertType) {
          updateData.type = media.type;
        }

        const updatedLogs = await Log.updateMany(
          {
            _id: { $in: logsData.logsId },
          },
          updateData
        );

        if (!updatedLogs)
          throw new customError(
            `Log${logsData.logsId.length > 1 ? 's' : ''} not found`,
            404
          );

        return updatedLogs;
      })
    );

    return res.status(200).json({ results });
  } catch (error) {
    return next(error as customError);
  }
}

interface IGetUserStatsQuery {
  timeRange?: 'today' | 'week' | 'month' | 'year' | 'total' | 'custom';
  type?:
    | 'all'
    | 'anime'
    | 'manga'
    | 'reading'
    | 'audio'
    | 'video'
    | 'movie'
    | 'vn'
    | 'game'
    | 'other'
    | 'tv show';
  start?: string;
  end?: string;
  timezone?: string;
  includedTags?: string;
  excludedTags?: string;
}

interface IStatByType {
  type: string;
  count: number;
  totalXp: number;
  totalChars: number;
  totalPages: number;
  totalEpisodes: number;
  totalTimeMinutes: number;
  totalTimeHours: number;
  untrackedCount: number;
  dates: Array<{
    date: Date;
    unknownDate?: boolean;
    xp: number;
    time?: number;
    episodes?: number;
    localDate?: ILocalDateInfo;
  }>;
}

interface IUserStats {
  totals: {
    totalLogs: number;
    totalXp: number;
    totalTimeHours: number;
    readingHours: number;
    listeningHours: number;
    untrackedCount: number;
    totalChars: number;
    dailyAverageHours: number;
    dailyAverageChars: number;
    dayCount: number;
  };
  streaks: {
    currentStreak: number;
    longestStreak: number;
  };
  readingSpeedData?: Array<{
    date: Date;
    type: string;
    time: number;
    chars?: number;
    pages?: number;
    charsPerHour?: number | null;
    localDate?: ILocalDateInfo;
  }>;
  timeRange: 'today' | 'week' | 'month' | 'year' | 'total';
  selectedType: string;
  timezone: string;
}

interface ILocalDateInfo {
  iso: string;
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  dayKey: string;
  monthKey: string;
  utcMillis: number;
}

export async function getUserStats(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response<IUserStats> | void> {
  try {
    const { username } = req.params;
    const {
      timeRange = 'total',
      type = 'all',
      start: startParam,
      end: endParam,
      timezone: tzParam,
      includedTags: includedTagsParam,
      excludedTags: excludedTagsParam,
    } = req.query as IGetUserStatsQuery;

    const validTimeRanges = [
      'today',
      'week',
      'month',
      'year',
      'total',
      'custom',
    ];
    if (!validTimeRanges.includes(timeRange)) {
      return res.status(400).json({ message: 'Invalid time range' });
    }

    const validTypes = [
      'all',
      'anime',
      'manga',
      'reading',
      'audio',
      'video',
      'tv show',
      'movie',
      'vn',
      'game',
      'other',
    ];

    if (Array.isArray(type)) {
      const invalidTypes = type.filter((t) => !validTypes.includes(t));
      if (invalidTypes.length > 0) {
        return res.status(400).json({
          message: `Invalid types: ${invalidTypes.join(', ')}`,
        });
      }
    } else if (!validTypes.includes(type)) {
      return res.status(400).json({ message: 'Invalid type' });
    }

    const user = await User.findOne({ username });
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Use provided timezone or user's timezone for date calculations
    const userTimezone = tzParam || user.settings?.timezone || 'UTC';

    let dateFilter: any = {};
    let daysPeriod = 1;
    const now = new Date();

    // Get current date in user's timezone
    const userDate = new Date(
      now.toLocaleString('en-US', { timeZone: userTimezone })
    );
    const offsetNow = now.getTime() - userDate.getTime();

    // If custom range provided (start/end), override timeRange boundaries
    if (startParam || endParam) {
      const makeLocal = (s: string) => new Date(`${s}T00:00:00`);
      let startUTC: Date | undefined;
      let endUTCLt: Date | undefined;
      let startLocal: Date | undefined;
      let endLocal: Date | undefined;

      if (startParam) {
        startLocal = makeLocal(startParam);
        startUTC = new Date(startLocal.getTime() + offsetNow);
        dateFilter = { date: { ...(dateFilter.date || {}), $gte: startUTC } };
      }
      if (endParam) {
        endLocal = makeLocal(endParam);
        const endLocalPlus = new Date(endLocal.getTime());
        endLocalPlus.setDate(endLocalPlus.getDate() + 1);
        endUTCLt = new Date(endLocalPlus.getTime() + offsetNow);
        dateFilter = { date: { ...(dateFilter.date || {}), $lt: endUTCLt } };
      }

      // Compute daysPeriod for averages using local boundaries
      if (startLocal && endLocal) {
        const diffMs =
          new Date(
            endLocal.getFullYear(),
            endLocal.getMonth(),
            endLocal.getDate() + 1
          ).getTime() -
          new Date(
            startLocal.getFullYear(),
            startLocal.getMonth(),
            startLocal.getDate()
          ).getTime();
        daysPeriod = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
      } else if (startLocal && !endLocal) {
        const endLocalToday = new Date(
          userDate.getFullYear(),
          userDate.getMonth(),
          userDate.getDate() + 1
        );
        const diffMs = endLocalToday.getTime() - startLocal.getTime();
        daysPeriod = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
      } else if (!startLocal && endLocal) {
        daysPeriod = 1;
      }
    } else if (timeRange === 'today') {
      const startLocal = new Date(
        userDate.getFullYear(),
        userDate.getMonth(),
        userDate.getDate()
      );
      const start = new Date(startLocal.getTime() + offsetNow);
      dateFilter = { date: { $gte: start } };
      daysPeriod = 1;
    } else if (timeRange === 'week') {
      const startLocal = new Date(
        userDate.getFullYear(),
        userDate.getMonth(),
        userDate.getDate() - userDate.getDay()
      );
      const start = new Date(startLocal.getTime() + offsetNow);
      dateFilter = { date: { $gte: start } };
      daysPeriod = userDate.getDay() + 1;
    } else if (timeRange === 'month') {
      const startLocal = new Date(
        userDate.getFullYear(),
        userDate.getMonth(),
        1
      );
      const start = new Date(startLocal.getTime() + offsetNow);
      dateFilter = { date: { $gte: start } };

      daysPeriod = userDate.getDate();
    } else if (timeRange === 'year') {
      const startLocal = new Date(userDate.getFullYear(), 0, 1);
      const start = new Date(startLocal.getTime() + offsetNow);
      dateFilter = { date: { $gte: start } };
      const dayOfYear =
        Math.floor(
          (userDate.getTime() - startLocal.getTime()) / (1000 * 60 * 60 * 24)
        ) + 1;
      daysPeriod = dayOfYear;
    } else if (timeRange === 'total') {
      const firstLog = await Log.findOne({
        user: user._id,
        private: { $ne: true },
      }).sort({ date: 1 });
      if (firstLog) {
        const firstLogDate = firstLog.date ?? new Date(0);
        const daysDiff =
          Math.floor(
            (userDate.getTime() - firstLogDate.getTime()) /
              (1000 * 60 * 60 * 24)
          ) + 1;
        daysPeriod = daysDiff;
      } else {
        daysPeriod = 1;
      }
    } else if (timeRange === 'custom') {
      daysPeriod = 1;
    }

    let aggregationMatch: any = {
      user: user._id,
      private: { $ne: true },
      ...dateFilter,
    };

    if (includedTagsParam || excludedTagsParam) {
      const tagFilter: any = {};
      if (includedTagsParam) {
        const includedTagIds = includedTagsParam
          .split(',')
          .map((id) => new Types.ObjectId(id));
        tagFilter.$in = includedTagIds;
      }
      if (excludedTagsParam) {
        const excludedTagIds = excludedTagsParam
          .split(',')
          .map((id) => new Types.ObjectId(id));
        tagFilter.$nin = excludedTagIds;
      }
      aggregationMatch.tags = tagFilter;
    }

    let totalsMatch: any = {
      user: user._id,
      private: { $ne: true },
      ...dateFilter,
    };
    if (type !== 'all') {
      if (Array.isArray(type)) {
        totalsMatch.type = { $in: type };
      } else {
        totalsMatch.type = type;
      }
    }

    // Tag filtering for totals
    if (includedTagsParam || excludedTagsParam) {
      const tagFilter: any = {};
      if (includedTagsParam) {
        const includedTagIds = includedTagsParam
          .split(',')
          .map((id) => new Types.ObjectId(id));
        tagFilter.$in = includedTagIds;
      }
      if (excludedTagsParam) {
        const excludedTagIds = excludedTagsParam
          .split(',')
          .map((id) => new Types.ObjectId(id));
        tagFilter.$nin = excludedTagIds;
      }
      totalsMatch.tags = tagFilter;
    }

    const logTypes = [
      'reading',
      'anime',
      'vn',
      'game',
      'video',
      'tv show',
      'movie',
      'manga',
      'audio',
      'other',
    ];

    const statsByType: IStatByType[] = await Log.aggregate([
      { $match: aggregationMatch },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          totalXp: { $sum: '$xp' },
          totalChars: { $sum: { $ifNull: ['$chars', 0] } },
          totalPages: { $sum: { $ifNull: ['$pages', 0] } },
          totalEpisodes: { $sum: { $ifNull: ['$episodes', 0] } },
          totalTime: {
            $sum: {
              $cond: [
                { $eq: ['$type', 'anime'] },
                {
                  $cond: [
                    { $ifNull: ['$time', false] },
                    '$time',
                    {
                      $cond: [
                        { $ifNull: ['$episodes', false] },
                        { $multiply: ['$episodes', 24] },
                        0,
                      ],
                    },
                  ],
                },
                {
                  $cond: [{ $ifNull: ['$time', false] }, '$time', 0],
                },
              ],
            },
          },
          untrackedCount: {
            $sum: {
              $cond: [
                {
                  $or: [
                    {
                      $and: [
                        { $eq: ['$type', 'anime'] },
                        { $eq: ['$time', null] },
                        { $eq: ['$episodes', null] },
                      ],
                    },
                    {
                      $and: [
                        { $ne: ['$type', 'anime'] },
                        { $eq: ['$time', null] },
                      ],
                    },
                  ],
                },
                1,
                0,
              ],
            },
          },
          dates: {
            $push: {
              date: '$date',
              unknownDate: '$unknownDate',
              xp: '$xp',
              time: '$time',
              episodes: '$episodes',
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          type: '$_id',
          count: 1,
          totalXp: 1,
          totalChars: 1,
          totalPages: 1,
          totalEpisodes: 1,
          totalTimeMinutes: '$totalTime',
          totalTimeHours: { $divide: ['$totalTime', 60] },
          untrackedCount: 1,
          dates: 1,
        },
      },
    ]);

    const dateFormatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: userTimezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

    const createLocalDateInfo = (dateValue: Date | string): ILocalDateInfo => {
      const sourceDate =
        dateValue instanceof Date ? dateValue : new Date(dateValue);
      const parts = dateFormatter.formatToParts(sourceDate);
      const partValue = (type: Intl.DateTimeFormatPart['type']) =>
        parts.find((part) => part.type === type)?.value || '00';

      const year = Number(partValue('year')) || 0;
      const month = Number(partValue('month')) || 1;
      const day = Number(partValue('day')) || 1;
      const hour = Number(partValue('hour')) || 0;
      const minute = Number(partValue('minute')) || 0;
      const second = Number(partValue('second')) || 0;

      const pad = (value: number) => value.toString().padStart(2, '0');
      const monthKey = `${year.toString().padStart(4, '0')}-${pad(month)}`;
      const dayKey = `${monthKey}-${pad(day)}`;
      const iso = `${monthKey}-${pad(day)}T${pad(hour)}:${pad(minute)}:${pad(second)}`;
      const utcMillis = Date.UTC(year, month - 1, day, hour, minute, second, 0);

      return {
        iso,
        year,
        month,
        day,
        hour,
        minute,
        second,
        dayKey,
        monthKey,
        utcMillis,
      };
    };

    const filteredStatsByType =
      type === 'all'
        ? statsByType
        : Array.isArray(type)
          ? statsByType.filter((stat) => type.includes(stat.type))
          : statsByType.filter((stat) => stat.type === type);

    const totals = filteredStatsByType.reduce(
      (acc, stat) => {
        acc.totalLogs += stat.count;
        acc.totalXp += stat.totalXp;
        acc.totalTimeHours += stat.totalTimeHours;
        acc.untrackedCount += stat.untrackedCount;
        acc.totalChars += stat.totalChars || 0;

        if (['reading', 'manga', 'vn', 'game'].includes(stat.type)) {
          acc.readingHours += stat.totalTimeHours;
        } else if (
          ['anime', 'video', 'tv show', 'movie', 'audio'].includes(stat.type)
        ) {
          acc.listeningHours += stat.totalTimeHours;
        }

        return acc;
      },
      {
        totalLogs: 0,
        totalXp: 0,
        totalTimeHours: 0,
        readingHours: 0,
        listeningHours: 0,
        untrackedCount: 0,
        totalChars: 0,
        dailyAverageHours: 0,
        dailyAverageChars: 0,
        dayCount: daysPeriod,
      }
    );

    totals.dailyAverageHours =
      daysPeriod > 0 ? totals.totalTimeHours / daysPeriod : 0;
    totals.dailyAverageChars =
      daysPeriod > 0 ? totals.totalChars / daysPeriod : 0;

    totals.dayCount = daysPeriod;

    const completeStats: IStatByType[] = logTypes.map((type) => {
      const typeStat = statsByType.find((stat) => stat.type === type);
      return (
        typeStat || {
          type,
          count: 0,
          totalXp: 0,
          totalChars: 0,
          totalPages: 0,
          totalEpisodes: 0,
          totalTimeMinutes: 0,
          totalTimeHours: 0,
          untrackedCount: 0,
          dates: [],
        }
      );
    });

    const statsWithLocalDates = completeStats.map((stat) => ({
      ...stat,
      dates: stat.dates.map((entry) => ({
        ...entry,
        localDate: createLocalDateInfo(entry.date),
      })),
    }));

    const readingSpeedData =
      type === 'all' ||
      (Array.isArray(type) &&
        type.some((t) => ['reading', 'manga', 'vn', 'game'].includes(t))) ||
      ['reading', 'manga', 'vn', 'game'].includes(type as string)
        ? await Log.aggregate([
            {
              $match: {
                user: user._id,
                private: { $ne: true },
                ...dateFilter,
                unknownDate: { $ne: true },
                type: { $in: ['reading', 'manga', 'vn', 'game'] },
                time: { $ne: null, $gt: 0 },
                $or: [
                  { chars: { $ne: null, $gt: 0 } },
                  { pages: { $ne: null, $gt: 0 } },
                ],
                // Apply tag filtering
                ...(includedTagsParam || excludedTagsParam
                  ? {
                      tags: {
                        ...(includedTagsParam
                          ? {
                              $in: includedTagsParam
                                .split(',')
                                .map((id) => new Types.ObjectId(id)),
                            }
                          : {}),
                        ...(excludedTagsParam
                          ? {
                              $nin: excludedTagsParam
                                .split(',')
                                .map((id) => new Types.ObjectId(id)),
                            }
                          : {}),
                      },
                    }
                  : {}),
              },
            },
            {
              $project: {
                date: 1,
                type: 1,
                time: 1,
                chars: 1,
                pages: 1,
                charsPerHour: {
                  $cond: [
                    { $and: [{ $gt: ['$chars', 0] }, { $gt: ['$time', 0] }] },
                    { $divide: [{ $multiply: ['$chars', 60] }, '$time'] },
                    null,
                  ],
                },
              },
            },
            {
              $sort: { date: 1 },
            },
          ])
        : [];

    const readingSpeedWithLocalDates = readingSpeedData.map((entry) => ({
      ...entry,
      localDate: createLocalDateInfo(entry.date),
    }));

    const streaks = {
      currentStreak: getLiveCurrentStreak(
        user.stats?.currentStreak ?? 0,
        user.stats?.lastStreakDate ?? null,
        userTimezone
      ),
      longestStreak: user.stats?.longestStreak ?? 0,
    };

    return res.json({
      totals,
      statsByType: statsWithLocalDates,
      readingSpeedData: readingSpeedWithLocalDates,
      timeRange,
      selectedType: Array.isArray(type) ? type.join(',') : type,
      timezone: userTimezone,
      streaks,
    });
  } catch (error) {
    return next(error);
  }
}

export async function recalculateXp(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    if (!res.locals.user.roles.includes(userRoles.admin)) {
      return res.status(403).json({ message: 'Admin permission required' });
    }

    const dryRun = req.query.dryRun === 'true';
    const results = await recalculateAllUsersXpV2({ dryRun });

    return res.status(200).json({
      message: `${dryRun ? '[dry run] Would recalculate' : 'Recalculated'} stats for ${results.processedUsers} users (${results.updatedLogs} logs ${dryRun ? 'would change' : 'updated'})`,
      results,
    });
  } catch (error) {
    return next(error as customError);
  }
}

export async function recalculateStreaks(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    if (!res.locals.user.roles.includes(userRoles.admin)) {
      return res.status(403).json({ message: 'Admin permission required' });
    }

    const users = await User.find({});
    if (!users.length) {
      return res.status(404).json({ message: 'No users found' });
    }

    const results = {
      totalUsers: users.length,
      processedUsers: 0,
      updatedUsers: 0,
      errors: [] as string[],
    };

    for (const user of users) {
      try {
        await recalculateStreaksForUser(user._id);

        results.updatedUsers++;
      } catch (error) {
        results.errors.push(
          `Error processing user ${user.username}: ${(error as Error).message}`
        );
      }
      results.processedUsers++;
    }

    return res.status(200).json({
      message: `Recalculated streaks for ${results.processedUsers} users (${results.updatedUsers} updated)`,
      results,
    });
  } catch (error) {
    return next(error as customError);
  }
}

export async function syncManabeIds(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    if (!res.locals.user.roles.includes(userRoles.admin)) {
      return res.status(403).json({ message: 'Admin permission required' });
    }

    const apiUrl = process.env.MANABE_API_URL;
    if (!apiUrl) {
      throw new customError('Manabe API URL not configured', 500);
    }

    // Get all users with Discord ID
    const users = await User.find({ discordId: { $exists: true, $ne: null } });

    if (!users.length) {
      return res
        .status(404)
        .json({ message: 'No users with Discord ID found' });
    }

    const results = {
      totalUsers: users.length,
      processedUsers: 0,
      totalLogsChecked: 0,
      totalLogsUpdated: 0,
      errors: [] as string[],
    };

    for (const user of users) {
      try {
        // Fetch all logs from Manabe API for this user
        const response = await axios.get(apiUrl, {
          params: {
            user: user.discordId,
            limit: 0, // Get all logs
            page: 1,
          },
        });

        const manabeLogs = response.data as IManabeLogs[];

        if (!manabeLogs || manabeLogs.length === 0) {
          results.processedUsers++;
          continue;
        }

        // Get all logs for this user that don't have a manabeId
        const userLogs = await Log.find({
          user: user._id,
          manabeId: { $exists: false },
        });

        results.totalLogsChecked += userLogs.length;

        let updatedCount = 0;

        // Match logs by exact timestamp
        for (const userLog of userLogs) {
          const matchingManabeLog = manabeLogs.find((mLog: any) => {
            const manabeDate = new Date(mLog.createdAt);
            const userLogDate = new Date(userLog.date);
            // Match if timestamps are exactly the same
            return manabeDate.getTime() === userLogDate.getTime();
          });

          if (matchingManabeLog) {
            userLog.manabeId = matchingManabeLog._id;
            await userLog.save();
            updatedCount++;
            results.totalLogsUpdated++;
          }
        }

        results.processedUsers++;
      } catch (error) {
        results.errors.push(
          `Error processing user ${user.username}: ${(error as Error).message}`
        );
        results.processedUsers++;
      }
    }

    return res.status(200).json({
      message: `Synced Manabe IDs for ${results.processedUsers} users. Updated ${results.totalLogsUpdated} logs out of ${results.totalLogsChecked} checked.`,
      results,
    });
  } catch (error) {
    return next(error as customError);
  }
}

export async function getUserMediaStats(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const { user } = res.locals;
  const { mediaId, type } = req.query;

  try {
    if (!mediaId || !type) {
      return res.status(400).json({
        message: 'MediaId and type are required',
      });
    }

    // Use user's timezone for date calculations
    const userTimezone = user.settings?.timezone || 'UTC';
    const now = new Date();

    // Get current date in user's timezone
    const userDate = new Date(
      now.toLocaleString('en-US', { timeZone: userTimezone })
    );
    const offsetNow = now.getTime() - userDate.getTime();

    const todayLocal = new Date(
      userDate.getFullYear(),
      userDate.getMonth(),
      userDate.getDate()
    );
    const today = new Date(todayLocal.getTime() + offsetNow);

    const thisWeekStartLocal = new Date(todayLocal);
    thisWeekStartLocal.setDate(todayLocal.getDate() - todayLocal.getDay());
    const thisWeekStart = new Date(thisWeekStartLocal.getTime() + offsetNow);

    const thisMonthStartLocal = new Date(
      userDate.getFullYear(),
      userDate.getMonth(),
      1
    );
    const thisMonthStart = new Date(thisMonthStartLocal.getTime() + offsetNow);

    const baseMatch = {
      user: user._id,
      mediaId: mediaId as string,
      type: type as string,
    };

    const totalStats = await Log.aggregate([
      { $match: baseMatch },
      {
        $group: {
          _id: null,
          totalLogs: { $sum: 1 },
          totalEpisodes: { $sum: { $ifNull: ['$episodes', 0] } },
          totalChars: { $sum: { $ifNull: ['$chars', 0] } },
          totalPages: { $sum: { $ifNull: ['$pages', 0] } },
          totalTime: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$type', 'anime'] },
                    {
                      $or: [
                        { $eq: ['$time', 0] },
                        { $eq: ['$time', null] },
                        { $eq: [{ $type: '$time' }, 'missing'] },
                      ],
                    },
                    { $gt: ['$episodes', 0] },
                  ],
                },
                { $multiply: ['$episodes', 24] },
                { $ifNull: ['$time', 0] },
              ],
            },
          },
          totalXp: { $sum: { $ifNull: ['$xp', 0] } },
          firstLogDate: { $min: '$date' },
          lastLogDate: { $max: '$date' },
        },
      },
    ]);

    const recentStats = await Log.aggregate([
      { $match: baseMatch },
      {
        $facet: {
          thisWeek: [
            { $match: { date: { $gte: thisWeekStart } } },
            {
              $group: {
                _id: null,
                count: { $sum: 1 },
                episodes: { $sum: { $ifNull: ['$episodes', 0] } },
                chars: { $sum: { $ifNull: ['$chars', 0] } },
                pages: { $sum: { $ifNull: ['$pages', 0] } },
                time: {
                  $sum: {
                    $cond: [
                      {
                        $and: [
                          { $eq: ['$type', 'anime'] },
                          {
                            $or: [
                              { $eq: ['$time', 0] },
                              { $eq: ['$time', null] },
                              { $eq: [{ $type: '$time' }, 'missing'] },
                            ],
                          },
                          { $gt: ['$episodes', 0] },
                        ],
                      },
                      { $multiply: ['$episodes', 24] },
                      { $ifNull: ['$time', 0] },
                    ],
                  },
                },
                xp: { $sum: { $ifNull: ['$xp', 0] } },
              },
            },
          ],
          thisMonth: [
            { $match: { date: { $gte: thisMonthStart } } },
            {
              $group: {
                _id: null,
                count: { $sum: 1 },
                episodes: { $sum: { $ifNull: ['$episodes', 0] } },
                chars: { $sum: { $ifNull: ['$chars', 0] } },
                pages: { $sum: { $ifNull: ['$pages', 0] } },
                time: {
                  $sum: {
                    $cond: [
                      {
                        $and: [
                          { $eq: ['$type', 'anime'] },
                          {
                            $or: [
                              { $eq: ['$time', 0] },
                              { $eq: ['$time', null] },
                              { $eq: [{ $type: '$time' }, 'missing'] },
                            ],
                          },
                          { $gt: ['$episodes', 0] },
                        ],
                      },
                      { $multiply: ['$episodes', 24] },
                      { $ifNull: ['$time', 0] },
                    ],
                  },
                },
                xp: { $sum: { $ifNull: ['$xp', 0] } },
              },
            },
          ],
          today: [
            { $match: { date: { $gte: today } } },
            {
              $group: {
                _id: null,
                count: { $sum: 1 },
                episodes: { $sum: { $ifNull: ['$episodes', 0] } },
                chars: { $sum: { $ifNull: ['$chars', 0] } },
                pages: { $sum: { $ifNull: ['$pages', 0] } },
                time: {
                  $sum: {
                    $cond: [
                      {
                        $and: [
                          { $eq: ['$type', 'anime'] },
                          {
                            $or: [
                              { $eq: ['$time', 0] },
                              { $eq: ['$time', null] },
                              { $eq: [{ $type: '$time' }, 'missing'] },
                            ],
                          },
                          { $gt: ['$episodes', 0] },
                        ],
                      },
                      { $multiply: ['$episodes', 24] },
                      { $ifNull: ['$time', 0] },
                    ],
                  },
                },
                xp: { $sum: { $ifNull: ['$xp', 0] } },
              },
            },
          ],
        },
      },
    ]);

    const total = totalStats[0] || {
      totalLogs: 0,
      totalEpisodes: 0,
      totalChars: 0,
      totalPages: 0,
      totalTime: 0,
      totalXp: 0,
      firstLogDate: null,
      lastLogDate: null,
    };

    const recent = recentStats[0];
    const thisWeek = recent.thisWeek[0] || {
      count: 0,
      episodes: 0,
      chars: 0,
      pages: 0,
      time: 0,
      xp: 0,
    };
    const thisMonth = recent.thisMonth[0] || {
      count: 0,
      episodes: 0,
      chars: 0,
      pages: 0,
      time: 0,
      xp: 0,
    };
    const todayStats = recent.today[0] || {
      count: 0,
      episodes: 0,
      chars: 0,
      pages: 0,
      time: 0,
      xp: 0,
    };

    return res.status(200).json({
      mediaId: mediaId as string,
      type: type as string,
      total: {
        logs: total.totalLogs,
        episodes: total.totalEpisodes,
        characters: total.totalChars,
        pages: total.totalPages,
        minutes: total.totalTime,
        hours: Math.round((total.totalTime / 60) * 10) / 10,
        xp: total.totalXp,
        firstLogDate: total.firstLogDate,
        lastLogDate: total.lastLogDate,
      },
      today: {
        logs: todayStats.count,
        episodes: todayStats.episodes,
        characters: todayStats.chars,
        pages: todayStats.pages,
        minutes: todayStats.time,
        hours: Math.round((todayStats.time / 60) * 10) / 10,
        xp: todayStats.xp,
      },
      thisWeek: {
        logs: thisWeek.count,
        episodes: thisWeek.episodes,
        characters: thisWeek.chars,
        pages: thisWeek.pages,
        minutes: thisWeek.time,
        hours: Math.round((thisWeek.time / 60) * 10) / 10,
        xp: thisWeek.xp,
      },
      thisMonth: {
        logs: thisMonth.count,
        episodes: thisMonth.episodes,
        characters: thisMonth.chars,
        pages: thisMonth.pages,
        minutes: thisMonth.time,
        hours: Math.round((thisMonth.time / 60) * 10) / 10,
        xp: thisMonth.xp,
      },
    });
  } catch (error) {
    return next(error as customError);
  }
}

export async function getGlobalMediaStats(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const { mediaId, type } = req.query;

  try {
    if (!mediaId || !type) {
      return res.status(400).json({ message: 'MediaId and type are required' });
    }

    // Use UTC boundaries for global stats
    const now = new Date();
    const todayUTC = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    );
    const weekStartUTC = new Date(todayUTC);
    weekStartUTC.setUTCDate(todayUTC.getUTCDate() - todayUTC.getUTCDay());
    const monthStartUTC = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
    );

    const baseMatch = {
      mediaId: mediaId as string,
      type: type as string,
      private: { $ne: true },
    };

    const totalStats = await Log.aggregate([
      { $match: baseMatch },
      {
        $group: {
          _id: null,
          totalLogs: { $sum: 1 },
          totalEpisodes: { $sum: { $ifNull: ['$episodes', 0] } },
          totalChars: { $sum: { $ifNull: ['$chars', 0] } },
          totalPages: { $sum: { $ifNull: ['$pages', 0] } },
          totalTime: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$type', 'anime'] },
                    {
                      $or: [
                        { $eq: ['$time', 0] },
                        { $eq: ['$time', null] },
                        { $eq: [{ $type: '$time' }, 'missing'] },
                      ],
                    },
                    { $gt: ['$episodes', 0] },
                  ],
                },
                { $multiply: ['$episodes', 24] },
                { $ifNull: ['$time', 0] },
              ],
            },
          },
          totalXp: { $sum: { $ifNull: ['$xp', 0] } },
          firstLogDate: { $min: '$date' },
          lastLogDate: { $max: '$date' },
        },
      },
    ]);

    const recentStats = await Log.aggregate([
      { $match: baseMatch },
      {
        $facet: {
          thisWeek: [
            { $match: { date: { $gte: weekStartUTC } } },
            {
              $group: {
                _id: null,
                count: { $sum: 1 },
                episodes: { $sum: { $ifNull: ['$episodes', 0] } },
                chars: { $sum: { $ifNull: ['$chars', 0] } },
                pages: { $sum: { $ifNull: ['$pages', 0] } },
                time: {
                  $sum: {
                    $cond: [
                      {
                        $and: [
                          { $eq: ['$type', 'anime'] },
                          {
                            $or: [
                              { $eq: ['$time', 0] },
                              { $eq: ['$time', null] },
                              { $eq: [{ $type: '$time' }, 'missing'] },
                            ],
                          },
                          { $gt: ['$episodes', 0] },
                        ],
                      },
                      { $multiply: ['$episodes', 24] },
                      { $ifNull: ['$time', 0] },
                    ],
                  },
                },
                xp: { $sum: { $ifNull: ['$xp', 0] } },
              },
            },
          ],
          thisMonth: [
            { $match: { date: { $gte: monthStartUTC } } },
            {
              $group: {
                _id: null,
                count: { $sum: 1 },
                episodes: { $sum: { $ifNull: ['$episodes', 0] } },
                chars: { $sum: { $ifNull: ['$chars', 0] } },
                pages: { $sum: { $ifNull: ['$pages', 0] } },
                time: {
                  $sum: {
                    $cond: [
                      {
                        $and: [
                          { $eq: ['$type', 'anime'] },
                          {
                            $or: [
                              { $eq: ['$time', 0] },
                              { $eq: ['$time', null] },
                              { $eq: [{ $type: '$time' }, 'missing'] },
                            ],
                          },
                          { $gt: ['$episodes', 0] },
                        ],
                      },
                      { $multiply: ['$episodes', 24] },
                      { $ifNull: ['$time', 0] },
                    ],
                  },
                },
                xp: { $sum: { $ifNull: ['$xp', 0] } },
              },
            },
          ],
          today: [
            { $match: { date: { $gte: todayUTC } } },
            {
              $group: {
                _id: null,
                count: { $sum: 1 },
                episodes: { $sum: { $ifNull: ['$episodes', 0] } },
                chars: { $sum: { $ifNull: ['$chars', 0] } },
                pages: { $sum: { $ifNull: ['$pages', 0] } },
                time: {
                  $sum: {
                    $cond: [
                      {
                        $and: [
                          { $eq: ['$type', 'anime'] },
                          {
                            $or: [
                              { $eq: ['$time', 0] },
                              { $eq: ['$time', null] },
                              { $eq: [{ $type: '$time' }, 'missing'] },
                            ],
                          },
                          { $gt: ['$episodes', 0] },
                        ],
                      },
                      { $multiply: ['$episodes', 24] },
                      { $ifNull: ['$time', 0] },
                    ],
                  },
                },
                xp: { $sum: { $ifNull: ['$xp', 0] } },
              },
            },
          ],
        },
      },
    ]);

    const total = totalStats[0] || {
      totalLogs: 0,
      totalEpisodes: 0,
      totalChars: 0,
      totalPages: 0,
      totalTime: 0,
      totalXp: 0,
      firstLogDate: null,
      lastLogDate: null,
    };

    const recent =
      recentStats[0] || ({ thisWeek: [], thisMonth: [], today: [] } as any);
    const thisWeek = recent.thisWeek[0] || {
      count: 0,
      episodes: 0,
      chars: 0,
      pages: 0,
      time: 0,
      xp: 0,
    };
    const thisMonth = recent.thisMonth[0] || {
      count: 0,
      episodes: 0,
      chars: 0,
      pages: 0,
      time: 0,
      xp: 0,
    };
    const todayStats = recent.today[0] || {
      count: 0,
      episodes: 0,
      chars: 0,
      pages: 0,
      time: 0,
      xp: 0,
    };

    return res.status(200).json({
      mediaId: mediaId as string,
      type: type as string,
      total: {
        logs: total.totalLogs,
        episodes: total.totalEpisodes,
        characters: total.totalChars,
        pages: total.totalPages,
        minutes: total.totalTime,
        hours: Math.round((total.totalTime / 60) * 10) / 10,
        xp: total.totalXp,
        firstLogDate: total.firstLogDate,
        lastLogDate: total.lastLogDate,
      },
      today: {
        logs: todayStats.count,
        episodes: todayStats.episodes,
        characters: todayStats.chars,
        pages: todayStats.pages,
        minutes: todayStats.time,
        hours: Math.round((todayStats.time / 60) * 10) / 10,
        xp: todayStats.xp,
      },
      thisWeek: {
        logs: thisWeek.count,
        episodes: thisWeek.episodes,
        characters: thisWeek.chars,
        pages: thisWeek.pages,
        minutes: thisWeek.time,
        hours: Math.round((thisWeek.time / 60) * 10) / 10,
        xp: thisWeek.xp,
      },
      thisMonth: {
        logs: thisMonth.count,
        episodes: thisMonth.episodes,
        characters: thisMonth.chars,
        pages: thisMonth.pages,
        minutes: thisMonth.time,
        hours: Math.round((thisMonth.time / 60) * 10) / 10,
        xp: thisMonth.xp,
      },
    });
  } catch (error) {
    return next(error as customError);
  }
}

export async function getRecentMediaLogs(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { mediaId, type } = req.query;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;

    if (!mediaId || !type) {
      return res.status(400).json({ message: 'MediaId and type are required' });
    }

    const pipeline: PipelineStage[] = [
      {
        $match: {
          mediaId: mediaId as string,
          type: type as string,
          $or: [{ private: { $exists: false } }, { private: false }],
        },
      },
      { $sort: { date: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: 'users',
          localField: 'user',
          foreignField: '_id',
          as: 'user',
          pipeline: [{ $project: { username: 1, avatar: 1 } }],
        },
      },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'media',
          localField: 'mediaId',
          foreignField: 'contentId',
          as: 'media',
          pipeline: [
            {
              $project: {
                contentId: 1,
                title: 1,
                contentImage: 1,
                type: 1,
              },
            },
          ],
        },
      },
      { $unwind: { path: '$media', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          user: '$user',
          type: 1,
          mediaId: 1,
          manabeId: 1,
          xp: 1,
          description: 1,
          episodes: 1,
          pages: 1,
          chars: 1,
          time: 1,
          date: 1,
          unknownDate: 1,
          media: 1,
        },
      },
    ];

    const logs = await Log.aggregate(pipeline);
    if (!logs.length) return res.sendStatus(204);

    const normalizedLogs = logs.map((log) => ({
      ...log,
      description: getDescriptionWithMediaFallback(log.description, log.media),
    }));

    return res.status(200).json(normalizedLogs);
  } catch (error) {
    return next(error as customError);
  }
}

export async function getLogScreenStats(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const { user } = res.locals;
  const type = req.query.type as string;

  try {
    // Use user's timezone for date calculations
    const userTimezone = user.settings?.timezone || 'UTC';
    const now = new Date();

    // Get current date in user's timezone
    const userDate = new Date(
      now.toLocaleString('en-US', { timeZone: userTimezone })
    );
    const offsetNow = now.getTime() - userDate.getTime();

    const todayLocal = new Date(
      userDate.getFullYear(),
      userDate.getMonth(),
      userDate.getDate()
    );
    const today = new Date(todayLocal.getTime() + offsetNow);

    const thisWeekStartLocal = new Date(todayLocal);
    thisWeekStartLocal.setDate(todayLocal.getDate() - todayLocal.getDay());
    const thisWeekStart = new Date(thisWeekStartLocal.getTime() + offsetNow);

    const thisMonthStartLocal = new Date(
      userDate.getFullYear(),
      userDate.getMonth(),
      1
    );
    const thisMonthStart = new Date(thisMonthStartLocal.getTime() + offsetNow);

    const baseMatch = { user: user._id };
    const typeMatch = type ? { ...baseMatch, type } : baseMatch;

    const totalStats = await Log.aggregate([
      { $match: typeMatch },
      {
        $group: {
          _id: null,
          totalLogs: { $sum: 1 },
          totalEpisodes: { $sum: { $ifNull: ['$episodes', 0] } },
          totalChars: { $sum: { $ifNull: ['$chars', 0] } },
          totalPages: { $sum: { $ifNull: ['$pages', 0] } },
          totalTime: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$type', 'anime'] },
                    {
                      $or: [
                        { $eq: ['$time', 0] },
                        { $eq: ['$time', null] },
                        { $eq: [{ $type: '$time' }, 'missing'] },
                      ],
                    },
                    { $gt: ['$episodes', 0] },
                  ],
                },
                { $multiply: ['$episodes', 24] },
                { $ifNull: ['$time', 0] },
              ],
            },
          },
          totalXp: { $sum: { $ifNull: ['$xp', 0] } },
        },
      },
    ]);

    const recentStats = await Log.aggregate([
      { $match: typeMatch },
      {
        $facet: {
          thisWeek: [
            { $match: { date: { $gte: thisWeekStart } } },
            {
              $group: {
                _id: null,
                count: { $sum: 1 },
                episodes: { $sum: { $ifNull: ['$episodes', 0] } },
                chars: { $sum: { $ifNull: ['$chars', 0] } },
                pages: { $sum: { $ifNull: ['$pages', 0] } },
                time: {
                  $sum: {
                    $cond: [
                      {
                        $and: [
                          { $eq: ['$type', 'anime'] },
                          {
                            $or: [
                              { $eq: ['$time', 0] },
                              { $eq: ['$time', null] },
                              { $eq: [{ $type: '$time' }, 'missing'] },
                            ],
                          },
                          { $gt: ['$episodes', 0] },
                        ],
                      },
                      { $multiply: ['$episodes', 24] },
                      { $ifNull: ['$time', 0] },
                    ],
                  },
                },
                xp: { $sum: { $ifNull: ['$xp', 0] } },
              },
            },
          ],
          thisMonth: [
            { $match: { date: { $gte: thisMonthStart } } },
            {
              $group: {
                _id: null,
                count: { $sum: 1 },
                episodes: { $sum: { $ifNull: ['$episodes', 0] } },
                chars: { $sum: { $ifNull: ['$chars', 0] } },
                pages: { $sum: { $ifNull: ['$pages', 0] } },
                time: {
                  $sum: {
                    $cond: [
                      {
                        $and: [
                          { $eq: ['$type', 'anime'] },
                          {
                            $or: [
                              { $eq: ['$time', 0] },
                              { $eq: ['$time', null] },
                              { $eq: [{ $type: '$time' }, 'missing'] },
                            ],
                          },
                          { $gt: ['$episodes', 0] },
                        ],
                      },
                      { $multiply: ['$episodes', 24] },
                      { $ifNull: ['$time', 0] },
                    ],
                  },
                },
                xp: { $sum: { $ifNull: ['$xp', 0] } },
              },
            },
          ],
          today: [
            { $match: { date: { $gte: today } } },
            {
              $group: {
                _id: null,
                count: { $sum: 1 },
                episodes: { $sum: { $ifNull: ['$episodes', 0] } },
                chars: { $sum: { $ifNull: ['$chars', 0] } },
                pages: { $sum: { $ifNull: ['$pages', 0] } },
                time: {
                  $sum: {
                    $cond: [
                      {
                        $and: [
                          { $eq: ['$type', 'anime'] },
                          {
                            $or: [
                              { $eq: ['$time', 0] },
                              { $eq: ['$time', null] },
                              { $eq: [{ $type: '$time' }, 'missing'] },
                            ],
                          },
                          { $gt: ['$episodes', 0] },
                        ],
                      },
                      { $multiply: ['$episodes', 24] },
                      { $ifNull: ['$time', 0] },
                    ],
                  },
                },
                xp: { $sum: { $ifNull: ['$xp', 0] } },
              },
            },
          ],
        },
      },
    ]);

    const total = totalStats[0] || {
      totalLogs: 0,
      totalEpisodes: 0,
      totalChars: 0,
      totalPages: 0,
      totalTime: 0,
      totalXp: 0,
    };

    const recent = recentStats[0];
    const thisWeek = recent.thisWeek[0] || {
      count: 0,
      episodes: 0,
      chars: 0,
      pages: 0,
      time: 0,
      xp: 0,
    };
    const thisMonth = recent.thisMonth[0] || {
      count: 0,
      episodes: 0,
      chars: 0,
      pages: 0,
      time: 0,
      xp: 0,
    };
    const todayStats = recent.today[0] || {
      count: 0,
      episodes: 0,
      chars: 0,
      pages: 0,
      time: 0,
      xp: 0,
    };

    return res.status(200).json({
      type: type || 'all',
      total: {
        logs: total.totalLogs,
        episodes: total.totalEpisodes,
        characters: total.totalChars,
        pages: total.totalPages,
        minutes: total.totalTime,
        hours: Math.round((total.totalTime / 60) * 10) / 10,
        xp: total.totalXp,
      },
      today: {
        logs: todayStats.count,
        episodes: todayStats.episodes,
        characters: todayStats.chars,
        pages: todayStats.pages,
        minutes: todayStats.time,
        hours: Math.round((todayStats.time / 60) * 10) / 10,
        xp: todayStats.xp,
      },
      thisWeek: {
        logs: thisWeek.count,
        episodes: thisWeek.episodes,
        characters: thisWeek.chars,
        pages: thisWeek.pages,
        minutes: thisWeek.time,
        hours: Math.round((thisWeek.time / 60) * 10) / 10,
        xp: thisWeek.xp,
      },
      thisMonth: {
        logs: thisMonth.count,
        episodes: thisMonth.episodes,
        characters: thisMonth.chars,
        pages: thisMonth.pages,
        minutes: thisMonth.time,
        hours: Math.round((thisMonth.time / 60) * 10) / 10,
        xp: thisMonth.xp,
      },
    });
  } catch (error) {
    return next(error as customError);
  }
}

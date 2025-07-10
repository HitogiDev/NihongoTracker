import { Request, Response, NextFunction } from 'express';
import { ParamsDictionary } from 'express-serve-static-core';
import { MediaBase, Anime, Manga, Reading } from '../models/media.model.js';
import { ILog, IEditedFields, ICreateLog, IMediaDocument } from '../types.js';
import Log from '../models/log.model.js';
import User from '../models/user.model.js';
import { ObjectId, PipelineStage, Types } from 'mongoose';
import { customError } from '../middlewares/errorMiddleware.js';
import updateStats from '../services/updateStats.js';
import { searchAnilist } from '../services/searchAnilist.js';
import { updateLevelAndXp } from '../services/updateStats.js';
import {
  XP_FACTOR_TIME,
  XP_FACTOR_CHARS,
  XP_FACTOR_EPISODES,
  XP_FACTOR_PAGES,
} from '../middlewares/calculateXp.js';

export async function getUntrackedLogs(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  const { user } = res.locals;
  try {
    const untrackedLogs = await Log.find({
      user: user._id,
      type: { $in: ['anime', 'manga', 'reading', 'vn'] },
      mediaId: { $exists: false },
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
  const { user } = res.locals;
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 3;

  try {
    const recentLogs = await Log.aggregate([
      {
        $match: {
          user: user._id,
        },
      },
      {
        $sort: {
          date: -1,
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
          description: 1,
          type: 1,
          time: 1,
          episodes: 1,
          mediaId: 1,
          media: 1,
          xp: 1,
        },
      },
    ]);

    return res.status(200).json(recentLogs);
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
    // Get date ranges for current month and previous month in UTC
    const now = new Date();
    // Use UTC methods to ensure consistent date handling regardless of server timezone
    const currentMonthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
    );
    const previousMonthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)
    );
    const previousMonthEnd = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0)
    );

    // Define reading and listening types
    const readingTypes = ['reading', 'manga', 'vn'];
    const listeningTypes = ['anime', 'audio', 'video'];

    // Get current month stats
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
                { $multiply: ['$episodes', 24] }, // 24 minutes per episode
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
                { $multiply: ['$episodes', 24] }, // 24 minutes per episode
                {
                  $cond: [{ $in: ['$type', listeningTypes] }, '$time', 0],
                },
              ],
            },
          },
        },
      },
    ]);

    // Get previous month stats
    const previousMonthStats = await Log.aggregate([
      {
        $match: {
          user: user._id,
          date: { $gte: previousMonthStart, $lte: previousMonthEnd },
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
                { $multiply: ['$episodes', 24] }, // 24 minutes per episode
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
                { $multiply: ['$episodes', 24] }, // 24 minutes per episode
                {
                  $cond: [{ $in: ['$type', listeningTypes] }, '$time', 0],
                },
              ],
            },
          },
        },
      },
    ]);

    // Ensure we have default values if no logs were found
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

    // Remove _id from the results
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
  date?: {
    $gte?: Date;
    $lte?: Date;
  };
  description?: { $regex: string; $options: string };
  mediaId?: string;
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

  // Add start and end date filters
  const startDate = req.query.start
    ? new Date(req.query.start as string)
    : null;
  const endDate = req.query.end ? new Date(req.query.end as string) : null;

  // Add type filter - handle both string and array
  const type = req.query.type;

  // Add search functionality
  const search = req.query.search as string;

  try {
    // Check if username exists
    if (!req.params.username) {
      throw new customError('Username is required', 400);
    }

    // First verify the user exists and get their ObjectId
    const userExists = await User.findOne({
      username: req.params.username,
    }).select('_id');
    if (!userExists) {
      throw new customError('User not found', 404);
    }

    // Build the initial match criteria to filter logs efficiently
    let initialMatch: IInitialMatch = {
      user: userExists._id,
    };

    // Add type filter early - handle both string and array
    if (type) {
      if (Array.isArray(type)) {
        // If type is an array, use $in operator
        initialMatch.type = { $in: type as string[] };
      } else {
        // If type is a string, use direct match
        initialMatch.type = type as string;
      }
    }

    // Add date filter early
    if (startDate || endDate) {
      initialMatch.date = {
        ...(startDate && { $gte: startDate }),
        ...(endDate && { $lte: endDate }),
      };
    }

    // Add search filter early (if provided)
    if (search) {
      initialMatch.description = { $regex: search, $options: 'i' };
    }

    // Add media filters early
    if (req.query.mediaId && typeof req.query.mediaId === 'string') {
      initialMatch.mediaId = req.query.mediaId;
    }

    let pipeline: PipelineStage[] = [
      {
        $match: initialMatch,
      },
      {
        $sort: {
          date: -1,
        },
      },
      {
        $skip: skip,
      },
    ];

    // Only add limit if it's greater than 0
    if (limit > 0) {
      pipeline.push({
        $limit: limit,
      });
    }

    // Only project log fields and mediaId/type for the list
    pipeline.push({
      $project: {
        _id: 1,
        type: 1,
        mediaId: 1,
        xp: 1,
        description: 1,
        episodes: 1,
        pages: 1,
        chars: 1,
        time: 1,
        date: 1,
        // No media join here
      },
    });

    const logs = await Log.aggregate(pipeline, {
      collation: { locale: 'en', strength: 2 },
    });

    if (!logs.length) return res.sendStatus(204);

    return res.status(200).json(logs);
  } catch (error) {
    console.error('Error in getUserLogs:', error);
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
          let: { mediaId: '$mediaId', type: '$type' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$contentId', '$$mediaId'] },
                    { $eq: ['$type', '$$type'] },
                  ],
                },
              },
            },
          ],
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
        $project: {
          _id: 1,
          type: 1,
          description: 1,
          episodes: 1,
          pages: 1,
          chars: 1,
          time: 1,
          date: 1,
          mediaId: 1, // Keep original mediaId field
          xp: 1,
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

    // For shared logs, we want to include media information but not expose sensitive user data
    const sharedLogData = {
      _id: foundLog._id,
      type: foundLog.type,
      description: foundLog.description,
      episodes: foundLog.episodes,
      pages: foundLog.pages,
      chars: foundLog.chars,
      time: foundLog.time,
      date: foundLog.date,
      mediaId: foundLog.mediaId, // Original mediaId preserved
      media: foundLog.mediaData, // Populated media data in separate field
      xp: foundLog.xp,
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

    await updateStats(res, next, true); // Pass true for deletion
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
  const { description, time, date, mediaId, episodes, pages, chars, type, xp } =
    req.body;

  try {
    const log: ILog | null = await Log.findOne({
      _id: new Types.ObjectId(req.params.id),
      user: res.locals.user.id,
    });

    if (!log) throw new customError('Log not found', 404);

    const validKeys: (keyof IEditedFields)[] = [
      'episodes',
      'pages',
      'chars',
      'time',
      'xp',
    ];

    const editedFields: IEditedFields = {};

    for (const key in req.body) {
      if (validKeys.includes(key as keyof IEditedFields)) {
        const value = log[key as keyof IEditedFields];
        // Only assign if value is not null or undefined
        if (value !== null && value !== undefined) {
          editedFields[key as keyof IEditedFields] = value;
        }
      }
    }

    log.description = description !== undefined ? description : log.description;
    log.time = time !== undefined ? time : log.time;
    log.date = date !== undefined ? date : log.date;
    log.mediaId = mediaId !== undefined ? mediaId : log.mediaId;
    log.episodes = episodes !== undefined ? episodes : log.episodes;
    log.pages = pages !== undefined ? pages : log.pages;
    log.chars = chars !== undefined ? chars : log.chars;
    log.type = type !== undefined ? type : log.type;
    log.xp = xp !== undefined ? xp : log.xp; // Update XP from middleware calculation
    log.editedFields = editedFields;

    const updatedLog = await log.save();
    res.locals.log = updatedLog;
    await updateStats(res, next);

    log.editedFields = null;
    await log.save();

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
    pages,
    episodes,
    xp,
    time,
    date,
    chars,
    mediaData,
  } = req.body;

  try {
    if (!type) throw new customError('Log type is required', 400);
    if (!description) throw new customError('Description is required', 400);

    // Parse date properly, ensuring it's stored in UTC
    let logDate: Date;
    if (date) {
      if (typeof date === 'string') {
        logDate = new Date(date); // This will parse ISO string with timezone info correctly
      } else {
        logDate = new Date(date);
      }
    } else {
      logDate = new Date(); // Current time in UTC
    }

    let logMedia;
    let createMedia = true;

    if (mediaId) {
      logMedia = await MediaBase.findOne({ contentId: mediaId, type });
      createMedia = false; // We already have mediaId, so no need to create new media
    }

    // Handle YouTube video creation for 'video' type logs
    if (type === 'video' && createMedia && mediaData) {
      // Create the channel media entry (using channel ID as the main media)
      const channelMedia = await MediaBase.create({
        contentId: mediaData.channelId, // Use channel ID as the content ID
        title: {
          contentTitleNative: mediaData.channelTitle,
          contentTitleEnglish: mediaData.channelTitle,
        },
        contentImage: mediaData.channelImage,
        coverImage: mediaData.channelImage,
        description: [
          { description: mediaData.channelDescription || '', language: 'eng' },
        ],
        type: 'video',
        isAdult: false,
      });

      logMedia = channelMedia;
    } else if (
      createMedia && // Media doesn't exist yet
      type !== 'audio' && // Not audio type
      type !== 'other' && // Not other type
      type !== 'video' && // Not video type (handled above)
      mediaId && // We have a mediaId
      mediaData // We have mediaData
    ) {
      // Create AniList media document (anime, manga, etc.)
      await MediaBase.create({
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
        description: mediaData.description
          ? [{ description: mediaData.description, language: 'eng' }]
          : undefined,
      });
    }

    if (!logMedia && createMedia) {
      // If we couldn't find or create media, we need to handle it
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
      xp,
      description,
      private: false,
      time,
      date: logDate, // Use properly parsed date
      chars,
    });
    if (!newLog) throw new customError('Log could not be created', 500);
    const savedLog = await newLog.save();
    if (!savedLog) throw new customError('Log could not be saved', 500);

    res.locals.log = savedLog;
    await updateStats(res, next);

    const userStats = await User.findById(res.locals.user._id);

    if (!userStats) throw new customError('User not found', 404);

    // Fix streak calculation logic
    const today = new Date();
    const todayString = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    ).toISOString();

    // Get last streak date in the same format as today for comparison
    const lastStreakDate = userStats.stats.lastStreakDate
      ? new Date(
          userStats.stats.lastStreakDate.getFullYear(),
          userStats.stats.lastStreakDate.getMonth(),
          userStats.stats.lastStreakDate.getDate()
        ).toISOString()
      : null;

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayString = new Date(
      yesterday.getFullYear(),
      yesterday.getMonth(),
      yesterday.getDate()
    ).toISOString();

    if (lastStreakDate === todayString) {
      // Already logged today, do nothing to streak count
    } else if (lastStreakDate === yesterdayString) {
      // Logged yesterday, increment streak
      userStats.stats.currentStreak += 1;
    } else if (!lastStreakDate || lastStreakDate !== todayString) {
      // No previous logs or gap in logs, reset streak to 1
      userStats.stats.currentStreak = 1;
    }

    // Update last streak date to today
    userStats.stats.lastStreakDate = today;

    // Update longest streak if current streak is longer
    if (userStats.stats.currentStreak > userStats.stats.longestStreak) {
      userStats.stats.longestStreak = userStats.stats.currentStreak;
    }
    await userStats.save();

    return res.status(200).json(savedLog);
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
    if (logsMediaId[type as keyof IImportStats['anilistMediaId']].length > 0) {
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
}

export async function importLogs(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const logs: ILog[] = req.body.logs;
  try {
    const importStats: IImportStats = logs.reduce<IImportStats>(
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
          log.type === 'vn'
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
    const insertedLogs = await Log.insertMany(logs, {
      ordered: false,
    });
    await updateStats(res, next);

    const user = await User.findById(res.locals.user.id);
    if (!user) throw new customError('User not found', 404);
    user.lastImport = new Date();
    const savedUser = await user.save();
    if (!savedUser) throw new customError('User could not be updated', 500);

    const createdMedia = await createImportedMedia(
      res.locals.user._id,
      importStats.anilistMediaId
    );

    let statusMessage = `${insertedLogs.length} log${
      insertedLogs.length > 1 ? 's' : ''
    } imported successfully`;

    if (insertedLogs.length < logs.length) {
      statusMessage += `\n${logs.length - insertedLogs.length} log${
        logs.length - insertedLogs.length > 1 ? 's' : ''
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

        // Check if we need to convert video logs to movie logs
        const shouldConvertToMovie = media.type === 'movie';
        const updateData: any = { mediaId: media.contentId };

        if (shouldConvertToMovie) {
          // Convert video type logs to movie type when matched to a movie
          updateData.type = 'movie';
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
  timeRange?: 'today' | 'month' | 'year' | 'total';
  type?: 'all' | 'anime' | 'manga' | 'reading' | 'audio' | 'video';
}

interface IStatByType {
  type: string;
  count: number;
  totalXp: number;
  totalChars: number;
  totalTimeMinutes: number;
  totalTimeHours: number;
  untrackedCount: number;
  dates: Array<{
    date: Date;
    xp: number;
    time?: number;
    episodes?: number;
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
  };
  readingSpeedData?: Array<{
    date: Date;
    type: string;
    time: number;
    chars?: number;
    pages?: number;
    charsPerHour?: number | null;
  }>;
  timeRange: 'today' | 'month' | 'year' | 'total';
  selectedType: string;
}

export async function getUserStats(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response<IUserStats> | void> {
  try {
    const { username } = req.params;
    const { timeRange = 'total', type = 'all' } =
      req.query as IGetUserStatsQuery;

    // Validate timeRange
    const validTimeRanges = ['today', 'month', 'year', 'total'];
    if (!validTimeRanges.includes(timeRange)) {
      return res.status(400).json({ message: 'Invalid time range' });
    }

    // Validate type - handle both string and array
    const validTypes = [
      'all',
      'anime',
      'manga',
      'reading',
      'audio',
      'video',
      'movie',
      'vn',
      'other',
    ];

    if (Array.isArray(type)) {
      // If type is an array, validate each type in the array
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

    // Build date filter
    let dateFilter: any = {};
    let daysPeriod = 1; // Default for 'today'
    const now = new Date();
    if (timeRange === 'today') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      dateFilter = { date: { $gte: start } };
      daysPeriod = 1;
    } else if (timeRange === 'month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      dateFilter = { date: { $gte: start } };
      daysPeriod = now.getDate(); // Days elapsed in current month
    } else if (timeRange === 'year') {
      const start = new Date(now.getFullYear(), 0, 1);
      dateFilter = { date: { $gte: start } };
      const dayOfYear =
        Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) +
        1;
      daysPeriod = dayOfYear;
    } else if (timeRange === 'total') {
      // For total, calculate days from first log to now
      const firstLog = await Log.findOne({ user: user._id }).sort({ date: 1 });
      if (firstLog) {
        const firstLogDate = firstLog.date ?? new Date(0);
        const daysDiff =
          Math.floor(
            (now.getTime() - firstLogDate.getTime()) / (1000 * 60 * 60 * 24)
          ) + 1;
        daysPeriod = daysDiff;
      } else {
        daysPeriod = 1; // Fallback if no logs exist
      }
    }

    // Build match filter for aggregation (this affects what gets aggregated)
    let aggregationMatch: any = { user: user._id, ...dateFilter };

    // Build match filter for totals calculation - handle array and string types
    let totalsMatch: any = { user: user._id, ...dateFilter };
    if (type !== 'all') {
      if (Array.isArray(type)) {
        totalsMatch.type = { $in: type };
      } else {
        totalsMatch.type = type;
      }
    }

    const logTypes = [
      'reading',
      'anime',
      'vn',
      'video',
      'movie',
      'manga',
      'audio',
      'other',
    ];

    // Aggregate stats by type (always get all types for the statsByType array)
    const statsByType: IStatByType[] = await Log.aggregate([
      { $match: aggregationMatch },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          totalXp: { $sum: '$xp' },
          totalChars: { $sum: { $ifNull: ['$chars', 0] } },
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
          totalTimeMinutes: '$totalTime',
          totalTimeHours: { $divide: ['$totalTime', 60] },
          untrackedCount: 1,
          dates: 1,
        },
      },
    ]);

    // Calculate totals based on the filtered data (respects type filter)
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

        // Separate reading and listening hours
        if (['reading', 'manga', 'vn'].includes(stat.type)) {
          acc.readingHours += stat.totalTimeHours;
        } else if (['anime', 'video', 'movie', 'audio'].includes(stat.type)) {
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
      }
    );

    // Calculate daily average hours
    totals.dailyAverageHours =
      daysPeriod > 0 ? totals.totalTimeHours / daysPeriod : 0;

    // Create a complete dataset with all types (for charts)
    const completeStats: IStatByType[] = logTypes.map((type) => {
      const typeStat = statsByType.find((stat) => stat.type === type);
      return (
        typeStat || {
          type,
          count: 0,
          totalXp: 0,
          totalChars: 0,
          totalTimeMinutes: 0,
          totalTimeHours: 0,
          untrackedCount: 0,
          dates: [],
        }
      );
    });

    // Calculate reading speed data for reading-type logs
    const readingSpeedData =
      type === 'all' ||
      (Array.isArray(type) &&
        type.some((t) => ['reading', 'manga', 'vn'].includes(t))) ||
      ['reading', 'manga', 'vn'].includes(type as string)
        ? await Log.aggregate([
            {
              $match: {
                user: user._id,
                ...dateFilter,
                type: { $in: ['reading', 'manga', 'vn'] },
                time: { $ne: null, $gt: 0 },
                $or: [
                  { chars: { $ne: null, $gt: 0 } },
                  { pages: { $ne: null, $gt: 0 } },
                ],
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

    // Return comprehensive stats object
    return res.json({
      totals,
      statsByType: completeStats,
      readingSpeedData,
      timeRange,
      selectedType: Array.isArray(type) ? type.join(',') : type,
    });
  } catch (error) {
    return next(error);
  }
}

export async function recalculateXp(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    // Check admin permission
    if (!res.locals.user.roles.includes('admin')) {
      return res.status(403).json({ message: 'Admin permission required' });
    }

    // Get all users
    const users = await User.find({});

    if (!users.length) {
      return res.status(404).json({ message: 'No users found' });
    }

    const results = {
      totalUsers: users.length,
      processedUsers: 0,
      updatedLogs: 0,
      errors: [] as string[],
    };

    // Process each user
    for (const user of users) {
      try {
        // Reset user's stats
        if (user.stats) {
          user.stats.readingXp = 0;
          user.stats.listeningXp = 0;
          user.stats.userXp = 0;
        }

        // Get all logs for this user
        const logs = await Log.find({ user: user._id });

        if (!logs.length) {
          continue;
        }

        // Process each log
        for (const log of logs) {
          // Recalculate XP
          const timeXp = log.time
            ? Math.floor(((log.time * 45) / 100) * XP_FACTOR_TIME)
            : 0;
          const charsXp = log.chars
            ? Math.floor((log.chars / 350) * XP_FACTOR_CHARS)
            : 0;
          const pagesXp = log.pages
            ? Math.floor(log.pages * XP_FACTOR_PAGES)
            : 0;
          const episodesXp = log.episodes
            ? Math.floor(((log.episodes * 45) / 100) * XP_FACTOR_EPISODES)
            : 0;

          const oldXp = log.xp;

          // Calculate new XP based on log type
          switch (log.type) {
            case 'anime':
              log.xp = timeXp || episodesXp || 0;
              break;
            case 'reading':
            case 'manga':
            case 'vn':
            case 'video':
            case 'movie':
            case 'audio':
              log.xp = Math.max(timeXp, pagesXp, charsXp, episodesXp, 0);
              break;
            case 'other':
              log.xp = 0;
              break;
          }

          // Only save if XP changed
          if (log.xp !== oldXp) {
            await log.save();
            results.updatedLogs++;
          }

          // Update user's stats totals
          if (user.stats) {
            if (['anime', 'video', 'movie', 'audio'].includes(log.type)) {
              user.stats.listeningXp += log.xp;
            } else if (['reading', 'manga', 'vn'].includes(log.type)) {
              user.stats.readingXp += log.xp;
            }
            user.stats.userXp += log.xp;
          }
        }

        // Recalculate levels
        if (user.stats) {
          updateLevelAndXp(user.stats, 'reading');
          updateLevelAndXp(user.stats, 'listening');
          updateLevelAndXp(user.stats, 'user');

          // Save user with updated stats
          await user.save();
        }
        results.processedUsers++;
      } catch (error) {
        const customError = error as customError;
        results.errors.push(
          `Error processing user ${user.username}: ${customError.message}`
        );
      }
    }

    return res.status(200).json({
      message: `Recalculated stats for ${results.processedUsers} users (${results.updatedLogs} logs updated)`,
      results,
    });
  } catch (error) {
    return next(error as customError);
  }
}

// New endpoint: getLogDetails
export async function getLogDetails(
  req: Request,
  res: Response,
  next: NextFunction
) {
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
          let: { mediaId: '$mediaId', type: '$type' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$contentId', '$$mediaId'] },
                    { $eq: ['$type', '$$type'] },
                  ],
                },
              },
            },
          ],
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
        $project: {
          _id: 1,
          type: 1,
          description: 1,
          episodes: 1,
          pages: 1,
          chars: 1,
          time: 1,
          date: 1,
          mediaId: 1,
          xp: 1,
          editedFields: 1,
          private: 1,
          user: {
            _id: 1,
            username: 1,
            avatar: 1,
            titles: 1,
          },
          media: {
            _id: '$mediaData._id',
            contentId: '$mediaData.contentId',
            type: '$mediaData.type',
            title: '$mediaData.title',
            contentImage: '$mediaData.contentImage',
            coverImage: '$mediaData.coverImage',
            description: '$mediaData.description',
            episodes: '$mediaData.episodes',
            episodeDuration: '$mediaData.episodeDuration',
            chapters: '$mediaData.chapters',
            volumes: '$mediaData.volumes',
            isAdult: '$mediaData.isAdult',
            synonyms: '$mediaData.synonyms',
          },
        },
      },
    ]);

    const foundLog = logAggregation[0];
    if (!foundLog) throw new customError('Log not found', 404);

    // Return all details needed for LogCard details modal
    return res.status(200).json(foundLog);
  } catch (error) {
    return next(error as customError);
  }
}

// Recalculate streaks for all users (admin only)
export async function recalculateStreaks(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    // Check admin permission
    if (!res.locals.user.roles.includes('admin')) {
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
        // Fetch all logs for user, sorted by date ascending
        const logs = await Log.find({ user: user._id }).sort({ date: 1 });
        if (!logs.length || !user.stats) {
          continue;
        }

        let currentStreak = 0;
        let longestStreak = 0;
        let lastStreakDate: Date | null = null;

        for (const log of logs) {
          // Get log date (year, month, day only)
          const logDate = new Date(log.date.getFullYear(), log.date.getMonth(), log.date.getDate());

          if (!lastStreakDate) {
            // First log
            currentStreak = 1;
          } else {
            // Calculate difference in days
            const diffDays = Math.floor((logDate.getTime() - lastStreakDate.getTime()) / (1000 * 60 * 60 * 24));
            if (diffDays === 1) {
              // Consecutive day, increment streak
              currentStreak += 1;
            } else if (diffDays === 0) {
              // Same day, do nothing
            } else {
              // Gap, reset streak
              currentStreak = 1;
            }
          }

          // Update longest streak
          if (currentStreak > longestStreak) {
            longestStreak = currentStreak;
          }

          // Update last streak date
          lastStreakDate = logDate;
        }

        // Update user stats
        user.stats.currentStreak = currentStreak;
        user.stats.longestStreak = longestStreak;
        user.stats.lastStreakDate = lastStreakDate;
        await user.save();
        results.updatedUsers++;
      } catch (error) {
        results.errors.push(`Error processing user ${user.username}: ${(error as Error).message}`);
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

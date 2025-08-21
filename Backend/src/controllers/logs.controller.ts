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
    const now = new Date();

    const currentMonthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
    );
    const previousMonthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)
    );

    const lastDayOfPreviousMonth = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0)
    ).getUTCDate();

    const dayToUse = Math.min(now.getUTCDate(), lastDayOfPreviousMonth);

    const previousMonthActualDate = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, dayToUse)
    );

    const readingTypes = ['reading', 'manga', 'vn'];
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

  const startDate = req.query.start
    ? new Date(req.query.start as string)
    : null;
  const endDate = req.query.end ? new Date(req.query.end as string) : null;

  const type = req.query.type;

  const search = req.query.search as string;

  try {
    if (!req.params.username) {
      throw new customError('Username is required', 400);
    }

    const userExists = await User.findOne({
      username: req.params.username,
    }).select('_id');
    if (!userExists) {
      throw new customError('User not found', 404);
    }

    let initialMatch: IInitialMatch = {
      user: userExists._id,
    };

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
    ];

    if (skip > 0) {
      pipeline.push({ $skip: skip });
    }

    if (limit > 0) {
      pipeline.push({ $limit: limit });
    }

    pipeline.push(
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
          'media.contentId': 1,
          'media.title': 1,
          'media.contentImage': 1,
          'media.type': 1,
        },
      }
    );

    const logs = await Log.aggregate(pipeline);

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

    const sharedLogData = {
      _id: foundLog._id,
      type: foundLog.type,
      description: foundLog.description,
      episodes: foundLog.episodes,
      pages: foundLog.pages,
      chars: foundLog.chars,
      time: foundLog.time,
      date: foundLog.date,
      mediaId: foundLog.mediaId,
      media: foundLog.mediaData,
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

    await updateStats(res, next, true);
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
    log.xp = xp !== undefined ? xp : log.xp;
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

    let logDate: Date;
    if (date) {
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
      createMedia = false;
    }

    if (type === 'video' && createMedia && mediaData) {
      const channelMedia = await MediaBase.create({
        contentId: mediaData.channelId,
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
      createMedia &&
      type !== 'audio' &&
      type !== 'other' &&
      type !== 'video' &&
      mediaId &&
      mediaData
    ) {
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
      date: logDate,
      chars,
    });
    if (!newLog) throw new customError('Log could not be created', 500);
    const savedLog = await newLog.save();
    if (!savedLog) throw new customError('Log could not be saved', 500);

    res.locals.log = savedLog;
    await updateStats(res, next);

    const userStats = await User.findById(res.locals.user._id);

    if (!userStats) throw new customError('User not found', 404);

    const today = new Date();
    const todayString = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    ).toISOString();

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
    } else if (lastStreakDate === yesterdayString) {
      userStats.stats.currentStreak += 1;
    } else if (!lastStreakDate || lastStreakDate !== todayString) {
      userStats.stats.currentStreak = 1;
    }

    userStats.stats.lastStreakDate = today;

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

        const shouldConvertToMovie = media.type === 'movie';
        const updateData: any = { mediaId: media.contentId };

        if (shouldConvertToMovie) {
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

    const validTimeRanges = ['today', 'month', 'year', 'total'];
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
      'movie',
      'vn',
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

    let dateFilter: any = {};
    let daysPeriod = 1;
    const now = new Date();
    if (timeRange === 'today') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      dateFilter = { date: { $gte: start } };
      daysPeriod = 1;
    } else if (timeRange === 'month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      dateFilter = { date: { $gte: start } };
      daysPeriod = now.getDate();
    } else if (timeRange === 'year') {
      const start = new Date(now.getFullYear(), 0, 1);
      dateFilter = { date: { $gte: start } };
      const dayOfYear =
        Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) +
        1;
      daysPeriod = dayOfYear;
    } else if (timeRange === 'total') {
      const firstLog = await Log.findOne({ user: user._id }).sort({ date: 1 });
      if (firstLog) {
        const firstLogDate = firstLog.date ?? new Date(0);
        const daysDiff =
          Math.floor(
            (now.getTime() - firstLogDate.getTime()) / (1000 * 60 * 60 * 24)
          ) + 1;
        daysPeriod = daysDiff;
      } else {
        daysPeriod = 1;
      }
    }

    let aggregationMatch: any = { user: user._id, ...dateFilter };

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

    totals.dailyAverageHours =
      daysPeriod > 0 ? totals.totalTimeHours / daysPeriod : 0;

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
      updatedLogs: 0,
      errors: [] as string[],
    };

    for (const user of users) {
      try {
        if (user.stats) {
          user.stats.readingXp = 0;
          user.stats.listeningXp = 0;
          user.stats.userXp = 0;
        }

        const logs = await Log.find({ user: user._id });

        if (!logs.length) {
          continue;
        }

        for (const log of logs) {
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

          switch (log.type) {
            case 'anime':
              if (timeXp) {
                log.xp = timeXp;
              } else if (episodesXp) {
                log.xp = episodesXp;
              } else {
                log.xp = 0;
              }
              break;
            case 'vn':
            case 'video':
            case 'movie':
            case 'audio':
              log.xp = Math.max(timeXp, pagesXp, charsXp, episodesXp, 0);
              break;
            case 'reading':
            case 'manga':
              if (charsXp) {
                log.xp = Math.max(charsXp, timeXp, 0);
              } else if (pagesXp) {
                log.xp = Math.max(pagesXp, timeXp, 0);
              } else if (timeXp) {
                log.xp = timeXp;
              } else {
                log.xp = 0;
              }
              break;
            case 'other':
              log.xp = 0;
              break;
          }

          if (log.xp !== oldXp) {
            await log.save();
            results.updatedLogs++;
          }

          if (user.stats) {
            if (['anime', 'video', 'movie', 'audio'].includes(log.type)) {
              user.stats.listeningXp += log.xp;
            } else if (['reading', 'manga', 'vn'].includes(log.type)) {
              user.stats.readingXp += log.xp;
            }
            user.stats.userXp += log.xp;
          }
        }

        if (user.stats) {
          updateLevelAndXp(user.stats, 'reading');
          updateLevelAndXp(user.stats, 'listening');
          updateLevelAndXp(user.stats, 'user');

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

export async function recalculateStreaks(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  try {
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
        const logs = await Log.find({ user: user._id }).sort({ date: 1 });
        if (!logs.length || !user.stats) {
          continue;
        }

        let currentStreak = 0;
        let longestStreak = 0;
        let lastStreakDate: Date | null = null;

        for (const log of logs) {
          const logDate = new Date(
            log.date.getFullYear(),
            log.date.getMonth(),
            log.date.getDate()
          );

          if (!lastStreakDate) {
            currentStreak = 1;
          } else {
            const diffDays = Math.floor(
              (logDate.getTime() - lastStreakDate.getTime()) /
                (1000 * 60 * 60 * 24)
            );

            if (diffDays === 1) {
              currentStreak += 1;
            } else if (diffDays === 0) {
            } else {
              currentStreak = 1;
            }
          }

          if (currentStreak > longestStreak) {
            longestStreak = currentStreak;
          }

          lastStreakDate = logDate;
        }

        user.stats.currentStreak = currentStreak;
        user.stats.longestStreak = longestStreak;
        user.stats.lastStreakDate = lastStreakDate;
        await user.save();
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

export async function getMediaStats(
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

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisWeekStart = new Date(today);
    thisWeekStart.setDate(today.getDate() - today.getDay());
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

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

export async function getLogScreenStats(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const { user } = res.locals;
  const type = req.query.type as string;

  try {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisWeekStart = new Date(today);
    thisWeekStart.setDate(today.getDate() - today.getDay());
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

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

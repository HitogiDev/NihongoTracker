import { Request, Response, NextFunction } from 'express';
import axios from 'axios';
import { customError } from './errorMiddleware.js';
import {
  IUser,
  ILog,
  TMWLog,
  ManabeTSVLog,
  VNCRLog,
  OtherCSVLog,
  IManabeLogs,
} from '../types.js';
import { Types } from 'mongoose';
import User from '../models/user.model.js';
import Log from '../models/log.model.js';
import { MediaBase } from '../models/media.model.js';
import Tag from '../models/tag.model.js';
import { getYouTubeVideoInfo } from '../services/searchYoutube.js';

interface ILogManabeTypeMap {
  [key: string]: {
    logType: ILog['type'];
    parametro: string;
    tiempo?: boolean;
    chars?: boolean;
    officialId?: boolean;
  };
}

interface ManabeWebhookBody {
  userDiscordId: string;
  logInfo: IManabeLogs;
  token: string;
}

interface ILogNT {
  manabeId?: string;
  user: Types.ObjectId;
  description?: string;
  type: ILog['type'];
  episodes?: number;
  time?: number;
  chars?: number;
  pages?: number;
  mediaId?: string;
  date: Date;
  tagNames?: string[];
}

function transformManabeLogsList(
  list: IManabeLogs[],
  user: Omit<IUser, 'password'>
) {
  const logTypeMap: ILogManabeTypeMap = {
    ANIME: {
      logType: 'anime',
      parametro: 'episodes',
    },
    MANGA: {
      logType: 'manga',
      parametro: 'pages',
    },
    LECTURA: {
      logType: 'reading',
      parametro: 'chars',
    },
    TIEMPOLECTURA: {
      logType: 'reading',
      parametro: 'time',
    },
    LIBRO: { logType: 'reading', parametro: 'pages' },
    VN: { logType: 'vn', parametro: 'chars' },
    VIDEO: { logType: 'video', parametro: 'time' },
    AUDIO: { logType: 'audio', parametro: 'time' },
  };

  return list
    .filter((log) => logTypeMap.hasOwnProperty(log.medio))
    .map((log) => {
      const { logType, parametro } = logTypeMap[log.medio];

      const NTLogs: ILogNT = {
        user: user._id,
        description: log.descripcion,
        manabeId: log._id,
        type: logType,
        [parametro]: log.parametro,
        date: new Date(log.createdAt),
      };

      if (log.tiempo) {
        NTLogs.time = log.tiempo;
      }
      if (log.caracteres) {
        NTLogs.chars = log.caracteres;
      }
      if (log.officialId) {
        NTLogs.mediaId = log.officialId;
      }

      return NTLogs;
    });
}

export async function getLogsFromAPI(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const user: Omit<IUser, 'password'> = res.locals.user;
    if (!user) throw new customError('User not found', 404);
    if (!user.discordId) throw new customError('Discord ID not set', 400);
    const apiUrl = process.env.MANABE_API_URL;
    if (!apiUrl) {
      throw new customError('API URL not set', 500);
    }
    const response = await axios.get(apiUrl, {
      params: {
        user: user.discordId,
        limit: 0,
        page: 1,
      },
    });

    const rawLogs: IManabeLogs[] = response.data;

    const alreadyImportedLogs = await Log.find({
      user: user._id,
      manabeId: { $exists: true },
    }).select('manabeId');

    const newLogs = rawLogs.filter((log) => {
      return !alreadyImportedLogs.some(
        (importedLog) => importedLog.manabeId === log._id
      );
    });

    if (!user.firstImport) {
      for (const logInfo of newLogs) {
        if (logInfo.medio === 'VIDEO' && logInfo.descripcion) {
          try {
            const extractVideoId = (url: string): string | null => {
              const regex =
                /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([^&\n?#]+)/;
              const match = url.match(regex);
              return match ? match[1] : null;
            };
            const videoId = extractVideoId(logInfo.descripcion);
            if (videoId) {
              const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

              const ytResult = await getYouTubeVideoInfo(videoUrl);
              if (ytResult && ytResult.channel) {
                let channelMedia = await MediaBase.findOne({
                  contentId: ytResult.channel.contentId,
                  type: 'video',
                });
                if (!channelMedia) {
                  channelMedia = await MediaBase.create({
                    ...ytResult.channel,
                  });
                }
                logInfo.officialId = ytResult.channel.contentId;
              }
            }
          } catch (err) {
            console.warn('YouTube channel assign failed for sync log:', err);
          }
        }
      }
    }

    const NTLogs = transformManabeLogsList(newLogs, user);
    req.body.logs = NTLogs;
    return next();
  } catch (error) {
    return next(error as customError);
  }
}

export async function importManabeLog(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const { token, userDiscordId, logInfo } = req.body as ManabeWebhookBody;

  if (token !== process.env.MANABE_WEBHOOK_TOKEN) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  if (!userDiscordId || !logInfo) {
    return res.status(400).json({ message: 'Bad Request' });
  }

  const user = await User.findOne({ discordId: userDiscordId });

  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  if (logInfo.medio === 'VIDEO' && logInfo.descripcion) {
    try {
      const extractVideoId = (url: string): string | null => {
        const regex =
          /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([^&\n?#]+)/;
        const match = url.match(regex);
        return match ? match[1] : null;
      };
      const videoId = extractVideoId(logInfo.descripcion);
      if (videoId) {
        const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

        const ytResult = await getYouTubeVideoInfo(videoUrl);
        if (ytResult && ytResult.channel) {
          let channelMedia = await MediaBase.findOne({
            contentId: ytResult.channel.contentId,
            type: 'video',
          });
          if (!channelMedia) {
            channelMedia = await MediaBase.create({
              ...ytResult.channel,
            });
          }
          logInfo.officialId = ytResult.channel.contentId;
        }
      }
    } catch (err) {
      console.warn('YouTube channel assign failed:', err);
    }
  }

  res.locals.user = user;
  req.body.logs = transformManabeLogsList([logInfo], user);

  return next();
}

function transformTMWLogsList(
  list: TMWLog[],
  user: Omit<IUser, 'password'>
): ILogNT[] {
  const mediaTypeMap: { [key: string]: ILog['type'] } = {
    'Listening Time': 'audio',
    'Reading Time': 'reading',
    Book: 'reading',
    Anime: 'anime',
    Manga: 'manga',
    Reading: 'reading',
    VN: 'vn',
  };

  return list
    .filter((log) => mediaTypeMap.hasOwnProperty(log['Media Type']))
    .map((log) => {
      const type = mediaTypeMap[log['Media Type']];
      const amount = parseFloat(log['Amount Logged']) || 0;
      const mediaName = (log['Media Name'] || '').trim();
      const comment = (log['Comment'] || '').trim();
      const hasUsableComment =
        comment.length > 0 && comment.toLowerCase() !== 'no comment';

      const NTLog: ILogNT = {
        user: user._id,
        type: type,
        date: new Date(log['Log Date']),
        description: mediaName,
      };

      if (mediaName.toUpperCase() === 'N/A' && hasUsableComment) {
        NTLog.description = comment;
      }

      // Check if is a youtube video
      if (
        type === 'audio' &&
        log['Media Name'] &&
        /^https?:\/\/(www\.)?youtu(be\.com|\.be)\//.test(log['Media Name'])
      ) {
        NTLog.type = 'video';
      }

      if (type === 'audio') {
        NTLog.time = Math.round(amount);
      } else if (type === 'anime') {
        NTLog.episodes = Math.round(amount);
      } else if (type === 'manga') {
        NTLog.pages = Math.round(amount);
      } else if (type === 'reading') {
        // For "Book" type, use pages
        // For "Reading", use chars
        // For "Reading Time", use time
        if (log['Media Type'] === 'Book') {
          NTLog.pages = Math.round(amount);
        } else if (log['Media Type'] === 'Reading') {
          NTLog.chars = Math.round(amount);
        } else {
          NTLog.time = Math.round(amount);
        }
      } else if (type === 'vn') {
        NTLog.chars = Math.round(amount);
      }

      if (
        (['Anime', 'Manga', 'Listening Time'].includes(log['Media Type']) &&
          /^\d+$/.test(log['Media Name'])) ||
        (log['Media Type'] === 'Visual Novel' &&
          /^v\d+$/.test(log['Media Name']))
      ) {
        NTLog.mediaId = log['Media Name'];
      }

      if (
        hasUsableComment &&
        (/^v?\d+$/.test(log['Media Name']) ||
          /^https?:\/\/(www\.)?youtu(be\.com|\.be)\//.test(log['Comment']))
      ) {
        NTLog.description = comment;
      }

      return NTLog;
    });
}

function transformManabeTSVLogsList(
  list: ManabeTSVLog[],
  user: Omit<IUser, 'password'>
): ILogNT[] {
  const logTypeMap: ILogManabeTypeMap = {
    ANIME: {
      logType: 'anime',
      parametro: 'episodes',
    },
    MANGA: {
      logType: 'manga',
      parametro: 'pages',
    },
    LECTURA: {
      logType: 'reading',
      parametro: 'chars',
    },
    TIEMPOLECTURA: {
      logType: 'reading',
      parametro: 'time',
    },
    VN: { logType: 'vn', parametro: 'chars' },
    VIDEO: { logType: 'video', parametro: 'time' },
    AUDIO: { logType: 'audio', parametro: 'time' },
    OUTPUT: { logType: 'other', parametro: 'time' },
    JUEGO: { logType: 'other', parametro: 'time' },
    LIBRO: { logType: 'reading', parametro: 'pages' },
  };

  return list
    .filter((log) => logTypeMap.hasOwnProperty(log.Medio))
    .map((log) => {
      const { logType, parametro } = logTypeMap[log.Medio];
      const cantidad = parseFloat(log.Cantidad) || 0;

      const NTLog: ILogNT = {
        user: user._id,
        description: log.Descripción || 'No description',
        type: logType,
        [parametro]: cantidad,
        date: new Date(log.Fecha),
      };

      if (log.Tiempo) {
        const tiempo = parseFloat(log.Tiempo);
        if (!isNaN(tiempo) && tiempo > 0) {
          NTLog.time = tiempo;
        }
      }

      if (log.Caracteres) {
        const caracteres = parseFloat(log.Caracteres);
        if (!isNaN(caracteres) && caracteres > 0) {
          NTLog.chars = caracteres;
        }
      }

      return NTLog;
    });
}

// Transform VN Club Resurrection JSONL format logs
function transformVNCRLogsList(
  list: VNCRLog[],
  user: Omit<IUser, 'password'>
): ILogNT[] {
  const mediaTypeMap: { [key: string]: ILog['type'] } = {
    anime: 'anime',
    manga: 'manga',
    visual_novel: 'vn',
    book: 'reading',
  };

  return list
    .filter((log) => mediaTypeMap.hasOwnProperty(log.media_type))
    .map((log) => {
      const type = mediaTypeMap[log.media_type];
      // Convert seconds to minutes
      const timeInMinutes = Math.round(log.duration / 60);

      const NTLog: ILogNT = {
        user: user._id,
        type: type,
        date: new Date(log.date),
        description: log.name,
      };

      if (timeInMinutes > 0) {
        NTLog.time = timeInMinutes;
      }

      if (log.meta) {
        if (log.meta.characters) {
          NTLog.chars = log.meta.characters;
        }
        if (log.meta.pages) {
          NTLog.pages = log.meta.pages;
        }
        if (log.meta.episodes) {
          NTLog.episodes = log.meta.episodes;
        }

        if (log.meta.anilist_id) {
          NTLog.mediaId = log.meta.anilist_id.toString();
        } else if (log.meta.vn?.id) {
          NTLog.mediaId = log.meta.vn.id;
        }
      }

      return NTLog;
    });
}

// Transform "other" custom CSV format logs
function transformOtherCSVLogsList(
  list: OtherCSVLog[],
  user: Omit<IUser, 'password'>
): ILogNT[] {
  const validTypes: ILog['type'][] = [
    'reading',
    'anime',
    'vn',
    'video',
    'manga',
    'audio',
    'movie',
    'other',
    'tv show',
  ];

  return list
    .filter((log) => {
      const type = log.type?.toLowerCase().trim();
      return validTypes.includes(type as ILog['type']);
    })
    .map((log) => {
      const type = log.type.toLowerCase().trim() as ILog['type'];
      const rawMediaId = log.mediaId?.trim();
      let normalizedMediaId = rawMediaId || undefined;

      if (rawMediaId && type === 'vn') {
        normalizedMediaId = rawMediaId.toLowerCase().startsWith('v')
          ? `v${rawMediaId.slice(1)}`
          : `v${rawMediaId}`;
      }

      const NTLog: ILogNT = {
        user: user._id,
        type,
        date: new Date(log.date),
        description: log.description ?? '',
        mediaId: normalizedMediaId,
      };

      if (log.time) {
        const time = parseFloat(log.time);
        if (!isNaN(time) && time > 0) {
          NTLog.time = Math.round(time);
        }
      }

      if (log.characters) {
        const chars = parseFloat(log.characters);
        if (!isNaN(chars) && chars > 0) {
          NTLog.chars = Math.round(chars);
        }
      }

      if (log.episodes) {
        const episodes = parseFloat(log.episodes);
        if (!isNaN(episodes) && episodes > 0) {
          NTLog.episodes = Math.round(episodes);
        }
      }

      if (log.pages) {
        const pages = parseFloat(log.pages);
        if (!isNaN(pages) && pages > 0) {
          NTLog.pages = Math.round(pages);
        }
      }

      return NTLog;
    });
}

export async function getLogsFromCSV(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const importType = req.body.logImportType;
    let logs: ILogNT[];

    if (importType === 'tmw') {
      logs = transformTMWLogsList(req.body.logs, res.locals.user);
    } else if (importType === 'manabe') {
      logs = transformManabeTSVLogsList(req.body.logs, res.locals.user);
    } else if (importType === 'vncr') {
      logs = transformVNCRLogsList(req.body.logs, res.locals.user);
    } else if (importType === 'other') {
      logs = transformOtherCSVLogsList(req.body.logs, res.locals.user);

      // Resolve tag names to ObjectIds, creating tags that don't exist
      const allTagNames = new Set<string>();
      for (const log of logs) {
        if (log.tagNames) {
          for (const name of log.tagNames) {
            allTagNames.add(name);
          }
        }
      }

      if (allTagNames.size > 0) {
        const userId = res.locals.user._id;
        const existingTags = await Tag.find({
          user: userId,
          name: { $in: Array.from(allTagNames) },
        }).lean();

        const tagNameToId = new Map<string, Types.ObjectId>();
        for (const tag of existingTags) {
          tagNameToId.set(tag.name, tag._id);
        }

        // Create tags that don't exist yet
        const missingNames = Array.from(allTagNames).filter(
          (name) => !tagNameToId.has(name)
        );
        if (missingNames.length > 0) {
          const newTags = await Tag.insertMany(
            missingNames.map((name) => ({ user: userId, name })),
            { ordered: false }
          );
          for (const tag of newTags) {
            tagNameToId.set(tag.name, tag._id);
          }
        }

        // Assign tag ObjectIds to each log and remove tagNames
        for (const log of logs) {
          if (log.tagNames) {
            (log as any).tags = log.tagNames
              .map((name) => tagNameToId.get(name))
              .filter(Boolean);
            delete log.tagNames;
          }
        }
      }
    } else {
      throw new customError('Unsupported CSV type', 400);
    }

    if (!logs) throw new customError('No logs found', 404);
    req.body.logs = logs;
    return next();
  } catch (error) {
    return next(error as customError);
  }
}

import { Request, Response, NextFunction } from 'express';
import { ParamsDictionary } from 'express-serve-static-core';
import Log from '../models/log.model.js';
import { IImportLogs, ILog } from '../types.js';
import { customError } from './errorMiddleware.js';

export const XP_FACTOR_TIME = 5;
export const XP_FACTOR_PAGES = 1.23;
export const XP_FACTOR_CHARS = 5;
export const XP_FACTOR_EPISODES = XP_FACTOR_TIME * 24;

async function calculateXpForLog(log: ILog, req: Request): Promise<ILog> {
  let type = log.type || '';
  if (!type && req.params.id) {
    const foundLog = await Log.findById(req.params.id);
    if (!foundLog) {
      throw new customError('Log not found', 404);
    }
    type = foundLog.type;
  }

  if (!type) {
    throw new customError('Log type not found', 400);
  }

  const timeXp = log.time
    ? Math.floor(((log.time * 45) / 100) * XP_FACTOR_TIME)
    : 0;
  const charsXp = log.chars
    ? Math.floor((log.chars / 350) * XP_FACTOR_CHARS)
    : 0;
  const pagesXp = log.pages ? Math.floor(log.pages * XP_FACTOR_PAGES) : 0;
  const episodesXp = log.episodes
    ? Math.floor(((log.episodes * 45) / 100) * XP_FACTOR_EPISODES)
    : 0;

  switch (type) {
    case 'anime':
      if (timeXp) {
        log.xp = timeXp;
      } else if (episodesXp) {
        log.xp = episodesXp;
      }
      break;
    case 'reading':
    case 'manga':
    case 'vn':
    case 'video':
    case 'movie':
    case 'audio':
      log.xp = Math.max(timeXp, pagesXp, charsXp, episodesXp);
      break;
    case 'other':
      log.xp = 0;
      break;
    default:
      throw new customError('Invalid log type', 400);
  }
  return log;
}

function isImportLogs(body: any): body is IImportLogs {
  return body.logs && Array.isArray(body.logs);
}

export async function calculateXp(
  req: Request<ParamsDictionary, any, ILog | IImportLogs>,
  _res: Response,
  next: NextFunction
) {
  try {
    if (isImportLogs(req.body)) {
      const modifiedLogs = await Promise.all(
        req.body.logs.map((log) => calculateXpForLog(log, req))
      );
      req.body.logs = modifiedLogs;
    } else {
      const modifiedLog = await calculateXpForLog(req.body, req);
      req.body = modifiedLog;
    }
    return next();
  } catch (error) {
    return next(error as customError);
  }
}

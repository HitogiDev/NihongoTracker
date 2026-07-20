import { Request, Response, NextFunction } from 'express';
import { ParamsDictionary } from 'express-serve-static-core';
import Log from '../models/log.model.js';
import User from '../models/user.model.js';
import { MediaBase } from '../models/media.model.js';
import { IImportLogs, ILog, IUser } from '../types.js';
import { customError } from './errorMiddleware.js';
import {
  computeXp,
  continuousLevel,
  getLogCategory,
  getUserConsumedDifficulty,
  getUserReadingSpeedCph,
  normalizeJitenDifficulty,
  LogCategory,
} from '../services/xp.js';

function isImportLogs(body: any): body is IImportLogs {
  return body.logs && Array.isArray(body.logs);
}

/** Normalized (0-100) cached Jiten difficulties for a set of media ids. */
async function difficultiesByContentId(
  mediaIds: string[]
): Promise<Map<string, number | null>> {
  const result = new Map<string, number | null>();
  if (!mediaIds.length) return result;
  const medias = await MediaBase.find({ contentId: { $in: mediaIds } })
    .select('contentId jitenDifficulty')
    .lean();
  for (const media of medias) {
    result.set(
      media.contentId,
      normalizeJitenDifficulty(media.jitenDifficulty)
    );
  }
  return result;
}

/** Per-request cache of the consumed-difficulty signal, one per category. */
function makeConsumedDifficultyResolver(userId?: unknown) {
  const cache = new Map<string, Promise<number | null>>();
  return (category: LogCategory): Promise<number | null> => {
    if (!category || !userId) return Promise.resolve(null);
    if (!cache.has(category)) {
      cache.set(
        category,
        getUserConsumedDifficulty(String(userId), category).catch(() => null)
      );
    }
    return cache.get(category)!;
  };
}

/**
 * Per-request cache of the personal reading speed, one per log type (each
 * medium reads at its own pace; the helper falls back to the category-wide
 * median when the type has too little history).
 */
function makeSpeedResolver(userId?: unknown) {
  const cache = new Map<string, Promise<number | null>>();
  return (type: ILog['type']): Promise<number | null> => {
    if (!userId || getLogCategory(type) !== 'reading') {
      return Promise.resolve(null);
    }
    if (!cache.has(type)) {
      cache.set(
        type,
        getUserReadingSpeedCph(String(userId), type).catch(() => null)
      );
    }
    return cache.get(type)!;
  };
}

function categoryLevelFor(
  type: ILog['type'],
  user: IUser | undefined
): number {
  const category = getLogCategory(type);
  if (!category || !user?.stats) return 0;
  const categoryXp =
    category === 'reading' ? user.stats.readingXp : user.stats.listeningXp;
  return continuousLevel(categoryXp ?? 0);
}

export async function calculateXp(
  req: Request<ParamsDictionary, any, ILog | IImportLogs>,
  res: Response,
  next: NextFunction
) {
  try {
    const requester = res.locals.user as IUser | undefined;

    if (isImportLogs(req.body)) {
      const user = requester;
      const speedFor = makeSpeedResolver(user?._id);
      const difficulties = await difficultiesByContentId(
        Array.from(
          new Set(
            req.body.logs
              .map((log) => log.mediaId)
              .filter((id): id is string => Boolean(id))
          )
        )
      );
      const consumedFor = makeConsumedDifficultyResolver(user?._id);
      for (const log of req.body.logs) {
        if (!log.type) throw new customError('Log type not found', 400);
        const { xp, breakdown } = computeXp(
          {
            type: log.type,
            time: log.time,
            chars: log.chars,
            pages: log.pages,
            episodes: log.episodes,
          },
          {
            personalSpeedCph: await speedFor(log.type),
            difficulty: log.mediaId
              ? (difficulties.get(log.mediaId) ?? null)
              : null,
            categoryLevel: categoryLevelFor(log.type, user),
            consumedDifficulty: await consumedFor(getLogCategory(log.type)),
          }
        );
        log.xp = xp;
        log.xpBreakdown = breakdown;
      }
      return next();
    }

    const body = req.body as ILog;
    // On updates (PATCH /:id) fill quantities the client didn't resend from
    // the stored log, and reuse the category level snapshotted at creation so
    // editing old logs can't farm a different multiplier.
    const existing = req.params.id
      ? await Log.findById(req.params.id)
      : null;
    if (req.params.id && !existing) {
      throw new customError('Log not found', 404);
    }

    // Speed/level must come from the log owner — admin edits run this
    // middleware with the admin as res.locals.user.
    let owner = requester;
    if (
      existing &&
      (!requester || String(existing.user) !== String(requester._id))
    ) {
      owner = (await User.findById(existing.user)) ?? undefined;
    }

    const type = body.type || existing?.type;
    if (!type) throw new customError('Log type not found', 400);

    const personalSpeedCph = await makeSpeedResolver(owner?._id)(type);

    const mediaId = body.mediaId ?? existing?.mediaId;
    const difficulty = mediaId
      ? ((await difficultiesByContentId([mediaId])).get(mediaId) ?? null)
      : null;

    // Edits reuse the comfort snapshotted at creation; fresh logs compute it
    // from the owner's level + recently consumed difficulty.
    const storedComfort = existing?.xpBreakdown?.comfortAt ?? null;
    const consumedDifficulty =
      storedComfort === null
        ? await makeConsumedDifficultyResolver(owner?._id)(
            getLogCategory(type)
          )
        : null;

    const { xp, breakdown } = computeXp(
      {
        type,
        time: body.time ?? existing?.time,
        chars: body.chars ?? existing?.chars,
        pages: body.pages ?? existing?.pages,
        episodes: body.episodes ?? existing?.episodes,
      },
      {
        personalSpeedCph,
        difficulty,
        categoryLevel:
          existing?.xpBreakdown?.categoryLevelAt ??
          categoryLevelFor(type, owner),
        consumedDifficulty,
        comfortAt: storedComfort,
      }
    );

    body.xp = xp;
    body.xpBreakdown = breakdown;
    return next();
  } catch (error) {
    return next(error as customError);
  }
}

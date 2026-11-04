import { NextFunction, Request, Response } from 'express';
import { Types } from 'mongoose';
import Duel from '../models/duel.model.js';
import { apiError } from '../i18n/errorCodes.js';
import { customError } from '../middlewares/errorMiddleware.js';
import { findSocialUser } from '../services/follow.service.js';
import { requireGoalVisibility } from '../services/goalVisibility.js';
import {
  acceptDuel,
  cancelDuel,
  createDuel,
  declineDuel,
  getDuelStats,
  getHeadToHead,
  rematchDuel,
  serializeDuels,
} from '../services/duels.service.js';
import { DuelStatus, IDuel } from '../types.js';

const HISTORY_STATUSES: DuelStatus[] = [
  'completed',
  'declined',
  'cancelled',
  'expired',
];

function parseDuelId(value: unknown) {
  if (typeof value !== 'string' || !Types.ObjectId.isValid(value)) {
    throw apiError('duel.invalidId', 400, 'Invalid duel ID');
  }
  return new Types.ObjectId(value);
}

function parsePage(value: unknown, fallback: number, max: number) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

export async function createDuelHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const user = res.locals.user;
    const { opponentUsername, metric, target, mediaType, durationDays } =
      req.body as Record<string, unknown>;
    if (typeof opponentUsername !== 'string' || !opponentUsername.trim()) {
      throw apiError('duel.opponentRequired', 400, 'Choose an opponent');
    }
    const opponent = await findSocialUser(opponentUsername.trim());
    const duel = await createDuel(user, {
      opponentId: opponent._id,
      metric,
      target,
      mediaType,
      durationDays,
    });
    const [serialized] = await serializeDuels([duel]);
    return res.status(201).json(serialized);
  } catch (error) {
    return next(error as customError);
  }
}

export async function listDuels(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = res.locals.user._id as Types.ObjectId;
    const group = String(req.query.status ?? 'active');
    const statusesByGroup: Record<string, DuelStatus[]> = {
      history: HISTORY_STATUSES,
      pending: ['pending'],
    };
    const statuses = statusesByGroup[group] ?? ['active'];
    const page = parsePage(req.query.page, 1, 1000);
    const limit = parsePage(req.query.limit, 20, 50);

    const duels = await Duel.find({
      status: { $in: statuses },
      $or: [{ challenger: userId }, { opponent: userId }],
    })
      .sort(
        group === 'history'
          ? { finishedAt: -1, _id: -1 }
          : { createdAt: -1, _id: -1 }
      )
      .skip((page - 1) * limit)
      .limit(limit + 1);

    const hasMore = duels.length > limit;
    return res.status(200).json({
      duels: await serializeDuels(duels.slice(0, limit)),
      page,
      hasMore,
    });
  } catch (error) {
    return next(error as customError);
  }
}

export async function getDuelCounts(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = res.locals.user._id as Types.ObjectId;
    const [active, incoming, outgoing] = await Promise.all([
      Duel.countDocuments({
        status: 'active',
        $or: [{ challenger: userId }, { opponent: userId }],
      }),
      Duel.countDocuments({ status: 'pending', opponent: userId }),
      Duel.countDocuments({ status: 'pending', challenger: userId }),
    ]);
    return res.status(200).json({ active, incoming, outgoing });
  } catch (error) {
    return next(error as customError);
  }
}

export async function getDuel(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = res.locals.user._id as Types.ObjectId;
    const duel = await Duel.findById(parseDuelId(req.params.duelId));
    if (
      !duel ||
      !(duel.challenger.equals(userId) || duel.opponent.equals(userId))
    ) {
      throw apiError('duel.notFound', 404, 'Duel not found');
    }
    const [serialized] = await serializeDuels([duel]);
    return res.status(200).json(serialized);
  } catch (error) {
    return next(error as customError);
  }
}

type DuelActor = { _id: Types.ObjectId; username: string; avatar?: string };

function respondWithDuel(
  action: (duelId: Types.ObjectId, user: DuelActor) => Promise<IDuel>,
  status = 200
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const duelId = parseDuelId(req.params.duelId);
      const duel = await action(duelId, res.locals.user);
      const [serialized] = await serializeDuels([duel]);
      return res.status(status).json(serialized);
    } catch (error) {
      return next(error as customError);
    }
  };
}

export const acceptDuelHandler = respondWithDuel((duelId, user) =>
  acceptDuel(duelId, user._id)
);
export const declineDuelHandler = respondWithDuel((duelId, user) =>
  declineDuel(duelId, user._id)
);
export const cancelDuelHandler = respondWithDuel((duelId, user) =>
  cancelDuel(duelId, user._id)
);
export const rematchDuelHandler = respondWithDuel(
  (duelId, user) => rematchDuel(duelId, user),
  201
);

export async function getHeadToHeadHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const viewer = res.locals.user;
    const other = await findSocialUser(req.params.username);
    const record = await getHeadToHead(viewer._id, other._id);
    return res.status(200).json(record);
  } catch (error) {
    return next(error as customError);
  }
}

export async function getDuelStatsHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const viewer = res.locals.user;
    const owner = await findSocialUser(req.params.username);
    await requireGoalVisibility(owner, viewer);
    return res.status(200).json(await getDuelStats(owner._id));
  } catch (error) {
    return next(error as customError);
  }
}

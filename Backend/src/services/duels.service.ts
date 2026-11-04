import { Types } from 'mongoose';
import Duel from '../models/duel.model.js';
import Log from '../models/log.model.js';
import User from '../models/user.model.js';
import { apiError } from '../i18n/errorCodes.js';
import {
  DUEL_METRICS,
  DuelMetric,
  IDuel,
  ILog,
} from '../types.js';
import { createActivity } from './activity.service.js';
import { checkAchievements } from './achievements/achievementEngine.js';
import { aggregateVisibleLogMetricByUser } from './clubLogMetrics.service.js';
import { isValidGoalMediaType } from './goalMediaType.js';
import {
  createNotification,
  removeNotifications,
} from './notifications.service.js';

const DAY_MS = 24 * 60 * 60 * 1000;
export const DUEL_PENDING_HOURS = 72;
export const MAX_OPEN_DUELS_PER_USER = 10;
export const MAX_OPEN_DUELS_PER_PAIR = 3;
export const MAX_DUEL_DURATION_DAYS = 90;

type UserSummary = { _id: Types.ObjectId; username: string; avatar?: string };

export interface DuelInput {
  opponentId: Types.ObjectId;
  metric: unknown;
  target: unknown;
  mediaType?: unknown;
  durationDays: unknown;
}

export interface DuelProgress {
  challenger: number;
  opponent: number;
}

export interface SerializedDuel {
  _id: string;
  challenger: UserSummary;
  opponent: UserSummary;
  metric: DuelMetric;
  target: number;
  mediaType: string | null;
  durationDays: number;
  status: IDuel['status'];
  startDate?: Date;
  endDate?: Date;
  acceptedAt?: Date;
  finishedAt?: Date;
  expiresAt: Date;
  winner: string | null;
  isDraw: boolean;
  rematchOf: string | null;
  createdAt: Date;
  progress: DuelProgress;
}

function parseDuelInput(input: DuelInput) {
  if (!DUEL_METRICS.includes(input.metric as DuelMetric)) {
    throw apiError('duel.invalidMetric', 400, 'Invalid duel metric');
  }
  const target = Number(input.target);
  if (!Number.isFinite(target) || target <= 0 || target > 1_000_000) {
    throw apiError('duel.invalidTarget', 400, 'Duel target must be positive');
  }
  const durationDays = Number(input.durationDays);
  if (
    !Number.isInteger(durationDays) ||
    durationDays < 1 ||
    durationDays > MAX_DUEL_DURATION_DAYS
  ) {
    throw apiError(
      'duel.invalidDuration',
      400,
      `Duel duration must be between 1 and ${MAX_DUEL_DURATION_DAYS} days`,
      { max: MAX_DUEL_DURATION_DAYS }
    );
  }
  const mediaType =
    input.mediaType === undefined ||
    input.mediaType === null ||
    input.mediaType === ''
      ? null
      : input.mediaType;
  if (mediaType !== null && !isValidGoalMediaType(mediaType)) {
    throw apiError('duel.invalidMediaType', 400, 'Invalid duel media type');
  }
  return {
    metric: input.metric as DuelMetric,
    target,
    durationDays,
    mediaType: mediaType as string | null,
  };
}

async function loadUsers(ids: Types.ObjectId[]) {
  const users = await User.find({ _id: { $in: ids } })
    .select('username avatar')
    .lean();
  return new Map(users.map((user) => [String(user._id), user]));
}

function userSummary(
  users: Map<string, { _id: Types.ObjectId; username: string; avatar?: string }>,
  id: Types.ObjectId
): UserSummary {
  const user = users.get(String(id));
  return {
    _id: id,
    username: user?.username ?? 'unknown',
    avatar: user?.avatar,
  };
}

async function countOpenDuels(filter: Record<string, unknown>) {
  return Duel.countDocuments({
    ...filter,
    status: { $in: ['pending', 'active'] },
  });
}

async function assertCanOpenDuel(
  challengerId: Types.ObjectId,
  opponentId: Types.ObjectId
) {
  const [mine, theirs, pair] = await Promise.all([
    countOpenDuels({ $or: [{ challenger: challengerId }, { opponent: challengerId }] }),
    countOpenDuels({ $or: [{ challenger: opponentId }, { opponent: opponentId }] }),
    countOpenDuels({
      $or: [
        { challenger: challengerId, opponent: opponentId },
        { challenger: opponentId, opponent: challengerId },
      ],
    }),
  ]);
  if (
    mine >= MAX_OPEN_DUELS_PER_USER ||
    theirs >= MAX_OPEN_DUELS_PER_USER ||
    pair >= MAX_OPEN_DUELS_PER_PAIR
  ) {
    throw apiError('duel.tooMany', 409, 'Too many open duels', {
      max: MAX_OPEN_DUELS_PER_USER,
    });
  }
}

export async function createDuel(
  challenger: { _id: Types.ObjectId; username: string; avatar?: string },
  input: DuelInput,
  rematchOf: Types.ObjectId | null = null
) {
  if (challenger._id.equals(input.opponentId)) {
    throw apiError('duel.self', 400, 'You cannot duel yourself');
  }
  const parsed = parseDuelInput(input);
  const opponent = await User.findById(input.opponentId)
    .select('username avatar moderation')
    .lean();
  if (!opponent || opponent.moderation?.banned) {
    throw apiError('user.notFound', 404, 'User not found');
  }
  await assertCanOpenDuel(challenger._id, opponent._id);

  const duel = await Duel.create({
    challenger: challenger._id,
    opponent: opponent._id,
    ...parsed,
    status: 'pending',
    rematchOf,
    expiresAt: new Date(Date.now() + DUEL_PENDING_HOURS * 60 * 60 * 1000),
  });

  await createNotification({
    recipient: opponent._id,
    actor: challenger._id,
    type: 'duel_challenge',
    title: `${challenger.username} challenged you to a duel`,
    titleKey: 'duel.challenged',
    link: '/duels',
    entityType: 'duel',
    entityId: duel._id.toString(),
    groupKey: `duel:${duel._id.toString()}`,
    meta: { username: challenger.username, avatar: challenger.avatar ?? '' },
  });
  return duel;
}

export async function acceptDuel(duelId: Types.ObjectId, userId: Types.ObjectId) {
  const duel = await Duel.findById(duelId);
  if (!duel) throw apiError('duel.notFound', 404, 'Duel not found');
  if (!duel.opponent.equals(userId)) {
    throw apiError('duel.notOpponent', 403, 'Only the challenged user can respond');
  }
  if (duel.status !== 'pending') {
    throw apiError('duel.notPending', 409, 'This duel is no longer pending');
  }
  const now = new Date();
  if (duel.expiresAt <= now) {
    await Duel.updateOne(
      { _id: duel._id, status: 'pending' },
      { $set: { status: 'expired', finishedAt: now } }
    );
    throw apiError('duel.expired', 410, 'This challenge has expired');
  }
  await assertCanAcceptDuel(duel);
  const updated = await Duel.findOneAndUpdate(
    { _id: duel._id, status: 'pending' },
    {
      $set: {
        status: 'active',
        acceptedAt: now,
        startDate: now,
        endDate: new Date(now.getTime() + duel.durationDays * DAY_MS),
      },
    },
    { new: true }
  );
  if (!updated) {
    throw apiError('duel.notPending', 409, 'This duel is no longer pending');
  }
  const users = await loadUsers([duel.opponent]);
  const opponent = userSummary(users, duel.opponent);
  await removeNotifications({
    recipient: duel.opponent,
    type: 'duel_challenge',
    entityType: 'duel',
    entityId: duel._id.toString(),
  });
  await createNotification({
    recipient: duel.challenger,
    actor: duel.opponent,
    type: 'duel_accepted',
    title: `${opponent.username} accepted your duel`,
    titleKey: 'duel.accepted',
    link: '/duels',
    entityType: 'duel',
    entityId: duel._id.toString(),
    meta: { username: opponent.username, avatar: opponent.avatar ?? '' },
  });
  return updated;
}

async function assertCanAcceptDuel(duel: IDuel) {
  const [mine, theirs] = await Promise.all([
    countOpenDuels({ $or: [{ challenger: duel.opponent }, { opponent: duel.opponent }], status: 'active' }),
    countOpenDuels({ $or: [{ challenger: duel.challenger }, { opponent: duel.challenger }], status: 'active' }),
  ]);
  if (mine >= MAX_OPEN_DUELS_PER_USER || theirs >= MAX_OPEN_DUELS_PER_USER) {
    throw apiError('duel.tooMany', 409, 'Too many open duels', {
      max: MAX_OPEN_DUELS_PER_USER,
    });
  }
}

export async function declineDuel(duelId: Types.ObjectId, userId: Types.ObjectId) {
  const duel = await Duel.findById(duelId);
  if (!duel) throw apiError('duel.notFound', 404, 'Duel not found');
  if (!duel.opponent.equals(userId)) {
    throw apiError('duel.notOpponent', 403, 'Only the challenged user can respond');
  }
  const updated = await Duel.findOneAndUpdate(
    { _id: duel._id, status: 'pending' },
    { $set: { status: 'declined', finishedAt: new Date() } },
    { new: true }
  );
  if (!updated) {
    throw apiError('duel.notPending', 409, 'This duel is no longer pending');
  }
  const users = await loadUsers([duel.opponent]);
  const opponent = userSummary(users, duel.opponent);
  await removeNotifications({
    recipient: duel.opponent,
    type: 'duel_challenge',
    entityType: 'duel',
    entityId: duel._id.toString(),
  });
  await createNotification({
    recipient: duel.challenger,
    actor: duel.opponent,
    type: 'duel_declined',
    title: `${opponent.username} declined your duel`,
    titleKey: 'duel.declined',
    link: '/duels',
    entityType: 'duel',
    entityId: duel._id.toString(),
    meta: { username: opponent.username, avatar: opponent.avatar ?? '' },
  });
  return updated;
}

export async function cancelDuel(duelId: Types.ObjectId, userId: Types.ObjectId) {
  const duel = await Duel.findById(duelId);
  if (!duel) throw apiError('duel.notFound', 404, 'Duel not found');
  if (!duel.challenger.equals(userId)) {
    throw apiError('duel.notChallenger', 403, 'Only the challenger can cancel');
  }
  const updated = await Duel.findOneAndUpdate(
    { _id: duel._id, status: 'pending' },
    { $set: { status: 'cancelled', finishedAt: new Date() } },
    { new: true }
  );
  if (!updated) {
    throw apiError('duel.notPending', 409, 'This duel is no longer pending');
  }
  await removeNotifications({
    recipient: duel.opponent,
    type: 'duel_challenge',
    entityType: 'duel',
    entityId: duel._id.toString(),
  });
  return updated;
}

export async function rematchDuel(
  duelId: Types.ObjectId,
  user: { _id: Types.ObjectId; username: string; avatar?: string }
) {
  const previous = await Duel.findById(duelId);
  if (!previous) throw apiError('duel.notFound', 404, 'Duel not found');
  const isChallenger = previous.challenger.equals(user._id);
  if (!isChallenger && !previous.opponent.equals(user._id)) {
    throw apiError('duel.notParticipant', 403, 'You are not part of this duel');
  }
  if (previous.status !== 'completed') {
    throw apiError('duel.notFinished', 409, 'Only finished duels can be replayed');
  }
  return createDuel(
    user,
    {
      opponentId: isChallenger ? previous.opponent : previous.challenger,
      metric: previous.metric,
      target: previous.target,
      mediaType: previous.mediaType,
      durationDays: previous.durationDays,
    },
    previous._id
  );
}

function logMetricValue(
  log: Pick<ILog, 'type' | 'time' | 'episodes' | 'chars' | 'pages'>,
  metric: DuelMetric
) {
  if (metric === 'chars') return log.chars ?? 0;
  if (metric === 'pages') return log.pages ?? 0;
  if (metric === 'episodes') return log.episodes ?? 0;
  if (
    (log.type === 'anime' || log.type === 'tv show') &&
    !log.time &&
    (log.episodes ?? 0) > 0
  ) {
    return (log.episodes ?? 0) * 24;
  }
  return log.time ?? 0;
}

async function getUserProgress(duel: IDuel, userId: Types.ObjectId) {
  if (!duel.startDate || !duel.endDate) return 0;
  const rows = await aggregateVisibleLogMetricByUser({
    ownerIds: [userId],
    viewerId: userId,
    metric: duel.metric,
    startDate: duel.startDate,
    endDate: duel.endDate,
    mediaType: duel.mediaType ?? undefined,
  });
  return rows[0]?.value ?? 0;
}

export async function getDuelProgress(duel: IDuel): Promise<DuelProgress> {
  const [challenger, opponent] = await Promise.all([
    getUserProgress(duel, duel.challenger),
    getUserProgress(duel, duel.opponent),
  ]);
  return { challenger, opponent };
}

/** Returns the instant at which the user's logs first reached the target. */
async function getCrossingTime(duel: IDuel, userId: Types.ObjectId) {
  const logs = await Log.find({
    user: userId,
    unknownDate: { $ne: true },
    date: { $gte: duel.startDate, $lte: duel.endDate },
    ...(duel.mediaType ? { type: duel.mediaType } : {}),
  })
    .sort({ date: 1 })
    .select('date type time episodes chars pages')
    .lean();
  let total = 0;
  for (const log of logs) {
    total += logMetricValue(log, duel.metric);
    if (total >= duel.target) return new Date(log.date).getTime();
  }
  return Number.POSITIVE_INFINITY;
}

interface DuelOutcome {
  winner: Types.ObjectId | null;
  isDraw: boolean;
}

/**
 * Decides a duel from current progress. While the duel runs, it returns null
 * until someone reaches the target. At expiry, the higher progress wins.
 */
async function resolveDuel(
  duel: IDuel,
  expired: boolean
): Promise<DuelOutcome | null> {
  const progress = await getDuelProgress(duel);
  const challengerReached = progress.challenger >= duel.target;
  const opponentReached = progress.opponent >= duel.target;

  if (challengerReached && opponentReached) {
    const [challengerTime, opponentTime] = await Promise.all([
      getCrossingTime(duel, duel.challenger),
      getCrossingTime(duel, duel.opponent),
    ]);
    if (challengerTime === opponentTime) return { winner: null, isDraw: true };
    return {
      winner: challengerTime < opponentTime ? duel.challenger : duel.opponent,
      isDraw: false,
    };
  }
  if (challengerReached) return { winner: duel.challenger, isDraw: false };
  if (opponentReached) return { winner: duel.opponent, isDraw: false };
  if (!expired) return null;
  if (progress.challenger === progress.opponent) {
    return { winner: null, isDraw: true };
  }
  return {
    winner:
      progress.challenger > progress.opponent
        ? duel.challenger
        : duel.opponent,
    isDraw: false,
  };
}

async function finishDuel(duel: IDuel, outcome: DuelOutcome) {
  const updated = await Duel.findOneAndUpdate(
    { _id: duel._id, status: 'active' },
    {
      $set: {
        status: 'completed',
        winner: outcome.winner,
        isDraw: outcome.isDraw,
        finishedAt: new Date(),
      },
    },
    { new: true }
  );
  if (!updated) return null;

  const users = await loadUsers([duel.challenger, duel.opponent]);
  const duelId = duel._id.toString();
  const participants = [duel.challenger, duel.opponent];

  for (const recipient of participants) {
    const other = recipient.equals(duel.challenger)
      ? userSummary(users, duel.opponent)
      : userSummary(users, duel.challenger);
    let type: 'duel_draw' | 'duel_won' | 'duel_lost' = 'duel_lost';
    if (outcome.isDraw) type = 'duel_draw';
    else if (outcome.winner?.equals(recipient)) type = 'duel_won';
    const key = {
      duel_draw: 'drew',
      duel_won: 'won',
      duel_lost: 'lost',
    }[type];
    const title = {
      duel_draw: `Your duel with ${other.username} ended in a draw`,
      duel_won: `You won your duel against ${other.username}`,
      duel_lost: `You lost your duel against ${other.username}`,
    }[type];
    await createNotification({
      recipient,
      actor: other._id,
      type,
      title,
      titleKey: `duel.${key}`,
      link: '/duels',
      entityType: 'duel',
      entityId: duelId,
      meta: { username: other.username, avatar: other.avatar ?? '' },
    });
  }

  if (outcome.winner) {
    const loserId = outcome.winner.equals(duel.challenger)
      ? duel.opponent
      : duel.challenger;
    await createActivity({
      actor: outcome.winner,
      type: 'duel_won',
      targetType: 'duel',
      targetId: duel._id,
      metadata: {
        metric: duel.metric,
        goal: duel.target,
        logType: duel.mediaType ?? undefined,
        opponentUsername: userSummary(users, loserId).username,
      },
      importance: 'important',
      dedupeKey: `duelWon:${duelId}`,
    });
    try {
      await checkAchievements(outcome.winner, { trigger: 'duelComplete' });
    } catch (error) {
      console.error('Duel achievement check failed:', error);
    }
  }
  return updated;
}

/** Best-effort check after a user's logs change. Never throws. */
export async function evaluateDuelsForUser(userId: Types.ObjectId) {
  try {
    const duels = await Duel.find({
      status: 'active',
      endDate: { $gt: new Date() },
      $or: [{ challenger: userId }, { opponent: userId }],
    });
    for (const duel of duels) {
      const outcome = await resolveDuel(duel, false);
      if (outcome) await finishDuel(duel, outcome);
    }
  } catch (error) {
    console.error('Duel evaluation failed:', error);
  }
}

export async function finalizeExpiredDuels() {
  const now = new Date();
  const expiredPending = await Duel.find({
    status: 'pending',
    expiresAt: { $lte: now },
  }).select('_id challenger opponent');
  if (expiredPending.length > 0) {
    await Duel.updateMany(
      { _id: { $in: expiredPending.map((duel) => duel._id) }, status: 'pending' },
      { $set: { status: 'expired', finishedAt: now } }
    );
    for (const duel of expiredPending) {
      await removeNotifications({
        recipient: duel.opponent,
        type: 'duel_challenge',
        entityType: 'duel',
        entityId: duel._id.toString(),
      });
    }
  }

  const overdue = await Duel.find({ status: 'active', endDate: { $lte: now } });
  let finished = 0;
  for (const duel of overdue) {
    try {
      const outcome = await resolveDuel(duel, true);
      if (outcome && (await finishDuel(duel, outcome))) finished += 1;
    } catch (error) {
      console.error(`Duel ${duel._id.toString()} failed to finalize:`, error);
    }
  }
  return { expired: expiredPending.length, finished };
}

export async function serializeDuels(
  duels: IDuel[]
): Promise<SerializedDuel[]> {
  const ids = duels.flatMap((duel) => [duel.challenger, duel.opponent]);
  const users = await loadUsers(ids);
  return Promise.all(
    duels.map(async (duel) => ({
      _id: duel._id.toString(),
      challenger: userSummary(users, duel.challenger),
      opponent: userSummary(users, duel.opponent),
      metric: duel.metric,
      target: duel.target,
      mediaType: duel.mediaType ?? null,
      durationDays: duel.durationDays,
      status: duel.status,
      startDate: duel.startDate,
      endDate: duel.endDate,
      acceptedAt: duel.acceptedAt,
      finishedAt: duel.finishedAt,
      expiresAt: duel.expiresAt,
      winner: duel.winner ? duel.winner.toString() : null,
      isDraw: duel.isDraw,
      rematchOf: duel.rematchOf ? duel.rematchOf.toString() : null,
      createdAt: duel.createdAt,
      progress:
        duel.status === 'active' || duel.status === 'completed'
          ? await getDuelProgress(duel)
          : { challenger: 0, opponent: 0 },
    }))
  );
}

export interface DuelRecord {
  wins: number;
  losses: number;
  draws: number;
  total: number;
}

function emptyRecord(): DuelRecord {
  return { wins: 0, losses: 0, draws: 0, total: 0 };
}

function addResult(
  record: DuelRecord,
  duel: Pick<IDuel, 'winner' | 'isDraw'>,
  userId: Types.ObjectId
) {
  record.total += 1;
  if (duel.isDraw || !duel.winner) record.draws += 1;
  else if (duel.winner.equals(userId)) record.wins += 1;
  else record.losses += 1;
}

export async function getHeadToHead(
  viewerId: Types.ObjectId,
  otherId: Types.ObjectId
): Promise<DuelRecord> {
  const duels = await Duel.find({
    status: 'completed',
    $or: [
      { challenger: viewerId, opponent: otherId },
      { challenger: otherId, opponent: viewerId },
    ],
  })
    .select('winner isDraw')
    .lean();
  const record = emptyRecord();
  for (const duel of duels) {
    addResult(record, duel as Pick<IDuel, 'winner' | 'isDraw'>, viewerId);
  }
  return record;
}

export async function getDuelStats(userId: Types.ObjectId) {
  const [duels, open] = await Promise.all([
    Duel.find({
      status: 'completed',
      $or: [{ challenger: userId }, { opponent: userId }],
    })
      .sort({ finishedAt: 1 })
      .select('challenger opponent winner isDraw metric mediaType finishedAt')
      .limit(2000)
      .lean(),
    countOpenDuels({ $or: [{ challenger: userId }, { opponent: userId }] }),
  ]);

  const record = emptyRecord();
  const rivals = new Map<string, DuelRecord>();
  let currentStreak = 0;
  let bestStreak = 0;

  for (const duel of duels) {
    const typed = duel as unknown as Pick<
      IDuel,
      'challenger' | 'opponent' | 'winner' | 'isDraw'
    >;
    addResult(record, typed, userId);
    const rivalId = String(
      typed.challenger.equals(userId) ? typed.opponent : typed.challenger
    );
    const rivalRecord = rivals.get(rivalId) ?? emptyRecord();
    addResult(rivalRecord, typed, userId);
    rivals.set(rivalId, rivalRecord);

    if (!typed.isDraw && typed.winner?.equals(userId)) {
      currentStreak += 1;
      bestStreak = Math.max(bestStreak, currentStreak);
    } else {
      currentStreak = 0;
    }
  }

  const rivalIds = [...rivals.keys()].map((id) => new Types.ObjectId(id));
  const users = await loadUsers(rivalIds);
  const rivalList = [...rivals.entries()]
    .map(([id, rivalRecord]) => ({
      user: userSummary(users, new Types.ObjectId(id)),
      ...rivalRecord,
    }))
    .sort((a, b) => b.total - a.total || b.wins - a.wins);

  const bestRival = rivalList
    .filter((rival) => rival.wins > 0)
    .sort((a, b) => b.wins - a.wins || b.total - a.total)[0];

  return {
    ...record,
    winRate: record.total > 0 ? record.wins / record.total : 0,
    currentStreak,
    bestStreak,
    openDuels: open,
    rivals: rivalList.slice(0, 20),
    bestRival: bestRival ?? null,
    mostFrequentRival: rivalList[0] ?? null,
  };
}

import { Types } from 'mongoose';
import Log from '../models/log.model.js';
import User from '../models/user.model.js';
import { ILog, IUser } from '../types.js';
import { apiError } from '../i18n/errorCodes.js';
import { calculateEditedLogXp } from '../middlewares/calculateXp.js';
import { recalculateUserXpFromLogs } from './updateStats.js';
import { recalculateStreaksForUser } from './streaks.js';
import { evaluateAutoCompleteForUserMedia } from './autoComplete.js';

const editableFields = [
  'description', 'type', 'date', 'time', 'episodes', 'volume',
  'pages', 'chars', 'tags',
] as const;

const logTypes: ReadonlySet<string> = new Set([
  'light-novel', 'reading', 'anime', 'vn', 'video', 'manga',
  'audio', 'movie', 'tv show', 'other', 'game', 'book',
]);

type BulkEditField = (typeof editableFields)[number];
type BulkEditPatch = Partial<Pick<ILog, BulkEditField>>;

function parseUpdates(value: unknown): BulkEditPatch {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw apiError('common.validationError', 400, 'updates must be an object');
  }
  const raw = value as Record<string, unknown>;
  const keys = Object.keys(raw);
  if (!keys.length || keys.some((key) => !editableFields.includes(key as BulkEditField))) {
    throw apiError('common.validationError', 400, 'Invalid bulk edit fields');
  }

  const patch: BulkEditPatch = {};
  if ('description' in raw) {
    if (typeof raw.description !== 'string' || !raw.description.trim()) {
      throw apiError('common.validationError', 400, 'Description must not be empty');
    }
    patch.description = raw.description;
  }
  if ('type' in raw) {
    if (typeof raw.type !== 'string' || !logTypes.has(raw.type)) {
      throw apiError('common.validationError', 400, 'Invalid log type');
    }
    patch.type = raw.type as ILog['type'];
  }
  if ('date' in raw) {
    if (typeof raw.date !== 'string' || !Number.isFinite(Date.parse(raw.date))) {
      throw apiError('common.validationError', 400, 'Invalid date');
    }
    patch.date = new Date(raw.date);
  }
  const limits = {
    time: 1440,
    episodes: 1000,
    volume: 10000,
    pages: 10000,
    chars: 1000000,
  } as const;
  for (const field of Object.keys(limits) as Array<keyof typeof limits>) {
    if (!(field in raw)) continue;
    const number = raw[field];
    const minimum = field === 'volume' ? 1 : 0;
    if (typeof number !== 'number' || !Number.isInteger(number) ||
      number < minimum || number > limits[field]) {
      throw apiError('common.validationError', 400, `Invalid ${field}`);
    }
    patch[field] = number;
  }
  if ('tags' in raw) {
    if (!Array.isArray(raw.tags) ||
      raw.tags.some((tag) => typeof tag !== 'string' || !Types.ObjectId.isValid(tag))) {
      throw apiError('common.validationError', 400, 'Invalid tags');
    }
    patch.tags = raw.tags.map((tag: string) => new Types.ObjectId(tag));
  }
  return patch;
}

/** Prevalidate the whole selection before writing any log. */
export async function bulkEditLogs(
  idsValue: unknown,
  updatesValue: unknown,
  ownerId?: Types.ObjectId | string
): Promise<number> {
  if (!Array.isArray(idsValue) || !idsValue.length ||
    idsValue.some((id) => typeof id !== 'string' || !Types.ObjectId.isValid(id))) {
    throw apiError('log.idsRequired', 400, 'ids must be a non-empty array of log IDs');
  }
  const ids = [...new Set(idsValue as string[])];
  const patch = parseUpdates(updatesValue);
  const logs = await Log.find({
    _id: { $in: ids },
    ...(ownerId ? { user: ownerId } : {}),
  });
  if (logs.length !== ids.length) {
    throw apiError('log.noneFoundOrForbidden', 404, 'Some logs were not found or are not authorized');
  }

  const owners = new Map<string, IUser>();
  const datesChanged = new Set<string>();
  for (const log of logs) {
    const key = String(log.user);
    let owner = owners.get(key);
    if (!owner) {
      owner = (await User.findById(log.user)) ?? undefined;
      if (!owner) throw apiError('user.notFound', 404, 'User not found');
      owners.set(key, owner);
    }
    if ('date' in patch && log.date.toISOString() !== patch.date?.toISOString()) {
      datesChanged.add(key);
    }
    const calculated = await calculateEditedLogXp(log, patch, owner);
    log.set({ ...patch, ...calculated });
    await log.validate();
  }

  for (const log of logs) await log.save();
  for (const key of owners.keys()) {
    await recalculateUserXpFromLogs(key);
    if (datesChanged.has(key)) await recalculateStreaksForUser(new Types.ObjectId(key));
  }
  const media = new Set<string>();
  for (const log of logs) {
    if (!log.mediaId) continue;
    const key = `${log.user}:${log.mediaId}:${log.type}`;
    if (media.has(key)) continue;
    media.add(key);
    try {
      await evaluateAutoCompleteForUserMedia(log.user, log.mediaId, log.type);
    } catch (error) {
      console.error('auto-complete evaluation failed after bulk edit', error);
    }
  }
  return logs.length;
}

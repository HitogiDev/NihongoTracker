import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import MediaList from '../models/mediaList.model.js';
import MediaListComment from '../models/mediaListComment.model.js';
import { MediaBase } from '../models/media.model.js';
import User from '../models/user.model.js';
import { customError } from '../middlewares/errorMiddleware.js';
import { IMediaList, IMediaListEntry, MediaListMediaType } from '../types.js';

const MEDIA_TYPES: MediaListMediaType[] = [
  'anime',
  'manga',
  'reading',
  'vn',
  'video',
  'movie',
  'tv show',
  'game',
];

const TITLE_MAX_LENGTH = 100;
const DESCRIPTION_MAX_LENGTH = 2000;
const NOTE_MAX_LENGTH = 500;
const COMMENT_MAX_LENGTH = 2000;
const MAX_ENTRIES = 500;

function isMediaType(value: unknown): value is MediaListMediaType {
  return (
    typeof value === 'string' &&
    MEDIA_TYPES.includes(value as MediaListMediaType)
  );
}

/**
 * Fetches the media documents referenced by a list's entries and returns them
 * in the entries' own order, keeping notes/order alongside each media doc.
 */
async function hydrateEntries(entries: IMediaListEntry[]) {
  if (!entries.length) return [];

  const mediaIds = [...new Set(entries.map((entry) => entry.mediaId))];
  const mediaDocs = await MediaBase.find({ contentId: { $in: mediaIds } })
    .select(
      'contentId type title contentImage coverImage genres isAdult isAdultImage'
    )
    .lean();

  const mediaByKey = new Map(
    mediaDocs.map((doc) => [`${doc.type}:${doc.contentId}`, doc])
  );

  return [...entries]
    .sort((a, b) => a.order - b.order)
    .map((entry) => ({
      mediaId: entry.mediaId,
      mediaType: entry.mediaType,
      note: entry.note,
      order: entry.order,
      addedAt: entry.addedAt,
      media: mediaByKey.get(`${entry.mediaType}:${entry.mediaId}`) ?? null,
    }));
}

/** Poster previews shown on list cards in browse/profile views. */
async function attachPreviews(lists: IMediaList[]) {
  const keys = lists.flatMap((list) =>
    [...list.entries]
      .sort((a, b) => a.order - b.order)
      .slice(0, 5)
      .map((entry) => entry.mediaId)
  );

  if (!keys.length) {
    return lists.map((list) => ({ list, preview: [] }));
  }

  const mediaDocs = await MediaBase.find({
    contentId: { $in: [...new Set(keys)] },
  })
    .select('contentId type title contentImage coverImage')
    .lean();

  const mediaByKey = new Map(
    mediaDocs.map((doc) => [`${doc.type}:${doc.contentId}`, doc])
  );

  return lists.map((list) => ({
    list,
    preview: [...list.entries]
      .sort((a, b) => a.order - b.order)
      .slice(0, 5)
      .map((entry) => mediaByKey.get(`${entry.mediaType}:${entry.mediaId}`))
      .filter(Boolean),
  }));
}

/** Entry count per media type, used to label cards ("30 VNs", "63 films"). */
function countByType(entries: IMediaListEntry[]) {
  return entries.reduce<Record<string, number>>((counts, entry) => {
    counts[entry.mediaType] = (counts[entry.mediaType] ?? 0) + 1;
    return counts;
  }, {});
}

function serializeList(
  list: IMediaList,
  viewerId?: Types.ObjectId | string,
  extra: Record<string, unknown> = {}
) {
  return {
    _id: list._id,
    user: list.user,
    title: list.title,
    description: list.description,
    isRanked: list.isRanked,
    isPublic: list.isPublic,
    entryCount: list.entries.length,
    entryTypeCounts: countByType(list.entries),
    likeCount: list.likes.length,
    isLiked: viewerId
      ? list.likes.some((like) => like.toString() === viewerId.toString())
      : false,
    commentCount: list.commentCount,
    clonedFrom: list.clonedFrom,
    createdAt: list.createdAt,
    updatedAt: list.updatedAt,
    ...extra,
  };
}

/** The list's owner id, whether or not `user` has been populated. */
function ownerId(list: Pick<IMediaList, 'user'>) {
  const user = list.user as Types.ObjectId | { _id: Types.ObjectId };
  return ('_id' in user ? user._id : user).toString();
}

function isOwner(
  list: Pick<IMediaList, 'user'>,
  viewerId?: Types.ObjectId | string
) {
  return !!viewerId && ownerId(list) === viewerId.toString();
}

function canView(list: IMediaList, viewerId?: Types.ObjectId | string) {
  return list.isPublic || isOwner(list, viewerId);
}

function validateMeta(body: {
  title?: unknown;
  description?: unknown;
}): string | null {
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  if (!title) return 'List title is required';
  if (title.length > TITLE_MAX_LENGTH) {
    return `List title must be ${TITLE_MAX_LENGTH} characters or less`;
  }
  if (
    typeof body.description === 'string' &&
    body.description.length > DESCRIPTION_MAX_LENGTH
  ) {
    return `Description must be ${DESCRIPTION_MAX_LENGTH} characters or less`;
  }
  return null;
}

function normalizeEntries(rawEntries: unknown): IMediaListEntry[] | string {
  if (!Array.isArray(rawEntries)) return 'Entries must be an array';
  if (rawEntries.length > MAX_ENTRIES) {
    return `A list can hold at most ${MAX_ENTRIES} entries`;
  }

  const seen = new Set<string>();
  const entries: IMediaListEntry[] = [];

  for (const [index, raw] of rawEntries.entries()) {
    const entry = raw as Partial<IMediaListEntry>;
    if (!entry || typeof entry.mediaId !== 'string' || !entry.mediaId.trim()) {
      return 'Each entry needs a mediaId';
    }
    if (!isMediaType(entry.mediaType)) {
      return `Invalid media type for entry ${entry.mediaId}`;
    }
    if (typeof entry.note === 'string' && entry.note.length > NOTE_MAX_LENGTH) {
      return `Entry notes must be ${NOTE_MAX_LENGTH} characters or less`;
    }

    const key = `${entry.mediaType}:${entry.mediaId}`;
    if (seen.has(key)) continue;
    seen.add(key);

    entries.push({
      mediaId: entry.mediaId,
      mediaType: entry.mediaType,
      note: typeof entry.note === 'string' ? entry.note.trim() : undefined,
      order: index,
      addedAt: entry.addedAt ? new Date(entry.addedAt) : new Date(),
    });
  }

  return entries;
}

export async function getMediaLists(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const viewerId = res.locals.user?._id;
    const page = Math.max(parseInt(String(req.query.page ?? '1'), 10) || 1, 1);
    const limit = Math.min(
      Math.max(parseInt(String(req.query.limit ?? '24'), 10) || 24, 1),
      50
    );
    const sort = String(req.query.sort ?? 'popular');
    const search = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const mediaType = req.query.mediaType;

    const filter: Record<string, unknown> = { isPublic: true };

    if (search) {
      filter.title = { $regex: search, $options: 'i' };
    }
    if (isMediaType(mediaType)) {
      filter['entries.mediaType'] = mediaType;
    }

    const sortStage: Record<string, 1 | -1> =
      sort === 'recent'
        ? { createdAt: -1 }
        : sort === 'updated'
          ? { updatedAt: -1 }
          : { likeCount: -1, createdAt: -1 };

    const [lists, total] = await Promise.all([
      MediaList.aggregate<IMediaList & { likeCount: number }>([
        { $match: filter },
        { $addFields: { likeCount: { $size: '$likes' } } },
        { $sort: sortStage },
        { $skip: (page - 1) * limit },
        { $limit: limit },
      ]),
      MediaList.countDocuments(filter),
    ]);

    const populated = await MediaList.populate(lists, {
      path: 'user',
      select: 'username avatar',
    });
    const withPreviews = await attachPreviews(populated as IMediaList[]);

    return res.status(200).json({
      lists: withPreviews.map(({ list, preview }) =>
        serializeList(list, viewerId, { preview })
      ),
      total,
      page,
      limit,
      hasMore: page * limit < total,
    });
  } catch (error) {
    return next(error as customError);
  }
}

export async function getUserMediaLists(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { username } = req.params;
    const viewerId = res.locals.user?._id;

    const owner = await User.findOne({ username }).select('_id').lean();
    if (!owner) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isOwner = !!viewerId && owner._id.toString() === viewerId.toString();
    const filter: Record<string, unknown> = { user: owner._id };
    if (!isOwner) filter.isPublic = true;

    const lists = await MediaList.find(filter)
      .populate('user', 'username avatar')
      .sort({ updatedAt: -1 });

    const withPreviews = await attachPreviews(lists);

    return res.status(200).json({
      lists: withPreviews.map(({ list, preview }) =>
        serializeList(list, viewerId, { preview })
      ),
    });
  } catch (error) {
    return next(error as customError);
  }
}

/** Lists owned by the authenticated user, used by the "add to list" modal. */
export async function getMyMediaLists(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const viewerId = res.locals.user?._id;
    const { mediaId, mediaType } = req.query;

    const lists = await MediaList.find({ user: viewerId }).sort({
      updatedAt: -1,
    });

    return res.status(200).json({
      lists: lists.map((list) =>
        serializeList(list, viewerId, {
          containsMedia:
            typeof mediaId === 'string' && isMediaType(mediaType)
              ? list.entries.some(
                  (entry) =>
                    entry.mediaId === mediaId && entry.mediaType === mediaType
                )
              : false,
        })
      ),
    });
  } catch (error) {
    return next(error as customError);
  }
}

export async function getMediaListById(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { listId } = req.params;
    const viewerId = res.locals.user?._id;

    if (!Types.ObjectId.isValid(listId)) {
      return res.status(400).json({ message: 'Invalid list ID' });
    }

    const list = await MediaList.findById(listId)
      .populate('user', 'username avatar')
      .populate('clonedFrom', 'title user');

    if (!list) {
      return res.status(404).json({ message: 'List not found' });
    }
    if (!canView(list, viewerId)) {
      return res.status(403).json({ message: 'This list is private' });
    }

    const entries = await hydrateEntries(list.entries);

    return res
      .status(200)
      .json({ list: serializeList(list, viewerId, { entries }) });
  } catch (error) {
    return next(error as customError);
  }
}

export async function createMediaList(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = res.locals.user?._id;
    const metaError = validateMeta(req.body);
    if (metaError) {
      return res.status(400).json({ message: metaError });
    }

    const entries = req.body.entries ? normalizeEntries(req.body.entries) : [];
    if (typeof entries === 'string') {
      return res.status(400).json({ message: entries });
    }

    const list = await MediaList.create({
      user: userId,
      title: String(req.body.title).trim(),
      description:
        typeof req.body.description === 'string'
          ? req.body.description.trim()
          : undefined,
      isRanked: !!req.body.isRanked,
      isPublic: req.body.isPublic !== false,
      entries,
    });

    return res.status(201).json({
      message: 'List created',
      list: serializeList(list, userId),
    });
  } catch (error) {
    return next(error as customError);
  }
}

export async function updateMediaList(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { listId } = req.params;
    const userId = res.locals.user?._id;

    if (!Types.ObjectId.isValid(listId)) {
      return res.status(400).json({ message: 'Invalid list ID' });
    }

    const list = await MediaList.findById(listId);
    if (!list) {
      return res.status(404).json({ message: 'List not found' });
    }
    if (!isOwner(list, userId)) {
      return res.status(403).json({ message: 'You do not own this list' });
    }

    if (req.body.title !== undefined || req.body.description !== undefined) {
      const metaError = validateMeta({
        title: req.body.title ?? list.title,
        description: req.body.description,
      });
      if (metaError) {
        return res.status(400).json({ message: metaError });
      }
    }

    if (req.body.title !== undefined)
      list.title = String(req.body.title).trim();
    if (req.body.description !== undefined) {
      list.description = String(req.body.description).trim();
    }
    if (req.body.isRanked !== undefined) list.isRanked = !!req.body.isRanked;
    if (req.body.isPublic !== undefined) list.isPublic = !!req.body.isPublic;

    if (req.body.entries !== undefined) {
      const entries = normalizeEntries(req.body.entries);
      if (typeof entries === 'string') {
        return res.status(400).json({ message: entries });
      }
      list.entries = entries;
    }

    await list.save();

    return res
      .status(200)
      .json({ message: 'List updated', list: serializeList(list, userId) });
  } catch (error) {
    return next(error as customError);
  }
}

export async function deleteMediaList(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { listId } = req.params;
    const userId = res.locals.user?._id;

    if (!Types.ObjectId.isValid(listId)) {
      return res.status(400).json({ message: 'Invalid list ID' });
    }

    const list = await MediaList.findById(listId);
    if (!list) {
      return res.status(404).json({ message: 'List not found' });
    }
    if (!isOwner(list, userId)) {
      return res.status(403).json({ message: 'You do not own this list' });
    }

    await Promise.all([
      list.deleteOne(),
      MediaListComment.deleteMany({ list: list._id }),
    ]);

    return res.status(200).json({ message: 'List deleted' });
  } catch (error) {
    return next(error as customError);
  }
}

export async function addMediaListEntry(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { listId } = req.params;
    const { mediaId, mediaType, note } = req.body;
    const userId = res.locals.user?._id;

    if (!Types.ObjectId.isValid(listId)) {
      return res.status(400).json({ message: 'Invalid list ID' });
    }
    if (typeof mediaId !== 'string' || !mediaId.trim()) {
      return res.status(400).json({ message: 'mediaId is required' });
    }
    if (!isMediaType(mediaType)) {
      return res.status(400).json({ message: 'Invalid media type' });
    }
    if (typeof note === 'string' && note.length > NOTE_MAX_LENGTH) {
      return res.status(400).json({
        message: `Notes must be ${NOTE_MAX_LENGTH} characters or less`,
      });
    }

    const list = await MediaList.findById(listId);
    if (!list) {
      return res.status(404).json({ message: 'List not found' });
    }
    if (!isOwner(list, userId)) {
      return res.status(403).json({ message: 'You do not own this list' });
    }
    if (list.entries.length >= MAX_ENTRIES) {
      return res
        .status(400)
        .json({ message: `A list can hold at most ${MAX_ENTRIES} entries` });
    }
    if (
      list.entries.some(
        (entry) => entry.mediaId === mediaId && entry.mediaType === mediaType
      )
    ) {
      return res.status(400).json({ message: 'Media is already in this list' });
    }

    list.entries.push({
      mediaId,
      mediaType,
      note: typeof note === 'string' ? note.trim() : undefined,
      order: list.entries.length,
      addedAt: new Date(),
    });
    await list.save();

    return res
      .status(200)
      .json({ message: 'Added to list', list: serializeList(list, userId) });
  } catch (error) {
    return next(error as customError);
  }
}

export async function removeMediaListEntry(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { listId, mediaType, mediaId } = req.params;
    const userId = res.locals.user?._id;

    if (!Types.ObjectId.isValid(listId)) {
      return res.status(400).json({ message: 'Invalid list ID' });
    }

    const list = await MediaList.findById(listId);
    if (!list) {
      return res.status(404).json({ message: 'List not found' });
    }
    if (!isOwner(list, userId)) {
      return res.status(403).json({ message: 'You do not own this list' });
    }

    const remaining = list.entries.filter(
      (entry) => !(entry.mediaId === mediaId && entry.mediaType === mediaType)
    );
    if (remaining.length === list.entries.length) {
      return res.status(404).json({ message: 'Entry not found in list' });
    }

    list.entries = remaining.map((entry, index) => ({
      ...entry,
      order: index,
    }));
    await list.save();

    return res.status(200).json({
      message: 'Removed from list',
      list: serializeList(list, userId),
    });
  } catch (error) {
    return next(error as customError);
  }
}

export async function toggleMediaListLike(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { listId } = req.params;
    const userId = res.locals.user?._id;

    if (!Types.ObjectId.isValid(listId)) {
      return res.status(400).json({ message: 'Invalid list ID' });
    }

    const list = await MediaList.findById(listId);
    if (!list) {
      return res.status(404).json({ message: 'List not found' });
    }
    if (!canView(list, userId)) {
      return res.status(403).json({ message: 'This list is private' });
    }

    const index = list.likes.findIndex(
      (like) => like.toString() === userId.toString()
    );
    const isLiked = index === -1;

    if (isLiked) {
      list.likes.push(userId);
    } else {
      list.likes.splice(index, 1);
    }
    await list.save();

    return res.status(200).json({ isLiked, likeCount: list.likes.length });
  } catch (error) {
    return next(error as customError);
  }
}

export async function cloneMediaList(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { listId } = req.params;
    const userId = res.locals.user?._id;

    if (!Types.ObjectId.isValid(listId)) {
      return res.status(400).json({ message: 'Invalid list ID' });
    }

    const source = await MediaList.findById(listId);
    if (!source) {
      return res.status(404).json({ message: 'List not found' });
    }
    if (!canView(source, userId)) {
      return res.status(403).json({ message: 'This list is private' });
    }

    const title =
      typeof req.body?.title === 'string' && req.body.title.trim()
        ? req.body.title.trim().slice(0, TITLE_MAX_LENGTH)
        : `${source.title} (copy)`.slice(0, TITLE_MAX_LENGTH);

    const clone = await MediaList.create({
      user: userId,
      title,
      description: source.description,
      isRanked: source.isRanked,
      isPublic: false,
      entries: source.entries.map((entry, index) => ({
        mediaId: entry.mediaId,
        mediaType: entry.mediaType,
        note: entry.note,
        order: index,
        addedAt: new Date(),
      })),
      clonedFrom: source._id,
    });

    return res
      .status(201)
      .json({ message: 'List copied', list: serializeList(clone, userId) });
  } catch (error) {
    return next(error as customError);
  }
}

export async function getMediaListComments(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { listId } = req.params;
    const viewerId = res.locals.user?._id;

    if (!Types.ObjectId.isValid(listId)) {
      return res.status(400).json({ message: 'Invalid list ID' });
    }

    const list = await MediaList.findById(listId).select('isPublic user');
    if (!list) {
      return res.status(404).json({ message: 'List not found' });
    }
    if (!canView(list, viewerId)) {
      return res.status(403).json({ message: 'This list is private' });
    }

    const comments = await MediaListComment.find({ list: listId })
      .populate('user', 'username avatar')
      .sort({ createdAt: -1 });

    return res.status(200).json({ comments });
  } catch (error) {
    return next(error as customError);
  }
}

export async function addMediaListComment(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { listId } = req.params;
    const userId = res.locals.user?._id;
    const content =
      typeof req.body.content === 'string' ? req.body.content.trim() : '';

    if (!Types.ObjectId.isValid(listId)) {
      return res.status(400).json({ message: 'Invalid list ID' });
    }
    if (!content) {
      return res.status(400).json({ message: 'Comment content is required' });
    }
    if (content.length > COMMENT_MAX_LENGTH) {
      return res.status(400).json({
        message: `Comment must be ${COMMENT_MAX_LENGTH} characters or less`,
      });
    }

    const list = await MediaList.findById(listId);
    if (!list) {
      return res.status(404).json({ message: 'List not found' });
    }
    if (!canView(list, userId)) {
      return res.status(403).json({ message: 'This list is private' });
    }

    const comment = await MediaListComment.create({
      list: listId,
      user: userId,
      content,
    });

    list.commentCount += 1;
    await list.save();

    await comment.populate('user', 'username avatar');

    return res.status(201).json({ message: 'Comment added', comment });
  } catch (error) {
    return next(error as customError);
  }
}

export async function deleteMediaListComment(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { listId, commentId } = req.params;
    const userId = res.locals.user?._id;

    if (!Types.ObjectId.isValid(listId) || !Types.ObjectId.isValid(commentId)) {
      return res.status(400).json({ message: 'Invalid ID' });
    }

    const [list, comment] = await Promise.all([
      MediaList.findById(listId),
      MediaListComment.findById(commentId),
    ]);

    if (!list || !comment || comment.list.toString() !== listId) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    // Comment authors and list owners can both delete a comment.
    const isAuthor = comment.user.toString() === userId.toString();
    const isListOwner = isOwner(list, userId);
    if (!isAuthor && !isListOwner) {
      return res
        .status(403)
        .json({ message: 'You cannot delete this comment' });
    }

    await comment.deleteOne();
    list.commentCount = Math.max(list.commentCount - 1, 0);
    await list.save();

    return res.status(200).json({ message: 'Comment deleted' });
  } catch (error) {
    return next(error as customError);
  }
}

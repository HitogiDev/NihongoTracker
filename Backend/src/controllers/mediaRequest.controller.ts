import { Request, Response, NextFunction } from 'express';
import { Model, Types } from 'mongoose';
import MediaRequest from '../models/mediaRequest.model.js';
import {
  Anime,
  Manga,
  Reading,
  Video,
  Movie,
  TVShow,
  VideoGame,
  Vn,
} from '../models/media.model.js';
import { customError } from '../middlewares/errorMiddleware.js';
import { addMediaToIndex } from '../services/meilisearch/mediaIndex.js';
import { createNotification } from '../services/notifications.service.js';
import {
  IMediaDescription,
  IMediaDocument,
  IMediaRequest,
  MediaRequestType,
} from '../types.js';

// 'video' (YouTube channels) is intentionally excluded — those aren't
// user-requestable and can't be searched via the media search endpoint.
const MEDIA_REQUEST_TYPES: MediaRequestType[] = [
  'anime',
  'manga',
  'reading',
  'vn',
  'movie',
  'tv show',
  'game',
];

// Maps a request type to the matching Mongoose discriminator model.
const TYPE_TO_MODEL: Record<MediaRequestType, Model<IMediaDocument>> = {
  anime: Anime as unknown as Model<IMediaDocument>,
  manga: Manga as unknown as Model<IMediaDocument>,
  reading: Reading as unknown as Model<IMediaDocument>,
  vn: Vn as unknown as Model<IMediaDocument>,
  video: Video as unknown as Model<IMediaDocument>,
  movie: Movie as unknown as Model<IMediaDocument>,
  'tv show': TVShow as unknown as Model<IMediaDocument>,
  game: VideoGame as unknown as Model<IMediaDocument>,
};

const MAX_PENDING_PER_USER = 10;

function sanitizeTitle(raw: unknown): {
  contentTitleNative: string;
  contentTitleRomaji?: string;
  contentTitleEnglish?: string;
} | null {
  if (!raw || typeof raw !== 'object') return null;
  const t = raw as Record<string, unknown>;
  const native =
    typeof t.contentTitleNative === 'string'
      ? t.contentTitleNative.trim()
      : '';
  if (!native) return null;
  const romaji =
    typeof t.contentTitleRomaji === 'string'
      ? t.contentTitleRomaji.trim()
      : '';
  const english =
    typeof t.contentTitleEnglish === 'string'
      ? t.contentTitleEnglish.trim()
      : '';
  return {
    contentTitleNative: native,
    ...(romaji ? { contentTitleRomaji: romaji } : {}),
    ...(english ? { contentTitleEnglish: english } : {}),
  };
}

// Keep only well-formed, non-empty description entries with a valid language.
function sanitizeDescriptions(raw: unknown): IMediaDescription[] {
  if (!Array.isArray(raw)) return [];
  const valid: IMediaDescription['language'][] = ['eng', 'jpn', 'spa'];
  const result: IMediaDescription[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as Record<string, unknown>;
    const text = typeof e.description === 'string' ? e.description.trim() : '';
    const language = e.language as IMediaDescription['language'];
    if (text && valid.includes(language)) {
      result.push({ description: text, language });
    }
  }
  return result;
}

// POST /api/media-requests — any authenticated user submits a media request.
export async function createMediaRequest(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = res.locals.user?.id;
    if (!userId) throw new customError('Authentication required', 401);

    const { type, referenceUrl, coverImage, isAdult, note } =
      req.body as Partial<IMediaRequest> & { isAdult?: boolean };
    const description = sanitizeDescriptions(req.body.description);

    const title = sanitizeTitle(req.body.title);
    if (!title) {
      throw new customError('A native title is required', 400);
    }

    if (
      typeof type !== 'string' ||
      !MEDIA_REQUEST_TYPES.includes(type as MediaRequestType)
    ) {
      throw new customError('A valid media type is required', 400);
    }

    const pendingCount = await MediaRequest.countDocuments({
      user: userId,
      status: 'pending',
    });
    if (pendingCount >= MAX_PENDING_PER_USER) {
      throw new customError(
        `You already have ${MAX_PENDING_PER_USER} pending requests. Wait for them to be reviewed before submitting more.`,
        429
      );
    }

    const created = await MediaRequest.create({
      user: userId,
      title,
      type,
      description,
      referenceUrl:
        typeof referenceUrl === 'string' ? referenceUrl.trim() : undefined,
      coverImage:
        typeof coverImage === 'string' ? coverImage.trim() : undefined,
      isAdult: Boolean(isAdult),
      note: typeof note === 'string' ? note.trim() : undefined,
      status: 'pending',
    });

    return res.status(201).json({
      message: 'Media request submitted',
      request: created,
    });
  } catch (error) {
    return next(error as customError);
  }
}

// GET /api/media-requests/mine — the requester's own submissions.
export async function getMyMediaRequests(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = res.locals.user?.id;
    if (!userId) throw new customError('Authentication required', 401);

    const requests = await MediaRequest.find({ user: userId })
      .sort({ createdAt: -1 })
      .populate('reviewedBy', 'username')
      .lean();

    return res.status(200).json({ requests });
  } catch (error) {
    return next(error as customError);
  }
}

// GET /api/media-requests — admin/mod review queue (paginated, filter by status).
export async function getMediaRequests(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(req.query.limit as string) || 20)
    );
    const statusFilter = req.query.status as string | undefined;

    const query: Record<string, unknown> = {};
    if (
      statusFilter &&
      ['pending', 'approved', 'rejected'].includes(statusFilter)
    ) {
      query.status = statusFilter;
    }

    const [requests, total, pendingCount] = await Promise.all([
      MediaRequest.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('user', 'username avatar')
        .populate('reviewedBy', 'username')
        .lean(),
      MediaRequest.countDocuments(query),
      MediaRequest.countDocuments({ status: 'pending' }),
    ]);

    return res.status(200).json({
      requests,
      page,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      total,
      pendingCount,
    });
  } catch (error) {
    return next(error as customError);
  }
}

// PATCH /api/media-requests/:id/review — admin/mod approves or rejects.
export async function reviewMediaRequest(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const reviewerId = res.locals.user?.id;
    if (!reviewerId) throw new customError('Authentication required', 401);

    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) {
      throw new customError('Invalid request id', 400);
    }

    const { action, reviewNote } = req.body as {
      action?: string;
      reviewNote?: string;
    };
    if (action !== 'approve' && action !== 'reject') {
      throw new customError('action must be "approve" or "reject"', 400);
    }

    const request = await MediaRequest.findById(id);
    if (!request) throw new customError('Media request not found', 404);
    if (request.status !== 'pending') {
      throw new customError(
        `This request has already been ${request.status}`,
        409
      );
    }

    if (action === 'reject') {
      request.status = 'rejected';
      request.reviewedBy = new Types.ObjectId(reviewerId);
      request.reviewedAt = new Date();
      request.reviewNote =
        typeof reviewNote === 'string' ? reviewNote.trim() : undefined;
      await request.save();

      await createNotification({
        recipient: request.user,
        actor: reviewerId,
        type: 'media_request_rejected',
        title: `Your media request "${request.title.contentTitleNative}" was rejected`,
        body: request.reviewNote,
        link: '/media-request',
        image: request.coverImage,
        entityType: 'mediaRequest',
        entityId: request._id.toString(),
      });

      return res
        .status(200)
        .json({ message: 'Request rejected', request });
    }

    // Approve: create the real Media document from the request fields.
    const MediaModel = TYPE_TO_MODEL[request.type];
    const contentId = `req-${request._id}`;

    const mediaDoc = await MediaModel.create({
      contentId,
      title: request.title,
      type: request.type,
      coverImage: request.coverImage || undefined,
      contentImage: request.coverImage || undefined,
      isAdult: request.isAdult,
      description: request.description ?? [],
    });

    // Make it searchable immediately (startup sync won't re-run).
    try {
      await addMediaToIndex({
        _id: mediaDoc._id,
        contentId: mediaDoc.contentId,
        title: mediaDoc.title,
        contentImage: mediaDoc.contentImage,
        coverImage: mediaDoc.coverImage,
        isAdult: mediaDoc.isAdult,
        isAdultImage: mediaDoc.isAdultImage,
        synonyms: mediaDoc.synonyms,
        type: mediaDoc.type,
      });
    } catch (indexError) {
      console.warn('Failed to index approved media request:', indexError);
    }

    request.status = 'approved';
    request.reviewedBy = new Types.ObjectId(reviewerId);
    request.reviewedAt = new Date();
    request.reviewNote =
      typeof reviewNote === 'string' ? reviewNote.trim() : undefined;
    request.createdMediaContentId = contentId;
    request.createdMediaType = request.type;
    await request.save();

    await createNotification({
      recipient: request.user,
      actor: reviewerId,
      type: 'media_request_approved',
      title: `Your media request "${request.title.contentTitleNative}" was approved`,
      body: request.reviewNote,
      link: `/${request.type}/${contentId}`,
      image: request.coverImage,
      entityType: 'mediaRequest',
      entityId: request._id.toString(),
    });

    return res.status(200).json({
      message: 'Request approved and media created',
      request,
      media: mediaDoc,
    });
  } catch (error) {
    return next(error as customError);
  }
}

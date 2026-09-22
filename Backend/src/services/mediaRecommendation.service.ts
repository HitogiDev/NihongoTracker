import { Types } from 'mongoose';
import Follow from '../models/follow.model.js';
import { MediaBase } from '../models/media.model.js';
import MediaRecommendation from '../models/mediaRecommendation.model.js';
import User from '../models/user.model.js';
import { apiError } from '../i18n/errorCodes.js';
import {
  IMediaRecommendation,
  MediaListMediaType,
  MediaRecommendationStatus,
} from '../types.js';

const MEDIA_TYPES = new Set<MediaListMediaType>([
  'anime',
  'manga',
  'light-novel',
  'vn',
  'video',
  'movie',
  'tv show',
  'game',
  'book',
]);
const TERMINAL_STATUSES = new Set<MediaRecommendationStatus>([
  'dismissed',
  'accepted',
]);
export const MEDIA_RECOMMENDATION_MESSAGE_MAX_LENGTH = 280;
export const MEDIA_RECOMMENDATION_RATE_LIMIT_MAX = 10;
export const MEDIA_RECOMMENDATION_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

export function parseMediaRecommendationInput(input: {
  recipientUsername?: unknown;
  mediaId?: unknown;
  mediaType?: unknown;
  message?: unknown;
}) {
  const recipientUsername =
    typeof input.recipientUsername === 'string'
      ? input.recipientUsername.trim()
      : '';
  const mediaId = typeof input.mediaId === 'string' ? input.mediaId.trim() : '';
  const mediaType =
    typeof input.mediaType === 'string' ? input.mediaType.trim() : '';
  const message = typeof input.message === 'string' ? input.message.trim() : '';

  if (!recipientUsername || !mediaId) {
    throw apiError(
      'mediaRecommendation.fieldsRequired',
      400,
      'Recipient and media are required'
    );
  }
  if (!MEDIA_TYPES.has(mediaType as MediaListMediaType)) {
    throw apiError(
      'mediaRecommendation.invalidMediaType',
      400,
      'Invalid media type'
    );
  }
  if (message.length > MEDIA_RECOMMENDATION_MESSAGE_MAX_LENGTH) {
    throw apiError(
      'mediaRecommendation.messageTooLong',
      400,
      `Message must be ${MEDIA_RECOMMENDATION_MESSAGE_MAX_LENGTH} characters or less`,
      { max: MEDIA_RECOMMENDATION_MESSAGE_MAX_LENGTH }
    );
  }

  return {
    recipientUsername,
    mediaId,
    mediaType: mediaType as MediaListMediaType,
    message,
  };
}

export async function createMediaRecommendation(input: {
  senderId: Types.ObjectId;
  recipientUsername: string;
  mediaId: string;
  mediaType: MediaListMediaType;
  message: string;
}) {
  const recentRecommendationCount = await MediaRecommendation.countDocuments({
    sender: input.senderId,
    createdAt: {
      $gte: new Date(Date.now() - MEDIA_RECOMMENDATION_RATE_LIMIT_WINDOW_MS),
    },
  });
  if (recentRecommendationCount >= MEDIA_RECOMMENDATION_RATE_LIMIT_MAX) {
    throw apiError(
      'social.rateLimited',
      429,
      'Too many recommendations. Please try again later.',
      {
        retryAfterSeconds: Math.ceil(
          MEDIA_RECOMMENDATION_RATE_LIMIT_WINDOW_MS / 1000
        ),
      }
    );
  }

  const [recipient, media] = await Promise.all([
    User.findOne({ username: input.recipientUsername })
      .collation({ locale: 'en', strength: 2 })
      .select('_id username avatar')
      .lean(),
    MediaBase.findOne({ contentId: input.mediaId, type: input.mediaType })
      .select('contentId type title contentImage coverImage')
      .lean(),
  ]);
  if (!recipient) {
    throw apiError('user.notFound', 404, 'User not found');
  }
  if (recipient._id.equals(input.senderId)) {
    throw apiError(
      'mediaRecommendation.self',
      400,
      'You cannot recommend media to yourself'
    );
  }
  if (!media) {
    throw apiError('mediaRecommendation.mediaNotFound', 404, 'Media not found');
  }
  const isFollower = await Follow.exists({
    follower: recipient._id,
    following: input.senderId,
  });
  if (!isFollower) {
    throw apiError(
      'mediaRecommendation.followRequired',
      403,
      'You can only recommend media to users who follow you'
    );
  }

  try {
    const recommendation = await MediaRecommendation.create({
      sender: input.senderId,
      recipient: recipient._id,
      mediaId: input.mediaId,
      mediaType: input.mediaType,
      message: input.message,
    });
    return { recommendation, recipient, media };
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 11000
    ) {
      throw apiError(
        'mediaRecommendation.duplicate',
        409,
        'You already recommended this media to this user'
      );
    }
    throw error;
  }
}

function parsePage(value: unknown): number {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function parseLimit(value: unknown): number {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 50) : 20;
}

export async function listMediaRecommendations(input: {
  userId: Types.ObjectId;
  direction: 'received' | 'sent';
  page?: unknown;
  limit?: unknown;
}) {
  const page = parsePage(input.page);
  const limit = parseLimit(input.limit);
  const filter =
    input.direction === 'received'
      ? { recipient: input.userId }
      : { sender: input.userId };
  const [recommendations, total] = await Promise.all([
    MediaRecommendation.find(filter)
      .populate('sender', 'username avatar')
      .populate('recipient', 'username avatar')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    MediaRecommendation.countDocuments(filter),
  ]);
  const mediaKeys = [
    ...new Set(
      recommendations.map(
        (recommendation) =>
          `${recommendation.mediaType}:${recommendation.mediaId}`
      )
    ),
  ];
  if (recommendations.length === 0) {
    return {
      recommendations: [],
      page,
      limit,
      total,
      pages: Math.max(1, Math.ceil(total / limit)),
    };
  }
  const media = await MediaBase.find({
    $or: mediaKeys.map((key) => {
      const separator = key.indexOf(':');
      return {
        type: key.slice(0, separator),
        contentId: key.slice(separator + 1),
      };
    }),
  })
    .select('contentId type title contentImage coverImage')
    .lean();
  const mediaByKey = new Map(
    media.map((item) => [`${item.type}:${item.contentId}`, item])
  );

  return {
    recommendations: recommendations.map((recommendation) => ({
      ...recommendation,
      media:
        mediaByKey.get(
          `${recommendation.mediaType}:${recommendation.mediaId}`
        ) ?? null,
    })),
    page,
    limit,
    total,
    pages: Math.max(1, Math.ceil(total / limit)),
  };
}

export async function updateMediaRecommendationStatus(input: {
  recommendationId: Types.ObjectId;
  recipientId: Types.ObjectId;
  status: MediaRecommendationStatus;
}): Promise<IMediaRecommendation> {
  const recommendation = await MediaRecommendation.findOne({
    _id: input.recommendationId,
    recipient: input.recipientId,
  });
  if (!recommendation) {
    throw apiError(
      'mediaRecommendation.notFound',
      404,
      'Recommendation not found'
    );
  }
  if (TERMINAL_STATUSES.has(recommendation.status)) {
    throw apiError(
      'mediaRecommendation.alreadyResolved',
      409,
      'Recommendation has already been resolved'
    );
  }

  recommendation.status = input.status;
  if (input.status === 'viewed') recommendation.viewedAt = new Date();
  if (TERMINAL_STATUSES.has(input.status)) {
    recommendation.respondedAt = new Date();
    recommendation.viewedAt ??= new Date();
  }
  await recommendation.save();
  return recommendation;
}

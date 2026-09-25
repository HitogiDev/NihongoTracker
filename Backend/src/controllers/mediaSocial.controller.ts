import { NextFunction, Request, Response } from 'express';
import { Types } from 'mongoose';
import { customError } from '../middlewares/errorMiddleware.js';
import { apiError } from '../i18n/errorCodes.js';
import {
  getMediaCommunity,
  getMediaCommunityActivities,
  MediaCommunityRelation,
} from '../services/mediaCommunity.service.js';
import {
  createMediaRecommendation,
  listMediaRecommendations,
  parseMediaRecommendationInput,
  updateMediaRecommendationStatus,
} from '../services/mediaRecommendation.service.js';
import { createNotification } from '../services/notifications.service.js';
import { MediaRecommendationStatus } from '../types.js';

function mediaTitle(media: {
  title?: {
    contentTitleEnglish?: string;
    contentTitleRomaji?: string;
    contentTitleNative?: string;
  };
}): string {
  return (
    media.title?.contentTitleEnglish ||
    media.title?.contentTitleRomaji ||
    media.title?.contentTitleNative ||
    'Media'
  );
}

export async function getCommunity(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { mediaType, contentId } = req.params;
    if (!mediaType || !contentId) {
      throw apiError(
        'mediaRecommendation.fieldsRequired',
        400,
        'Media type and content ID are required'
      );
    }
    const requestedRelation = req.query.relation;
    const relation =
      requestedRelation === 'followers' ||
      requestedRelation === 'friends' ||
      requestedRelation === 'following'
        ? (requestedRelation as MediaCommunityRelation)
        : undefined;
    const viewerId = res.locals.user?._id as Types.ObjectId | undefined;
    const [community, activities] = await Promise.all([
      getMediaCommunity({ mediaId: contentId, mediaType, viewerId, relation }),
      getMediaCommunityActivities({
        mediaId: contentId,
        mediaType,
        viewerId,
        limit: 10,
      }),
    ]);
    return res.status(200).json({ ...community, activities });
  } catch (error) {
    return next(error as customError);
  }
}

export async function recommendMedia(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const parsed = parseMediaRecommendationInput(req.body);
    const { recommendation, recipient, media } =
      await createMediaRecommendation({
        senderId: res.locals.user._id,
        ...parsed,
      });
    const title = mediaTitle(media);
    await createNotification({
      recipient: recipient._id,
      actor: res.locals.user._id,
      type: 'media_recommendation',
      title: `${res.locals.user.username} recommended ${title}`,
      titleKey: 'mediaRecommendation.received',
      body: parsed.message || undefined,
      link: '/recommendations?tab=received',
      image: media.contentImage ?? media.coverImage,
      entityType: 'mediaRecommendation',
      entityId: (recommendation._id as Types.ObjectId).toString(),
      meta: {
        username: res.locals.user.username,
        avatar: res.locals.user.avatar ?? '',
        mediaTitle: title,
        mediaType: parsed.mediaType,
        mediaId: parsed.mediaId,
      },
    });
    return res.status(201).json({ recommendation });
  } catch (error) {
    return next(error as customError);
  }
}

export async function getRecommendations(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const direction = req.query.direction === 'sent' ? 'sent' : 'received';
    const result = await listMediaRecommendations({
      userId: res.locals.user._id,
      direction,
      page: req.query.page,
      limit: req.query.limit,
    });
    return res.status(200).json(result);
  } catch (error) {
    return next(error as customError);
  }
}

export async function updateRecommendationStatus(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    if (!Types.ObjectId.isValid(req.params.recommendationId)) {
      throw apiError(
        'mediaRecommendation.invalidId',
        400,
        'Invalid recommendation ID'
      );
    }
    const status = req.body.status as MediaRecommendationStatus;
    if (!['viewed', 'dismissed', 'accepted'].includes(status)) {
      throw apiError(
        'mediaRecommendation.invalidStatus',
        400,
        'Invalid recommendation status'
      );
    }
    const recommendation = await updateMediaRecommendationStatus({
      recommendationId: new Types.ObjectId(req.params.recommendationId),
      recipientId: res.locals.user._id,
      status,
    });
    return res.status(200).json({ recommendation });
  } catch (error) {
    return next(error as customError);
  }
}

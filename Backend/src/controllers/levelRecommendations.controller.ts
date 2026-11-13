import { NextFunction, Request, Response } from 'express';
import { apiError } from '../i18n/errorCodes.js';
import { customError } from '../middlewares/errorMiddleware.js';
import LevelRecommendationDismissal from '../models/levelRecommendationDismissal.model.js';
import { MediaBase } from '../models/media.model.js';
import { hasLevelRecommendationFilters } from '../services/levelRecommendationAccess.js';
import {
  LEVEL_DISMISSAL_LIMIT,
  LEVEL_RECOMMENDATION_MEDIA_TYPES,
  getLevelRecommendations,
  parseLevelRecommendationCategory,
  parseLevelRecommendationGenres,
  parseLevelRecommendationLimit,
  parseLevelRecommendationShift,
  parseLevelRecommendationTypes,
} from '../services/levelRecommendations.service.js';

function requireFilterAccess(user: Response['locals']['user']): void {
  if (!hasLevelRecommendationFilters(user)) {
    throw apiError(
      'levelRecommendations.tierRequired',
      403,
      'Filters and hidden titles require an active Enthusiast or Consumer tier'
    );
  }
}

function parseDismissalTarget(source: {
  mediaId?: unknown;
  mediaType?: unknown;
}): { mediaId: string; mediaType: string } {
  const mediaId = typeof source.mediaId === 'string' ? source.mediaId.trim() : '';
  const mediaType =
    typeof source.mediaType === 'string' ? source.mediaType.trim() : '';
  const allowedTypes: string[] = Object.values(
    LEVEL_RECOMMENDATION_MEDIA_TYPES
  ).flat();
  if (!mediaId || mediaId.length > 100 || !allowedTypes.includes(mediaType)) {
    throw apiError(
      'levelRecommendations.invalidMedia',
      400,
      'Choose a valid title to hide'
    );
  }
  return { mediaId, mediaType };
}

export async function getLevelRecommendationsHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const user = res.locals.user;
    const category = parseLevelRecommendationCategory(req.query.category);
    const types = parseLevelRecommendationTypes(req.query.types, category);
    const genres = parseLevelRecommendationGenres(req.query.genres);
    const shiftJiten = parseLevelRecommendationShift(req.query.shift);
    const canFilter = hasLevelRecommendationFilters(user);

    if ((types || genres || shiftJiten !== 0) && !canFilter) {
      requireFilterAccess(user);
    }

    const result = await getLevelRecommendations(user, {
      category,
      limit: parseLevelRecommendationLimit(req.query.limit),
      filters: { types, genres, shiftJiten, includeGenres: canFilter },
    });
    return res.status(200).json({ ...result, canFilter });
  } catch (error) {
    return next(error as customError);
  }
}

export async function dismissLevelRecommendation(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const user = res.locals.user;
    requireFilterAccess(user);
    const { mediaId, mediaType } = parseDismissalTarget(req.body ?? {});

    const media = await MediaBase.exists({ contentId: mediaId, type: mediaType });
    if (!media) {
      throw apiError(
        'levelRecommendations.invalidMedia',
        400,
        'Choose a valid title to hide'
      );
    }

    const count = await LevelRecommendationDismissal.countDocuments({
      user: user._id,
    });
    if (count >= LEVEL_DISMISSAL_LIMIT) {
      throw apiError(
        'levelRecommendations.dismissalLimit',
        400,
        'You reached the limit of hidden titles'
      );
    }

    await LevelRecommendationDismissal.updateOne(
      { user: user._id, mediaType, mediaId },
      { $setOnInsert: { user: user._id, mediaType, mediaId } },
      { upsert: true }
    );
    return res.status(204).send();
  } catch (error) {
    return next(error as customError);
  }
}

export async function restoreLevelRecommendation(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { mediaId, mediaType } = parseDismissalTarget(req.params);
    await LevelRecommendationDismissal.deleteOne({
      user: res.locals.user._id,
      mediaType,
      mediaId,
    });
    return res.status(204).send();
  } catch (error) {
    return next(error as customError);
  }
}

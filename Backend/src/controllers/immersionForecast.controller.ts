import { NextFunction, Request, Response } from 'express';
import ImmersionForecast from '../models/immersionForecast.model.js';
import { customError } from '../middlewares/errorMiddleware.js';
import { apiError } from '../i18n/errorCodes.js';
import { hasImmersionForecastAccess } from '../services/immersionForecastAccess.js';
import {
  calculateImmersionForecast,
  getForecastProgressTotal,
  mediaTitle,
  resolveForecastTarget,
} from '../services/immersionForecast.service.js';
import { IMediaDocument } from '../types.js';

const MEDIA_TYPES: IMediaDocument['type'][] = [
  'anime',
  'manga',
  'light-novel',
  'vn',
  'movie',
  'tv show',
  'game',
  'book',
];

function requireManageAccess(user: Response['locals']['user']): void {
  if (!hasImmersionForecastAccess(user)) {
    throw apiError(
      'forecast.tierRequired',
      403,
      'Immersion Planner requires an active Enthusiast or Consumer tier'
    );
  }
}

function parseTargetDate(value: unknown, timezone: string): Date {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw apiError('forecast.invalidDate', 400, 'Use a valid target date');
  }
  const parsed = new Date(`${value}T12:00:00.000Z`);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  ) {
    throw apiError('forecast.invalidDate', 400, 'Use a valid target date');
  }
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const datePart = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';
  const today = `${datePart('year')}-${datePart('month')}-${datePart('day')}`;
  if (value <= today) {
    throw apiError(
      'forecast.invalidDate',
      400,
      'Target date must be after today'
    );
  }
  return parsed;
}

export async function getImmersionForecasts(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { user } = res.locals;
    const forecasts = await ImmersionForecast.find({ user: user._id }).sort({
      createdAt: -1,
    });
    const withProgress = await Promise.all(
      forecasts.map(async (forecast) => ({
        ...forecast.toObject(),
        progress: await calculateImmersionForecast(forecast),
      }))
    );
    return res.status(200).json({
      forecasts: withProgress,
      canManage: hasImmersionForecastAccess(user),
    });
  } catch (error) {
    return next(error as customError);
  }
}

export async function createImmersionForecast(
  req: Request<
    unknown,
    unknown,
    { mediaId?: string; mediaType?: string; targetDate?: string }
  >,
  res: Response,
  next: NextFunction
) {
  try {
    const { user } = res.locals;
    requireManageAccess(user);
    const mediaId = req.body.mediaId?.trim();
    const mediaType = req.body.mediaType as IMediaDocument['type'];
    if (!mediaId || !MEDIA_TYPES.includes(mediaType)) {
      throw apiError(
        'forecast.mediaNotMeasurable',
        422,
        'This media does not have a reliable completion total'
      );
    }
    const timezone = user.settings?.timezone || 'UTC';
    const targetDate = parseTargetDate(req.body.targetDate, timezone);
    const resolved = await resolveForecastTarget(mediaId, mediaType);
    if (!resolved) {
      throw apiError(
        'forecast.mediaNotMeasurable',
        422,
        'This media does not have a reliable completion total'
      );
    }
    const startingProgress = await getForecastProgressTotal(
      user._id,
      mediaId,
      mediaType,
      resolved.target.metric
    );
    if (startingProgress >= resolved.target.total) {
      throw apiError(
        'forecast.alreadyComplete',
        400,
        'This media is already complete'
      );
    }

    const forecast = await ImmersionForecast.create({
      user: user._id,
      mediaId,
      mediaType,
      metric: resolved.target.metric,
      targetTotal: resolved.target.total,
      targetSource: resolved.target.source,
      startingProgress,
      targetDate,
      timezone,
      mediaTitle: mediaTitle(resolved.media),
      mediaImage: resolved.media.contentImage || resolved.media.coverImage,
      episodeDuration: resolved.target.episodeDuration,
    });
    return res.status(201).json({
      ...forecast.toObject(),
      progress: await calculateImmersionForecast(forecast),
    });
  } catch (error) {
    if ((error as { code?: number }).code === 11000) {
      return next(
        apiError(
          'forecast.alreadyExists',
          409,
          'A forecast already exists for this media'
        )
      );
    }
    return next(error as customError);
  }
}

export async function updateImmersionForecast(
  req: Request<{ forecastId: string }, unknown, { targetDate?: string }>,
  res: Response,
  next: NextFunction
) {
  try {
    const { user } = res.locals;
    requireManageAccess(user);
    const forecast = await ImmersionForecast.findOne({
      _id: req.params.forecastId,
      user: user._id,
    });
    if (!forecast) {
      throw apiError('forecast.notFound', 404, 'Forecast not found');
    }
    forecast.targetDate = parseTargetDate(
      req.body.targetDate,
      forecast.timezone
    );
    await forecast.save();
    return res.status(200).json({
      ...forecast.toObject(),
      progress: await calculateImmersionForecast(forecast),
    });
  } catch (error) {
    return next(error as customError);
  }
}

export async function deleteImmersionForecast(
  req: Request<{ forecastId: string }>,
  res: Response,
  next: NextFunction
) {
  try {
    const deleted = await ImmersionForecast.findOneAndDelete({
      _id: req.params.forecastId,
      user: res.locals.user._id,
    });
    if (!deleted) {
      throw apiError('forecast.notFound', 404, 'Forecast not found');
    }
    return res.status(200).json({ message: 'Forecast deleted successfully' });
  } catch (error) {
    return next(error as customError);
  }
}

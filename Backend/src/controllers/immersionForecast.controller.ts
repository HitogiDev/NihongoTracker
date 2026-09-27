import { NextFunction, Request, Response } from 'express';
import ImmersionForecast from '../models/immersionForecast.model.js';
import { customError } from '../middlewares/errorMiddleware.js';
import { apiError } from '../i18n/errorCodes.js';
import { hasImmersionForecastAccess } from '../services/immersionForecastAccess.js';
import {
  calculateImmersionForecast,
  getForecastMedia,
  getForecastProgressTotal,
  mediaTitle,
  previewImmersionForecastEffort,
  resolveForecastTarget,
} from '../services/immersionForecast.service.js';
import { IMediaDocument, ImmersionForecastMetric } from '../types.js';

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
const FORECAST_METRICS: ImmersionForecastMetric[] = [
  'chars',
  'pages',
  'volumes',
  'episodes',
  'minutes',
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

export async function getImmersionForecastTargetAvailability(
  req: Request<unknown, unknown, unknown, { mediaId?: string; mediaType?: string }>,
  res: Response,
  next: NextFunction
) {
  try {
    const mediaId = req.query.mediaId?.trim();
    const mediaType = req.query.mediaType as IMediaDocument['type'];
    if (!mediaId || !MEDIA_TYPES.includes(mediaType)) {
      throw apiError(
        'forecast.mediaNotMeasurable',
        422,
        'This media does not have a reliable completion total'
      );
    }
    const resolved = await resolveForecastTarget(mediaId, mediaType);
    return res.status(200).json({
      hasReliableTarget: Boolean(resolved),
      target: resolved
        ? { metric: resolved.target.metric, total: resolved.target.total }
        : null,
    });
  } catch (error) {
    return next(error as customError);
  }
}

export async function previewImmersionForecast(
  req: Request<
    unknown,
    unknown,
    {
      mediaId?: string;
      mediaType?: string;
      targetDate?: string;
      metric?: ImmersionForecastMetric;
      targetTotal?: number;
    }
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
    const hasManualTotal =
      req.body.targetTotal !== undefined && req.body.targetTotal !== null;
    const manualTotal = Number(req.body.targetTotal);
    const manualMetric = req.body.metric;
    if (
      hasManualTotal &&
      (!Number.isFinite(manualTotal) ||
        manualTotal <= 0 ||
        !manualMetric ||
        !FORECAST_METRICS.includes(manualMetric))
    ) {
      throw apiError(
        'forecast.invalidManualTarget',
        400,
        'Enter a valid completion total and metric'
      );
    }
    const media = await getForecastMedia(mediaId, mediaType);
    const resolved = hasManualTotal
      ? null
      : await resolveForecastTarget(mediaId, mediaType);
    if (!media || (!resolved && !hasManualTotal)) {
      throw apiError(
        'forecast.mediaNotMeasurable',
        422,
        'This media does not have a reliable completion total'
      );
    }
    const target = hasManualTotal
      ? {
          metric: manualMetric as ImmersionForecastMetric,
          total: manualTotal,
          episodeDuration:
            manualMetric === 'episodes' &&
            Number.isFinite(Number(media.episodeDuration))
              ? Number(media.episodeDuration)
              : undefined,
        }
      : resolved?.target;
    if (!target) {
      throw apiError(
        'forecast.mediaNotMeasurable',
        422,
        'This media does not have a reliable completion total'
      );
    }
    return res.status(200).json(
      await previewImmersionForecastEffort({
        user: user._id,
        mediaId,
        mediaType,
        metric: target.metric,
        targetTotal: target.total,
        episodeDuration: target.episodeDuration,
        targetDate,
        timezone,
      })
    );
  } catch (error) {
    return next(error as customError);
  }
}

export async function createImmersionForecast(
  req: Request<
    unknown,
    unknown,
    {
      mediaId?: string;
      mediaType?: string;
      targetDate?: string;
      metric?: ImmersionForecastMetric;
      targetTotal?: number;
    }
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
    const hasManualTotal =
      req.body.targetTotal !== undefined && req.body.targetTotal !== null;
    const manualTotal = Number(req.body.targetTotal);
    const manualMetric = req.body.metric;
    const media = await getForecastMedia(mediaId, mediaType);
    const resolved = hasManualTotal
      ? null
      : await resolveForecastTarget(mediaId, mediaType);
    if (
      hasManualTotal &&
      (!Number.isFinite(manualTotal) ||
        manualTotal <= 0 ||
        !manualMetric ||
        !FORECAST_METRICS.includes(manualMetric))
    ) {
      throw apiError(
        'forecast.invalidManualTarget',
        400,
        'Enter a valid completion total and metric'
      );
    }
    if (!media || (!resolved && !hasManualTotal)) {
      throw apiError(
        'forecast.mediaNotMeasurable',
        422,
        'This media does not have a reliable completion total'
      );
    }
    const target = hasManualTotal
      ? {
          metric: manualMetric as ImmersionForecastMetric,
          total: manualTotal,
          source: 'manual' as const,
          episodeDuration:
            manualMetric === 'episodes' &&
            Number.isFinite(Number(media?.episodeDuration))
              ? Number(media?.episodeDuration)
              : undefined,
        }
      : resolved?.target;
    if (!target) {
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
      target.metric
    );
    if (startingProgress >= target.total) {
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
      metric: target.metric,
      targetTotal: target.total,
      targetSource: target.source,
      startingProgress,
      targetDate,
      timezone,
      planStartedAt: new Date(),
      mediaTitle: mediaTitle(media),
      mediaImage: media.contentImage || media.coverImage,
      episodeDuration: target.episodeDuration,
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
  req: Request<
    { forecastId: string },
    unknown,
    {
      targetDate?: string;
      metric?: ImmersionForecastMetric;
      targetTotal?: number;
    }
  >,
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
    forecast.targetDate = parseTargetDate(req.body.targetDate, forecast.timezone);
    const hasTargetUpdate =
      req.body.metric !== undefined || req.body.targetTotal !== undefined;
    if (hasTargetUpdate) {
      const metric = req.body.metric;
      const total = Number(req.body.targetTotal);
      if (
        !metric ||
        !FORECAST_METRICS.includes(metric) ||
        !Number.isFinite(total) ||
        total <= 0
      ) {
        throw apiError(
          'forecast.invalidManualTarget',
          400,
          'Enter a valid completion total and metric'
        );
      }
      if (metric !== forecast.metric || total !== forecast.targetTotal) {
        const currentProgress = await getForecastProgressTotal(
          user._id,
          forecast.mediaId,
          forecast.mediaType,
          metric
        );
        forecast.metric = metric;
        forecast.targetTotal = total;
        forecast.targetSource = 'manual';
        forecast.startingProgress = currentProgress;
        forecast.planStartedAt = new Date();
        const media = await getForecastMedia(forecast.mediaId, forecast.mediaType);
        forecast.episodeDuration =
          metric === 'episodes' && Number.isFinite(Number(media?.episodeDuration))
            ? Number(media?.episodeDuration)
            : undefined;
      }
    }
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

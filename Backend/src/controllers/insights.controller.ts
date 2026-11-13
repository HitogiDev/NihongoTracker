import { NextFunction, Request, Response } from 'express';
import User from '../models/user.model.js';
import { apiError } from '../i18n/errorCodes.js';
import { hasEnthusiastAccess } from '../services/premiumAccess.js';
import {
  SPEED_COMPARISON_MONTHS,
  getPeriodSummary,
  getUserInsights,
  parseLocalPeriod,
  percentChange,
  userCalendar,
} from '../services/insights.service.js';

function requireInsightsAccess(user: Response['locals']['user']): void {
  if (!hasEnthusiastAccess(user)) {
    throw apiError(
      'insights.tierRequired',
      403,
      'Insights require an active Enthusiast or Consumer tier'
    );
  }
}

function digestSettings(user: Response['locals']['user']) {
  return {
    weekly: Boolean(user.settings?.insightsDigest?.weekly),
    monthly: Boolean(user.settings?.insightsDigest?.monthly),
  };
}

export async function getInsights(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { user } = res.locals;
    requireInsightsAccess(user);
    const requested = Number(req.query.compareMonths ?? 6);
    const compareMonths = (SPEED_COMPARISON_MONTHS as readonly number[]).includes(
      requested
    )
      ? requested
      : 6;
    const insights = await getUserInsights({ user, compareMonths });
    return res.status(200).json({ ...insights, digest: digestSettings(user) });
  } catch (error) {
    return next(error);
  }
}

export async function comparePeriods(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { user } = res.locals;
    requireInsightsAccess(user);
    const calendar = userCalendar(user);
    const a = parseLocalPeriod(req.query.aStart, req.query.aEnd, calendar);
    const b = parseLocalPeriod(req.query.bStart, req.query.bEnd, calendar);
    if (!a || !b) {
      throw apiError(
        'insights.invalidPeriod',
        400,
        'Choose two valid periods of at most two years'
      );
    }
    const [current, previous] = await Promise.all([
      getPeriodSummary(user._id, a.start, a.end, calendar),
      getPeriodSummary(user._id, b.start, b.end, calendar),
    ]);
    return res.status(200).json({
      a: { ...current, startKey: a.startKey, endKey: a.endKey, days: a.days },
      b: { ...previous, startKey: b.startKey, endKey: b.endKey, days: b.days },
      change: {
        xp: percentChange(current.xp, previous.xp),
        time: percentChange(current.time, previous.time),
        chars: percentChange(current.chars, previous.chars),
        activeDays: percentChange(current.activeDays, previous.activeDays),
        charsPerHour:
          current.charsPerHour !== null && previous.charsPerHour !== null
            ? percentChange(current.charsPerHour, previous.charsPerHour)
            : null,
      },
    });
  } catch (error) {
    return next(error);
  }
}

export async function updateDigestSettings(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { user } = res.locals;
    requireInsightsAccess(user);
    const { weekly, monthly } = req.body ?? {};
    if (
      (weekly !== undefined && typeof weekly !== 'boolean') ||
      (monthly !== undefined && typeof monthly !== 'boolean')
    ) {
      throw apiError('insights.invalidDigest', 400, 'Use true or false');
    }
    const update: Record<string, boolean> = {};
    if (weekly !== undefined) update['settings.insightsDigest.weekly'] = weekly;
    if (monthly !== undefined) {
      update['settings.insightsDigest.monthly'] = monthly;
    }
    const updated = await User.findByIdAndUpdate(
      user._id,
      { $set: update },
      { new: true }
    )
      .select('settings.insightsDigest')
      .lean();
    return res.status(200).json({
      weekly: Boolean(updated?.settings?.insightsDigest?.weekly),
      monthly: Boolean(updated?.settings?.insightsDigest?.monthly),
    });
  } catch (error) {
    return next(error);
  }
}

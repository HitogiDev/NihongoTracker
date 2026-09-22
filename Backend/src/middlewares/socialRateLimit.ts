import { NextFunction, Request, Response } from 'express';
import { apiError } from '../i18n/errorCodes.js';

interface RateEntry {
  count: number;
  resetAt: number;
}

const entries = new Map<string, RateEntry>();

function removeExpiredEntries(now: number) {
  if (entries.size < 10_000) return;
  for (const [key, entry] of entries) {
    if (entry.resetAt <= now) entries.delete(key);
  }
}

export function socialRateLimit(options: {
  action: string;
  max: number;
  windowMs: number;
}) {
  return (_req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    removeExpiredEntries(now);
    const userId = String(res.locals.user?._id ?? 'anonymous');
    const key = `${options.action}:${userId}`;
    const current = entries.get(key);

    if (!current || current.resetAt <= now) {
      entries.set(key, { count: 1, resetAt: now + options.windowMs });
      return next();
    }

    if (current.count >= options.max) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((current.resetAt - now) / 1000)
      );
      res.setHeader('Retry-After', String(retryAfterSeconds));
      return next(
        apiError(
          'social.rateLimited',
          429,
          'Too many social actions. Please try again shortly.',
          { retryAfterSeconds }
        )
      );
    }

    current.count += 1;
    return next();
  };
}

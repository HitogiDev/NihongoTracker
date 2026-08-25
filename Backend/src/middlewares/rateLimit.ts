import { NextFunction, Request, Response } from 'express';

import { apiError } from '../i18n/errorCodes.js';

/**
 * A per-user token bucket, in process.
 *
 * Deliberately not a dependency: the app runs as a single container, and one
 * `Map` does the job without adding a package. The cost of that choice is that
 * the budget is per replica — if the API is ever scaled out, this has to move
 * to Redis or Mongo, and each replica will meanwhile allow the full rate.
 */
export interface RateLimitOptions {
  /** Requests allowed per window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
  /** Distinguishes buckets when several limiters coexist. */
  name: string;
}

interface Bucket {
  count: number;
  resetAt: number;
}

export function rateLimitPerUser({ limit, windowMs, name }: RateLimitOptions) {
  const buckets = new Map<string, Bucket>();
  let lastSweep = Date.now();

  /** Drop expired buckets occasionally, so the map cannot grow without bound. */
  const sweep = (now: number) => {
    if (now - lastSweep < windowMs) return;
    lastSweep = now;
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key);
    }
  };

  return (req: Request, res: Response, next: NextFunction) => {
    const userId = res.locals.user?._id?.toString();
    // `protect` runs first, so an anonymous request should not reach here. If
    // one does, fall back to the connection rather than sharing one bucket
    // between every anonymous caller.
    const key = `${name}:${userId ?? req.ip ?? 'unknown'}`;

    const now = Date.now();
    sweep(now);

    const bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      res.setHeader('X-RateLimit-Limit', limit);
      res.setHeader('X-RateLimit-Remaining', limit - 1);
      return next();
    }

    bucket.count += 1;
    if (bucket.count > limit) {
      const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
      res.setHeader('Retry-After', retryAfter);
      res.setHeader('X-RateLimit-Limit', limit);
      res.setHeader('X-RateLimit-Remaining', 0);
      return next(
        apiError('common.tooManyRequests', 429, 'Too many requests, slow down')
      );
    }

    res.setHeader('X-RateLimit-Limit', limit);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, limit - bucket.count));
    return next();
  };
}

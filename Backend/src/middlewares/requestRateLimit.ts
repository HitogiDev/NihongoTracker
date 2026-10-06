import { NextFunction, Request, Response } from 'express';
import { customError } from './errorMiddleware.js';

export function requestRateLimit(max: number, windowMs: number) {
  const entries = new Map<string, { count: number; resetAt: number }>();
  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    if (entries.size >= 10_000) {
      for (const [key, entry] of entries) {
        if (entry.resetAt <= now) entries.delete(key);
      }
    }
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    let entry = entries.get(key);
    if (entry && entry.resetAt <= now) {
      entries.delete(key);
      entry = undefined;
    }
    if ((!entry && entries.size >= 10_000) || (entry && entry.count >= max)) {
      res.setHeader(
        'Retry-After',
        String(Math.ceil(((entry?.resetAt ?? now + windowMs) - now) / 1000))
      );
      return next(
        new customError('Too many requests. Please try again later.', 429)
      );
    }
    if (entry) entry.count += 1;
    else entries.set(key, { count: 1, resetAt: now + windowMs });
    return next();
  };
}

import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import User from '../models/user.model.js';
import ApiKey from '../models/apiKey.model.js';
import { Request, Response, NextFunction } from 'express';
import { customError } from '../middlewares/errorMiddleware.js';
import { decodedJWT } from '../types.js';

function hashKey(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

async function loadAndValidateUser(userId: string) {
  const user = await User.findById(userId).select('-password');

  // Auto-expire manually-granted patreon tiers
  if (
    user?.patreon?.manualTierExpiry &&
    new Date() > user.patreon.manualTierExpiry
  ) {
    user.patreon.tier = null;
    user.patreon.isActive = false;
    user.patreon.manualTierExpiry = undefined;
    await user.save();
  }

  if (user?.moderation?.banned) {
    throw new customError(
      user.moderation?.banReason || 'Your account has been banned',
      403
    );
  }

  return user;
}

export async function protect(req: Request, res: Response, next: NextFunction) {
  // 1. Try API key authentication first
  const apiKeyHeader = req.headers['x-api-key'] as string | undefined;
  if (apiKeyHeader) {
    try {
      const hashedKey = hashKey(apiKeyHeader);
      const apiKey = await ApiKey.findOne({ key: hashedKey });

      if (!apiKey) {
        return next(new customError('Invalid API key', 401));
      }

      // Check expiration
      if (apiKey.expiresAt && new Date() > apiKey.expiresAt) {
        await ApiKey.deleteOne({ _id: apiKey._id });
        return next(new customError('API key has expired', 401));
      }

      const user = await loadAndValidateUser(apiKey.user.toString());
      if (!user) {
        return next(new customError('User not found', 401));
      }

      res.locals.user = user;

      // Update lastUsedAt (fire-and-forget, don't block the request)
      ApiKey.updateOne(
        { _id: apiKey._id },
        { lastUsedAt: new Date() }
      ).exec();

      return next();
    } catch (error) {
      if (error instanceof customError) {
        return next(error);
      }
      return next(new customError('API key authentication failed', 401));
    }
  }

  // 2. Fall back to JWT cookie authentication
  const token = req.cookies.jwt;
  if (!token) {
    return next(new customError('Unauthorized, no token', 401));
  }
  try {
    const decoded = jwt.verify(token, process.env.TOKEN_SECRET!);
    const user = await loadAndValidateUser(
      (decoded as decodedJWT).id.toString()
    );

    res.locals.user = user;
    return next();
  } catch (error) {
    res.clearCookie('jwt');
    return next(error);
  }
}


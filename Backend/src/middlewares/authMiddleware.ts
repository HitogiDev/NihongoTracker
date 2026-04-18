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

async function authenticateRequest(
  req: Request,
  res: Response,
  {
    failOnMissingCredentials,
    failOnInvalidCredentials,
  }: {
    failOnMissingCredentials: boolean;
    failOnInvalidCredentials: boolean;
  }
) {
  // 1. Try API key authentication first
  const apiKeyHeader = req.headers['x-api-key'] as string | undefined;
  if (apiKeyHeader) {
    try {
      const hashedKey = hashKey(apiKeyHeader);
      const apiKey = await ApiKey.findOne({ key: hashedKey });

      if (!apiKey) {
        if (failOnInvalidCredentials) {
          throw new customError('Invalid API key', 401);
        }
        return null;
      }

      // Check expiration
      if (apiKey.expiresAt && new Date() > apiKey.expiresAt) {
        await ApiKey.deleteOne({ _id: apiKey._id });
        if (failOnInvalidCredentials) {
          throw new customError('API key has expired', 401);
        }
        return null;
      }

      const user = await loadAndValidateUser(apiKey.user.toString());
      if (!user) {
        if (failOnInvalidCredentials) {
          throw new customError('User not found', 401);
        }
        return null;
      }

      // Update lastUsedAt (fire-and-forget, don't block the request)
      ApiKey.updateOne({ _id: apiKey._id }, { lastUsedAt: new Date() }).exec();

      return user;
    } catch (error) {
      if (failOnInvalidCredentials) {
        throw error;
      }
      return null;
    }
  }

  // 2. Fall back to JWT cookie authentication
  const token = req.cookies.jwt;
  if (!token) {
    if (failOnMissingCredentials) {
      throw new customError('Unauthorized, no token', 401);
    }
    return null;
  }

  try {
    const decoded = jwt.verify(token, process.env.TOKEN_SECRET!);
    const user = await loadAndValidateUser(
      (decoded as decodedJWT).id.toString()
    );
    return user;
  } catch (error) {
    res.clearCookie('jwt');
    if (failOnInvalidCredentials) {
      throw error;
    }
    return null;
  }
}

export async function protect(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await authenticateRequest(req, res, {
      failOnMissingCredentials: true,
      failOnInvalidCredentials: true,
    });

    if (!user) {
      return next(new customError('Unauthorized', 401));
    }

    res.locals.user = user;
    return next();
  } catch (error) {
    if (error instanceof customError) {
      return next(error);
    }

    return next(new customError('Authentication failed', 401));
  }
}

export async function optionalProtect(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const user = await authenticateRequest(req, res, {
      failOnMissingCredentials: false,
      failOnInvalidCredentials: false,
    });

    if (user) {
      res.locals.user = user;
    }

    return next();
  } catch (_error) {
    return next();
  }
}

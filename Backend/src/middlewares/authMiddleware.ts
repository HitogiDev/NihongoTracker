import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import User from '../models/user.model.js';
import ApiKey from '../models/apiKey.model.js';
import MobileSession from '../models/mobileSession.model.js';
import { customError } from '../middlewares/errorMiddleware.js';
import { apiError } from '../i18n/errorCodes.js';
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
    throw apiError(
      'auth.banned',
      403,
      user.moderation?.banReason || 'Your account has been banned'
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
          throw apiError('apiKey.invalid', 401, 'Invalid API key');
        }
        return null;
      }

      // Check expiration
      if (apiKey.expiresAt && new Date() > apiKey.expiresAt) {
        await ApiKey.deleteOne({ _id: apiKey._id });
        if (failOnInvalidCredentials) {
          throw apiError('apiKey.expired', 401, 'API key has expired');
        }
        return null;
      }

      const user = await loadAndValidateUser(apiKey.user.toString());
      if (!user) {
        if (failOnInvalidCredentials) {
          throw apiError('user.notFound', 401, 'User not found');
        }
        return null;
      }

      // Update lastUsedAt (fire-and-forget, do not block the request)
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
  const bearerToken = req.headers.authorization?.match(/^Bearer (\S+)$/i)?.[1];
  const token = bearerToken || req.cookies.jwt;
  if (!token) {
    if (failOnMissingCredentials) {
      throw apiError('auth.noToken', 401, 'Unauthorized, no token');
    }
    return null;
  }

  try {
    const decoded = jwt.verify(token, process.env.TOKEN_SECRET!) as decodedJWT & {
      sid?: string;
    };
    if (bearerToken && !decoded.sid) {
      throw apiError('auth.invalidToken', 401, 'Invalid mobile session');
    }
    if (decoded.sid) {
      const activeSession = await MobileSession.exists({
        _id: decoded.sid,
        user: decoded.id,
        expiresAt: { $gt: new Date() },
      });
      if (!activeSession) {
        throw apiError('auth.invalidToken', 401, 'Mobile session expired');
      }
      res.locals.mobileSessionId = decoded.sid;
    }
    const user = await loadAndValidateUser(decoded.id.toString());
    return user;
  } catch (error) {
    if (!bearerToken) res.clearCookie('jwt');
    if (failOnInvalidCredentials) {
      throw error;
    }
    return null;
  }
}

export function requireMobileSession(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  if (typeof res.locals.mobileSessionId !== 'string') {
    return next(apiError('auth.invalidToken', 401, 'Mobile session required'));
  }
  return next();
}

export async function protect(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await authenticateRequest(req, res, {
      failOnMissingCredentials: true,
      failOnInvalidCredentials: true,
    });

    if (!user) {
      return next(apiError('auth.notAuthenticated', 401, 'Unauthorized'));
    }

    res.locals.user = user;
    return next();
  } catch (error) {
    if (error instanceof customError) {
      return next(error);
    }

    return next(apiError('auth.failed', 401, 'Authentication failed'));
  }
}

export function requireSessionAuth(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  if (req.headers['x-api-key']) {
    return next(
      apiError(
        'auth.forbidden',
        403,
        'API keys cannot access this endpoint'
      )
    );
  }

  return next();
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

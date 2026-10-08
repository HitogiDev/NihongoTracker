import { createHash, randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import MobileSession from '../models/mobileSession.model.js';
import User from '../models/user.model.js';
import { apiError } from '../i18n/errorCodes.js';

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export function hashMobileRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function createMobileAccessToken(userId: string, sessionId: string) {
  const secret = process.env.TOKEN_SECRET;
  if (!secret) {
    throw apiError('integration.privateKeyNotSet', 500, 'Private key is not set');
  }
  return jwt.sign({ id: userId, sid: sessionId }, secret, { expiresIn: '15m' });
}

export async function createMobileSession(userId: string) {
  const refreshToken = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const session = await MobileSession.create({
    user: new Types.ObjectId(userId),
    refreshTokenHash: hashMobileRefreshToken(refreshToken),
    expiresAt,
  });

  return {
    accessToken: createMobileAccessToken(userId, session._id.toString()),
    refreshToken,
    sessionId: session._id.toString(),
    expiresAt,
  };
}

export async function rotateMobileSession(
  sessionId: string,
  refreshToken: string
) {
  if (!Types.ObjectId.isValid(sessionId) || !refreshToken) return null;

  const nextRefreshToken = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const session = await MobileSession.findOneAndUpdate(
    {
      _id: sessionId,
      refreshTokenHash: hashMobileRefreshToken(refreshToken),
      expiresAt: { $gt: new Date() },
    },
    { $set: { refreshTokenHash: hashMobileRefreshToken(nextRefreshToken), expiresAt } },
    { new: true }
  ).select('+refreshTokenHash');

  if (!session) return null;
  const user = await User.findById(session.user).select('moderation.banned');
  if (!user || user.moderation?.banned) {
    await MobileSession.deleteOne({ _id: session._id });
    return null;
  }

  return {
    accessToken: createMobileAccessToken(
      session.user.toString(),
      session._id.toString()
    ),
    refreshToken: nextRefreshToken,
    sessionId: session._id.toString(),
    expiresAt,
  };
}

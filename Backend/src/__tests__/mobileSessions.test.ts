import { beforeEach, describe, expect, it, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import { createMobileSession, hashMobileRefreshToken, rotateMobileSession } from '../services/mobileSessions.service.js';

const mocks = vi.hoisted(() => ({ create: vi.fn(), rotate: vi.fn(), user: vi.fn(), remove: vi.fn() }));
vi.mock('../models/mobileSession.model.js', () => ({ default: { create: mocks.create, findOneAndUpdate: mocks.rotate, deleteOne: mocks.remove } }));
vi.mock('../models/user.model.js', () => ({ default: { findById: mocks.user } }));

const userId = new Types.ObjectId();
const sessionId = new Types.ObjectId();
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('TOKEN_SECRET', 'mobile-test-secret');
  mocks.user.mockReturnValue({ select: vi.fn().mockResolvedValue({ moderation: { banned: false } }) });
});

describe('mobile sessions', () => {
  it('stores a refresh hash and issues a short-lived access token bound to the session', async () => {
    mocks.create.mockResolvedValue({ _id: sessionId });
    const result = await createMobileSession(userId.toString());
    expect(result.refreshToken).toMatch(/^[a-zA-Z0-9_-]{43}$/);
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ user: userId, refreshTokenHash: hashMobileRefreshToken(result.refreshToken) }));
    const decoded = jwt.verify(result.accessToken, 'mobile-test-secret') as jwt.JwtPayload;
    expect(decoded).toMatchObject({ id: userId.toString(), sid: sessionId.toString() });
    expect(decoded.exp! - decoded.iat!).toBe(900);
  });

  it('atomically consumes the old refresh hash and rejects its reuse', async () => {
    const select = vi.fn().mockResolvedValueOnce({ _id: sessionId, user: userId }).mockResolvedValueOnce(null);
    mocks.rotate.mockReturnValue({ select });
    const first = await rotateMobileSession(sessionId.toString(), 'old-token');
    const retry = await rotateMobileSession(sessionId.toString(), 'old-token');
    expect(first?.refreshToken).not.toBe('old-token');
    expect(retry).toBeNull();
    expect(mocks.rotate).toHaveBeenCalledWith({ _id: sessionId.toString(), refreshTokenHash: hashMobileRefreshToken('old-token'), expiresAt: { $gt: expect.any(Date) } }, expect.objectContaining({ $set: { refreshTokenHash: expect.any(String), expiresAt: expect.any(Date) } }), { new: true });
  });

  it('revokes a banned account session before issuing fresh credentials', async () => {
    mocks.rotate.mockReturnValue({ select: vi.fn().mockResolvedValue({ _id: sessionId, user: userId }) });
    mocks.user.mockReturnValue({ select: vi.fn().mockResolvedValue({ moderation: { banned: true } }) });
    expect(await rotateMobileSession(sessionId.toString(), 'token')).toBeNull();
    expect(mocks.remove).toHaveBeenCalledWith({ _id: sessionId });
  });

  it('rejects malformed identifiers without querying the database', async () => {
    expect(await rotateMobileSession('invalid', 'token')).toBeNull();
    expect(mocks.rotate).not.toHaveBeenCalled();
  });
});

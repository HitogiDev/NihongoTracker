import { Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { getCurrentUser } from '../controllers/currentUser.controller.js';
import { requireSessionAuth } from '../middlewares/authMiddleware.js';

describe('authentication endpoint boundaries', () => {
  it('rejects API keys on session-only endpoints', () => {
    const req = {
      headers: { 'x-api-key': 'ntk_test' },
    } as unknown as Request;
    const res = {} as Response;
    const next = vi.fn();

    requireSessionAuth(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(next.mock.calls[0][0]).toMatchObject({
      code: 'auth.forbidden',
      statusCode: 403,
    });
  });

  it('allows cookie authentication to continue on session-only endpoints', () => {
    const req = { headers: {} } as Request;
    const res = {} as Response;
    const next = vi.fn();

    requireSessionAuth(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('returns the authenticated user from the current-user endpoint', () => {
    const user = {
      _id: 'user-id',
      username: 'tanuki',
      email: 'tanuki@example.com',
      verified: true,
      about: 'Reading every day',
      stats: { userLevel: 4 },
      avatar: '/avatar.png',
      banner: '/banner.png',
      titles: ['Reader'],
      roles: ['user'],
      settings: { timezone: 'UTC' },
      discordId: undefined,
      patreon: { tier: null, isActive: false },
      moderation: { banned: false },
      customization: undefined,
      password: 'must-not-leak',
    };
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    const res = {
      locals: { user },
      status,
    } as unknown as Response;

    getCurrentUser({} as Request, res);

    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith({
      _id: 'user-id',
      username: 'tanuki',
      email: 'tanuki@example.com',
      verified: true,
      about: 'Reading every day',
      stats: { userLevel: 4 },
      avatar: '/avatar.png',
      banner: '/banner.png',
      titles: ['Reader'],
      roles: ['user'],
      settings: { timezone: 'UTC' },
      discordId: '',
      patreon: { tier: null, isActive: false },
      moderation: { banned: false },
      customization: {},
    });
  });
});

import { describe, expect, it, vi } from 'vitest';
import { socialRateLimit } from '../middlewares/socialRateLimit.js';

describe('social rate limiter', () => {
  it('allows actions up to the limit and then returns a retry hint', () => {
    const middleware = socialRateLimit({
      action: `test-${Math.random()}`,
      max: 2,
      windowMs: 60_000,
    });
    const request = {} as never;
    const setHeader = vi.fn();
    const response = {
      locals: { user: { _id: 'user-1' } },
      setHeader,
    } as never;
    const next = vi.fn();

    middleware(request, response, next);
    middleware(request, response, next);
    middleware(request, response, next);

    expect(next).toHaveBeenCalledTimes(3);
    expect(next.mock.calls[0]).toEqual([]);
    expect(next.mock.calls[1]).toEqual([]);
    expect(next.mock.calls[2]?.[0]).toMatchObject({
      statusCode: 429,
      code: 'social.rateLimited',
    });
    expect(setHeader).toHaveBeenCalledWith('Retry-After', expect.any(String));
  });
});

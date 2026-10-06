import { Request, Response } from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { requestRateLimit } from '../middlewares/requestRateLimit.js';

afterEach(() => vi.useRealTimers());
describe('request rate limiting', () => {
  it('limits attempts, isolates addresses, and resets the window', () => {
    vi.useFakeTimers();
    const limit = requestRateLimit(2, 60_000);
    const request = { ip: '192.0.2.1' } as Request;
    const response = { setHeader: vi.fn() } as unknown as Response;
    const next = vi.fn();
    limit(request, response, next);
    limit(request, response, next);
    limit(request, response, next);
    expect(next.mock.calls[2][0]).toMatchObject({ statusCode: 429 });
    expect(response.setHeader).toHaveBeenCalledWith('Retry-After', '60');
    limit({ ip: '192.0.2.2' } as Request, response, next);
    expect(next.mock.calls[3]).toEqual([]);
    vi.advanceTimersByTime(60_000);
    limit(request, response, next);
    expect(next.mock.calls[4]).toEqual([]);
  });
});

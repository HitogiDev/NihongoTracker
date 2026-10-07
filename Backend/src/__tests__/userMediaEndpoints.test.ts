import { Types } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getUserMediaReviews } from '../controllers/media.controller.js';
import { getUserMediaLists } from '../controllers/mediaList.controller.js';
import userRoutes from '../routes/user.routes.js';

const mocks = vi.hoisted(() => ({
  userFindOne: vi.fn(),
  reviewFind: vi.fn(),
  reviewCount: vi.fn(),
  listFind: vi.fn(),
}));

vi.mock('../models/user.model.js', () => ({
  default: { findOne: mocks.userFindOne },
}));
vi.mock('../models/mediaReview.model.js', () => ({
  default: { find: mocks.reviewFind, countDocuments: mocks.reviewCount },
}));
vi.mock('../models/mediaList.model.js', () => ({
  default: { find: mocks.listFind },
}));
vi.mock('../services/meilisearch/meiliClient.js', () => ({ default: {} }));

const ownerId = new Types.ObjectId();

function response(viewerId?: Types.ObjectId) {
  const res = {
    locals: { user: viewerId ? { _id: viewerId } : undefined },
    status: vi.fn(),
    json: vi.fn(),
  };
  res.status.mockReturnValue(res);
  return res;
}

function request(query: Record<string, string> = {}) {
  return { params: { username: 'reader' }, query };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.userFindOne.mockReturnValue({
    select: () => ({ lean: () => Promise.resolve({ _id: ownerId }) }),
  });
  mocks.reviewCount.mockResolvedValue(0);
});

describe('user media endpoints', () => {
  it('registers both user routes with optional authentication', () => {
    for (const path of ['/:username/reviews', '/:username/lists']) {
      const route = userRoutes.stack.find((layer) => layer.route?.path === path)?.route;
      expect(route?.stack.map((layer: { method: string }) => layer.method)).toEqual(['get', 'get']);
      expect(route?.stack.map((layer: { name: string }) => layer.name)).toEqual([
        'optionalProtect',
        path.endsWith('/reviews') ? 'getUserMediaReviews' : 'getUserMediaLists',
      ]);
    }
  });

  it('returns only the requested author reviews with pagination', async () => {
    const reviews = [{ _id: new Types.ObjectId(), mediaContentId: 'anime-1' }];
    const chain = {
      populate: vi.fn().mockReturnThis(),
      sort: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue(reviews),
    };
    mocks.reviewFind.mockReturnValue(chain);
    mocks.reviewCount.mockResolvedValue(45);
    const res = response();
    const next = vi.fn();

    await getUserMediaReviews(request({ page: '2', limit: '10' }) as never, res as never, next);

    expect(mocks.reviewFind).toHaveBeenCalledWith({ user: ownerId });
    expect(mocks.reviewCount).toHaveBeenCalledWith({ user: ownerId });
    expect(chain.populate).toHaveBeenCalledWith('user', 'username avatar');
    expect(chain.sort).toHaveBeenCalledWith({ createdAt: -1, _id: -1 });
    expect(chain.skip).toHaveBeenCalledWith(10);
    expect(chain.limit).toHaveBeenCalledWith(10);
    expect(res.json).toHaveBeenCalledWith({ reviews, total: 45, page: 2, limit: 10, hasMore: true });
    expect(next).not.toHaveBeenCalled();
  });

  it.each([
    [{}, 1, 20],
    [{ page: '-5', limit: '500' }, 1, 50],
    [{ page: 'bad', limit: 'bad' }, 1, 20],
    [{ limit: '-1' }, 1, 1],
  ])('bounds review pagination for %j', async (query, page, limit) => {
    mocks.reviewFind.mockReturnValue({
      populate: () => ({ sort: () => ({ skip: () => ({ limit: () => Promise.resolve([]) }) }) }),
    });
    const res = response();
    await getUserMediaReviews(request(query) as never, res as never, vi.fn());
    expect(res.json).toHaveBeenCalledWith({ reviews: [], total: 0, page, limit, hasMore: false });
  });

  it.each([getUserMediaReviews, getUserMediaLists])('returns 404 for a missing user', async (handler) => {
    mocks.userFindOne.mockReturnValue({ select: () => ({ lean: () => Promise.resolve(null) }) });
    const res = response();
    const next = vi.fn();
    await handler(request() as never, res as never, next);
    if (handler === getUserMediaReviews) {
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404 }));
    } else {
      expect(res.status).toHaveBeenCalledWith(404);
    }
    expect(mocks.reviewFind).not.toHaveBeenCalled();
    expect(mocks.listFind).not.toHaveBeenCalled();
  });

  it('forwards database failures to the error handler', async () => {
    const error = new Error('Database unavailable');
    mocks.userFindOne.mockReturnValue({ select: () => ({ lean: () => Promise.reject(error) }) });
    const next = vi.fn();
    await getUserMediaReviews(request() as never, response() as never, next);
    expect(next).toHaveBeenCalledWith(error);
  });

  it.each([
    [undefined, true],
    [new Types.ObjectId(), true],
    [ownerId, false],
  ])('keeps private lists visible only to their owner (%s)', async (viewerId, publicOnly) => {
    const list = {
      _id: new Types.ObjectId(),
      user: { _id: ownerId, username: 'reader' },
      title: 'Favorite works',
      entries: [],
      likes: viewerId ? [viewerId] : [],
    };
    mocks.listFind.mockReturnValue({ populate: () => ({ sort: () => Promise.resolve([list]) }) });
    const res = response(viewerId);
    const next = vi.fn();
    await getUserMediaLists(request() as never, res as never, next);
    expect(mocks.listFind).toHaveBeenCalledWith({ user: ownerId, ...(publicOnly ? { isPublic: true } : {}) });
    expect(res.json).toHaveBeenCalledWith({
      lists: [expect.objectContaining({ title: 'Favorite works', entryCount: 0, preview: [], isLiked: !!viewerId })],
    });
    expect(next).not.toHaveBeenCalled();
  });
});

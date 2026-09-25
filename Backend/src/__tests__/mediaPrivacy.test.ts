import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';

const mocks = vi.hoisted(() => ({
  logAggregate: vi.fn(),
  logDistinct: vi.fn(),
  userFind: vi.fn(),
  followFind: vi.fn(),
}));

vi.mock('../models/log.model.js', () => ({
  default: {
    aggregate: mocks.logAggregate,
    distinct: mocks.logDistinct,
  },
}));
vi.mock('../models/user.model.js', () => ({
  default: { find: mocks.userFind },
}));
vi.mock('../models/follow.model.js', () => ({
  default: { find: mocks.followFind },
}));
vi.mock('../services/meilisearch/mediaIndex.js', () => ({
  addMediaToIndex: vi.fn(),
}));

let getGlobalMediaStats: typeof import('../controllers/logs.controller.js').getGlobalMediaStats;
let getRecentMediaLogs: typeof import('../controllers/logs.controller.js').getRecentMediaLogs;

beforeAll(async () => {
  const controller = await import('../controllers/logs.controller.js');
  getGlobalMediaStats = controller.getGlobalMediaStats;
  getRecentMediaLogs = controller.getRecentMediaLogs;
}, 30000);

function response(viewerId: Types.ObjectId) {
  const result = {
    locals: { user: { _id: viewerId } },
    status: vi.fn(),
    json: vi.fn(),
  };
  result.status.mockReturnValue(result);
  return result;
}

describe('media community log privacy', () => {
  const viewerId = new Types.ObjectId();
  const publicOwner = new Types.ObjectId();
  const followersOnlyOwner = new Types.ObjectId();
  const privateOwner = new Types.ObjectId();

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.logDistinct.mockResolvedValue([
      publicOwner,
      followersOnlyOwner,
      privateOwner,
    ]);
    mocks.followFind.mockReturnValue({ distinct: () => Promise.resolve([]) });
    mocks.userFind.mockReturnValue({
      select: () => ({
        lean: () =>
          Promise.resolve([
            {
              _id: publicOwner,
              settings: {
                socialPrivacy: {
                  immersionActivity: 'public',
                  statistics: 'public',
                },
              },
            },
            {
              _id: followersOnlyOwner,
              settings: {
                socialPrivacy: {
                  immersionActivity: 'followers',
                  statistics: 'followers',
                },
              },
            },
            {
              _id: privateOwner,
              settings: {
                socialPrivacy: {
                  immersionActivity: 'private',
                  statistics: 'private',
                },
              },
            },
          ]),
      }),
    });
    mocks.logAggregate.mockResolvedValue([]);
  });

  it.each([
    ['aggregate statistics', 'stats'],
    ['recent media logs', 'recent'],
  ] as const)('excludes private and non-followed logs from %s', async (_label, kind) => {
    const handler = kind === 'stats' ? getGlobalMediaStats : getRecentMediaLogs;
    const res = response(viewerId);
    await handler(
      {
        query: { mediaId: 'media-1', type: 'anime', limit: '10' },
      } as never,
      res as never,
      vi.fn()
    );

    const pipeline = mocks.logAggregate.mock.calls[0]?.[0] as Array<{
      $match?: { $and?: Array<Record<string, unknown>> };
    }>;
    const visibility = pipeline[0]?.$match?.$and?.[1];
    expect(visibility).toMatchObject({
      user: { $in: [publicOwner] },
      $or: [{ user: viewerId }, { private: { $ne: true } }],
    });
  });
});

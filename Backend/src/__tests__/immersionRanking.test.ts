import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';

const mocks = vi.hoisted(() => ({
  logAggregate: vi.fn(),
  logDistinct: vi.fn(),
  userFind: vi.fn(),
  userFindOne: vi.fn(),
  mediaStatusFind: vi.fn(),
  canView: vi.fn(),
  visibleOwnerIds: vi.fn(),
}));

vi.mock('../models/log.model.js', () => ({
  default: {
    aggregate: mocks.logAggregate,
    distinct: mocks.logDistinct,
  },
}));

vi.mock('../models/user.model.js', () => ({
  default: {
    find: mocks.userFind,
    findOne: mocks.userFindOne,
  },
}));

vi.mock('../models/userMediaStatus.model.js', () => ({
  default: {
    find: mocks.mediaStatusFind,
  },
}));

vi.mock('../services/socialVisibility.service.js', () => ({
  canViewUserSocialCategory: mocks.canView,
  getRankingAudienceUserIds: vi.fn(),
  getVisibleSocialOwnerIds: mocks.visibleOwnerIds,
}));

let getGlobalImmersionRanking: typeof import('../controllers/users.controller.js').getGlobalImmersionRanking;
let getGanttData: typeof import('../controllers/users.controller.js').getGanttData;

beforeAll(async () => {
  const controller = await import('../controllers/users.controller.js');
  getGlobalImmersionRanking = controller.getGlobalImmersionRanking;
  getGanttData = controller.getGanttData;
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

describe('global immersion ranking', () => {
  const viewerId = new Types.ObjectId();
  const visibleOwner = new Types.ObjectId();

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.logDistinct.mockResolvedValue([visibleOwner]);
    mocks.visibleOwnerIds.mockResolvedValue([visibleOwner]);
    mocks.userFind.mockReturnValue({
      distinct: vi.fn().mockResolvedValue([visibleOwner]),
    });
    mocks.userFindOne.mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        _id: visibleOwner,
        settings: { timezone: 'UTC' },
      }),
    });
    mocks.mediaStatusFind.mockReturnValue({
      lean: vi.fn().mockResolvedValue([]),
    });
    mocks.canView.mockResolvedValue(true);
    mocks.logAggregate.mockResolvedValue([
      {
        mediaId: 'media-3',
        type: 'anime',
        title: 'Third',
        totalHours: 8,
        totalXp: 100,
        userCount: 2,
        logCount: 4,
      },
      {
        mediaId: 'media-4',
        type: 'anime',
        title: 'Fourth',
        totalHours: 7,
        totalXp: 90,
        userCount: 1,
        logCount: 2,
      },
      {
        mediaId: 'media-5',
        type: 'anime',
        title: 'Fifth',
        totalHours: 6,
        totalXp: 80,
        userCount: 1,
        logCount: 1,
      },
    ]);
  });

  it('applies filters, privacy owners, metric pagination, and ranks', async () => {
    const res = response(viewerId);

    await getGlobalImmersionRanking(
      {
        query: {
          metric: 'hours',
          type: ['anime'],
          page: '2',
          limit: '2',
          start: '2026-01-01',
          end: '2026-01-31',
          timezone: 'UTC',
        },
      } as never,
      res as never,
      vi.fn()
    );

    expect(mocks.visibleOwnerIds).toHaveBeenCalledWith({
      ownerIds: [visibleOwner],
      viewerId,
      category: 'statistics',
    });
    expect(mocks.userFind).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: { $in: [visibleOwner] },
        $or: expect.any(Array),
      })
    );

    const pipeline = mocks.logAggregate.mock.calls[0]?.[0] as Array<
      Record<string, unknown>
    >;
    expect(pipeline[0]).toMatchObject({
      $match: {
        type: { $in: ['anime'] },
        private: { $ne: true },
        unknownDate: { $ne: true },
        user: { $in: [visibleOwner] },
      },
    });
    expect(pipeline[pipeline.length - 2]).toEqual({ $skip: 2 });
    expect(pipeline[pipeline.length - 1]).toEqual({ $limit: 3 });

    expect(res.json).toHaveBeenCalledWith({
      page: 2,
      limit: 2,
      hasNextPage: true,
      items: [
        {
          rank: 3,
          mediaId: 'media-3',
          type: 'anime',
          title: 'Third',
          totalHours: 8,
          totalXp: 100,
          userCount: 2,
          logCount: 4,
        },
        {
          rank: 4,
          mediaId: 'media-4',
          type: 'anime',
          title: 'Fourth',
          totalHours: 7,
          totalXp: 90,
          userCount: 1,
          logCount: 2,
        },
      ],
    });
  });

  it('uses the anime episode fallback when personal hours have no time value', async () => {
    mocks.logAggregate.mockResolvedValue([]);
    const res = response(viewerId);

    await getGanttData(
      {
        params: { username: 'tester' },
        query: { timezone: 'UTC' },
      } as never,
      res as never,
      vi.fn()
    );

    const pipeline = mocks.logAggregate.mock.calls[0]?.[0] as Array<
      Record<string, unknown>
    >;
    const groupStage = pipeline.find((stage) => stage.$group) as {
      $group: { totalTime: { $sum: { $cond: unknown[] } } };
    };
    const condition = groupStage.$group.totalTime.$sum.$cond;

    expect(condition[1]).toEqual({ $multiply: ['$episodes', 24] });
    expect(condition[2]).toEqual({ $ifNull: ['$time', 0] });
  });
});

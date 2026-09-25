import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';

const mocks = vi.hoisted(() => ({
  clubFindById: vi.fn(),
  logAggregate: vi.fn(),
  logFind: vi.fn(),
  logCountDocuments: vi.fn(),
  userFind: vi.fn(),
  followFind: vi.fn(),
}));

vi.mock('../models/club.model.js', () => ({
  Club: { findById: mocks.clubFindById },
}));
vi.mock('../models/log.model.js', () => ({
  default: {
    aggregate: mocks.logAggregate,
    find: mocks.logFind,
    countDocuments: mocks.logCountDocuments,
  },
}));
vi.mock('../models/user.model.js', () => ({
  default: { find: mocks.userFind },
}));
vi.mock('../models/follow.model.js', () => ({
  default: { find: mocks.followFind },
}));
vi.mock('../models/media.model.js', () => ({ MediaBase: {} }));

let getClubMediaLogs: typeof import('../controllers/club.controller.js').getClubMediaLogs;
let getClubMediaRankings: typeof import('../controllers/club.controller.js').getClubMediaRankings;
let getClubMediaStats: typeof import('../controllers/club.controller.js').getClubMediaStats;
let getClubMemberRankings: typeof import('../controllers/club.controller.js').getClubMemberRankings;
let getClubRecentActivity: typeof import('../controllers/club.controller.js').getClubRecentActivity;

beforeAll(async () => {
  const controller = await import('../controllers/club.controller.js');
  getClubMediaLogs = controller.getClubMediaLogs;
  getClubMediaRankings = controller.getClubMediaRankings;
  getClubMediaStats = controller.getClubMediaStats;
  getClubMemberRankings = controller.getClubMemberRankings;
  getClubRecentActivity = controller.getClubRecentActivity;
}, 30000);

function createResponse(viewerId: Types.ObjectId) {
  const response = {
    locals: { user: { _id: viewerId } },
    status: vi.fn(),
    json: vi.fn(),
  };
  response.status.mockReturnValue(response);
  return response;
}

function createClub(ownerIds: Types.ObjectId[]) {
  return {
    _id: new Types.ObjectId(),
    members: ownerIds.map((user) => ({ user, status: 'active' })),
    currentMedia: [
      {
        _id: new Types.ObjectId(),
        mediaId: 'media-1',
        mediaType: 'anime',
        startDate: new Date('2024-01-01T00:00:00.000Z'),
        title: 'Test media',
      },
    ],
  };
}

function configureVisibility(
  publicOwner: Types.ObjectId,
  followerOnlyOwner: Types.ObjectId
) {
  mocks.userFind.mockReturnValue({
    select: () => ({
      lean: () =>
        Promise.resolve([
          {
            _id: publicOwner,
            settings: { socialPrivacy: { immersionActivity: 'public' } },
          },
          {
            _id: followerOnlyOwner,
            settings: { socialPrivacy: { immersionActivity: 'followers' } },
          },
        ]),
    }),
  });
  mocks.followFind.mockReturnValue({ distinct: () => Promise.resolve([]) });
}

function expectSafeLogFilter(filter: Record<string, unknown>, viewerId: Types.ObjectId, publicOwner: Types.ObjectId) {
  expect(filter).toMatchObject({
    user: { $in: [publicOwner] },
    $or: [{ user: viewerId }, { private: { $ne: true } }],
  });
}

describe('club immersion privacy regression', () => {
  const viewerId = new Types.ObjectId();
  const publicOwner = new Types.ObjectId();
  const followerOnlyOwner = new Types.ObjectId();

  beforeEach(() => {
    vi.clearAllMocks();
    configureVisibility(publicOwner, followerOnlyOwner);
    mocks.logAggregate.mockResolvedValue([]);
    mocks.logCountDocuments.mockResolvedValue(0);
    mocks.logFind.mockReturnValue({
      populate: vi.fn().mockReturnThis(),
      sort: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    });
  });

  it('filters private and followers-only logs from recent activity', async () => {
    const club = createClub([publicOwner, followerOnlyOwner]);
    mocks.clubFindById.mockResolvedValue(club);
    const response = createResponse(viewerId);

    await getClubRecentActivity(
      { params: { clubId: club._id.toString() }, query: {} } as never,
      response as never,
      vi.fn()
    );

    expectSafeLogFilter(mocks.logAggregate.mock.calls[0][0][0].$match, viewerId, publicOwner);
  });

  it('filters private and followers-only logs from club media logs', async () => {
    const club = createClub([publicOwner, followerOnlyOwner]);
    mocks.clubFindById.mockResolvedValue(club);
    const response = createResponse(viewerId);

    await getClubMediaLogs(
      {
        params: {
          clubId: club._id.toString(),
          mediaId: club.currentMedia[0]._id.toString(),
        },
        query: {},
      } as never,
      response as never,
      vi.fn()
    );

    expectSafeLogFilter(mocks.logFind.mock.calls[0][0], viewerId, publicOwner);
    expectSafeLogFilter(
      mocks.logCountDocuments.mock.calls[0][0],
      viewerId,
      publicOwner
    );
  });

  it.each([
    ['club media rankings', 'mediaRankings'],
    ['club media stats', 'mediaStats'],
    ['club rankings', 'memberRankings'],
  ] as const)('%s filters private and followers-only logs', async (_label, handlerKey) => {
    const handler = {
      mediaRankings: getClubMediaRankings,
      mediaStats: getClubMediaStats,
      memberRankings: getClubMemberRankings,
    }[handlerKey];
    const club = createClub([publicOwner, followerOnlyOwner]);
    const populatedClub = {
      ...club,
      members: club.members.map((member) => ({
        ...member,
        user: { _id: member.user, username: 'member', avatar: '' },
      })),
    };
    mocks.clubFindById.mockReturnValue({
      ...populatedClub,
      populate: () => Promise.resolve(populatedClub),
    });
    const response = createResponse(viewerId);
    const params = {
      clubId: club._id.toString(),
      mediaId: club.currentMedia[0]._id.toString(),
    };

    await handler(
      { params, query: {} } as never,
      response as never,
      vi.fn()
    );

    const pipeline = mocks.logAggregate.mock.calls[0][0] as Array<Record<string, unknown>>;
    const matchStage = pipeline.find((stage) => stage.$match)?.$match as Record<
      string,
      unknown
    >;
    expectSafeLogFilter(matchStage, viewerId, publicOwner);
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';
import { aggregateVisibleLogMetricByUser } from '../services/clubLogMetrics.service.js';

const mocks = vi.hoisted(() => ({
  aggregate: vi.fn(),
  visibleFilter: vi.fn(),
}));

vi.mock('../models/log.model.js', () => ({
  default: { aggregate: mocks.aggregate },
}));
vi.mock('../services/socialVisibility.service.js', () => ({
  buildVisibleImmersionLogFilter: mocks.visibleFilter,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.aggregate.mockResolvedValue([]);
});

describe('club log metric aggregation', () => {
  it('builds challenge progress from persisted logs under the centralized visibility filter', async () => {
    const participant = new Types.ObjectId();
    const viewer = new Types.ObjectId();
    const startDate = new Date('2026-01-01T00:00:00.000Z');
    const endDate = new Date('2026-01-31T23:59:59.999Z');
    const privacyFilter = { user: { $in: [participant] }, private: { $ne: true } };
    mocks.visibleFilter.mockResolvedValue(privacyFilter);

    await aggregateVisibleLogMetricByUser({
      ownerIds: [participant],
      viewerId: viewer,
      metric: 'chars',
      startDate,
      endDate,
    });

    expect(mocks.visibleFilter).toHaveBeenCalledWith(
      [participant],
      viewer,
      'statistics'
    );
    expect(mocks.aggregate).toHaveBeenCalledWith([
      {
        $match: {
          ...privacyFilter,
          unknownDate: { $ne: true },
          date: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: '$user',
          value: { $sum: { $ifNull: ['$chars', 0] } },
        },
      },
    ]);
  });

  it('counts distinct persisted activity days per participant', async () => {
    const participant = new Types.ObjectId();
    mocks.visibleFilter.mockResolvedValue({ user: { $in: [participant] } });

    await aggregateVisibleLogMetricByUser({
      ownerIds: [participant],
      metric: 'active_days',
    });

    expect(mocks.aggregate).toHaveBeenCalledWith([
      { $match: { user: { $in: [participant] }, unknownDate: { $ne: true } } },
      {
        $group: {
          _id: {
            user: '$user',
            day: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
          },
        },
      },
      { $group: { _id: '$_id.user', value: { $sum: 1 } } },
    ]);
  });

  it.each(['xp', 'time', 'chars'] as const)(
    'filters %s to exact club media pairs without replacing private-log visibility',
    async (metric) => {
      const owner = new Types.ObjectId();
      const viewer = new Types.ObjectId();
      const startDate = new Date('2026-01-01T00:00:00.000Z');
      const privacyFilter = {
        user: { $in: [owner] },
        $or: [{ user: viewer }, { private: { $ne: true } }],
      };
      mocks.visibleFilter.mockResolvedValue(privacyFilter);
      const resultRows = [{ _id: owner, value: 42 }];
      mocks.aggregate.mockResolvedValue(resultRows);

      const result = await aggregateVisibleLogMetricByUser({
        ownerIds: [owner],
        viewerId: viewer,
        metric,
        startDate,
        media: [
          { mediaId: 'shared-id', mediaType: 'vn' },
          { mediaId: 'shared-id', mediaType: 'anime' },
          { mediaId: 'shared-id', mediaType: 'vn' },
          { mediaType: 'manga' },
        ],
      });

      expect(result).toEqual(resultRows);
      expect(mocks.aggregate.mock.calls[0][0][0]).toEqual({
        $match: {
          ...privacyFilter,
          unknownDate: { $ne: true },
          date: { $gte: startDate },
          $and: [{
            $or: [
              { mediaId: 'shared-id', type: 'vn' },
              { mediaId: 'shared-id', type: 'anime' },
              { mediaId: 'shared-id', type: 'vn' },
            ],
          }],
        },
      });
    }
  );

  it.each([
    { media: [] },
    { media: [{ mediaType: 'anime' as const }] },
  ])(
    'returns no totals when club media has no matchable titles: $media',
    async ({ media }) => {
      expect(await aggregateVisibleLogMetricByUser({
        ownerIds: [new Types.ObjectId()],
        metric: 'xp',
        media,
      })).toEqual([]);
      expect(mocks.aggregate).not.toHaveBeenCalled();
    }
  );

  it('converts anime episodes to minutes only when explicit time is absent', async () => {
    const owner = new Types.ObjectId();
    mocks.visibleFilter.mockResolvedValue({ user: { $in: [owner] } });

    await aggregateVisibleLogMetricByUser({
      ownerIds: [owner],
      metric: 'time',
      media: [{ mediaId: 'anime-id', mediaType: 'anime' }],
    });

    const timeExpression = mocks.aggregate.mock.calls[0][0][1].$group.value.$sum;
    expect(timeExpression.$cond).toEqual([
      {
        $and: [
          { $in: ['$type', ['anime', 'tv show']] },
          { $or: [
            { $eq: ['$time', 0] },
            { $eq: ['$time', null] },
            { $eq: [{ $type: '$time' }, 'missing'] },
          ] },
          { $gt: ['$episodes', 0] },
        ],
      },
      { $multiply: ['$episodes', 24] },
      { $ifNull: ['$time', 0] },
    ]);
  });
});

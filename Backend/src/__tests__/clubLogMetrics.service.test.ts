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
});

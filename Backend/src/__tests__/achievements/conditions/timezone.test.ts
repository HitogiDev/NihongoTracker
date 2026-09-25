import { Types } from 'mongoose';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import Log from '../../../models/log.model.js';
import { evaluateLogTimeRange } from '../../../services/achievements/conditions/logTimeRange.condition.js';
import { evaluateLogOnDate } from '../../../services/achievements/conditions/logOnDate.condition.js';
import { evaluateSingleDayHours } from '../../../services/achievements/conditions/singleDayHours.condition.js';
import { evaluateSessionsInDay } from '../../../services/achievements/conditions/sessionsInDay.condition.js';
import { evaluateWeeklyHours } from '../../../services/achievements/conditions/weeklyHours.condition.js';

vi.mock('../../../models/log.model.js', () => ({
  default: {
    aggregate: vi.fn(),
    findOne: vi.fn(),
  },
}));

const TZ = 'Asia/Tokyo';

function mockAggregate(rows: unknown[] = []) {
  vi.mocked(Log.aggregate).mockResolvedValue(rows as never);
}

function mockFindOne() {
  vi.mocked(Log.findOne).mockReturnValue({
    select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(null) }),
  } as never);
}

/** The pipeline the evaluator handed to Mongo. */
function pipeline(): any[] {
  return vi.mocked(Log.aggregate).mock.calls[0][0] as any[];
}

/** Day-bucket grouping expression from a $group stage. */
function groupId(stages: any[]): any {
  return stages.find((s) => s.$group)?.$group?._id;
}

describe('date-based conditions honour the user timezone', () => {
  beforeEach(() => vi.clearAllMocks());

  it('logTimeRange reads the hour in the given timezone', async () => {
    mockAggregate([]);
    await evaluateLogTimeRange(new Types.ObjectId(), 0, 6, 1, TZ);

    const project = pipeline().find((s) => s.$project)?.$project;
    expect(project.hour).toEqual({ $hour: { date: '$date', timezone: TZ } });
  });

  it('logTimeRange defaults to UTC when no timezone is supplied', async () => {
    mockAggregate([]);
    await evaluateLogTimeRange(new Types.ObjectId(), 0, 6, 1);

    const project = pipeline().find((s) => s.$project)?.$project;
    expect(project.hour).toEqual({ $hour: { date: '$date', timezone: 'UTC' } });
  });

  it('logOnDate matches month/day in the given timezone', async () => {
    mockFindOne();
    await evaluateLogOnDate(new Types.ObjectId(), '07-07', TZ);

    const filter = vi.mocked(Log.findOne).mock.calls[0][0] as unknown as {
      $expr: { $and: unknown[] };
    };
    expect(filter.$expr.$and).toEqual([
      { $eq: [{ $month: { date: '$date', timezone: TZ } }, 7] },
      { $eq: [{ $dayOfMonth: { date: '$date', timezone: TZ } }, 7] },
    ]);
  });

  it('singleDayHours buckets days in the given timezone', async () => {
    mockAggregate([]);
    await evaluateSingleDayHours(new Types.ObjectId(), 10, TZ);

    expect(groupId(pipeline())).toEqual({
      $dateToString: { format: '%Y-%m-%d', date: '$date', timezone: TZ },
    });
  });

  it('sessionsInDay buckets days in the given timezone', async () => {
    mockAggregate([]);
    await evaluateSessionsInDay(new Types.ObjectId(), 5, TZ);

    expect(groupId(pipeline())).toEqual({
      $dateToString: { format: '%Y-%m-%d', date: '$date', timezone: TZ },
    });
  });

  it('weeklyHours buckets days in the given timezone', async () => {
    mockAggregate([]);
    await evaluateWeeklyHours(new Types.ObjectId(), 24, TZ);

    expect(groupId(pipeline())).toEqual({
      $dateToString: { format: '%Y-%m-%d', date: '$date', timezone: TZ },
    });
  });

  it('weeklyHours day keys are 24h apart regardless of DST', async () => {
    // 2024-03-10 is a US DST transition day; a local-time window would make the
    // gap 23h and pull an 8th day into the 7-day window.
    mockAggregate([
      { _id: '2024-03-08', totalMinutes: 12 * 60 },
      { _id: '2024-03-15', totalMinutes: 12 * 60 },
    ]);
    const result = await evaluateWeeklyHours(new Types.ObjectId(), 24, 'America/New_York');

    // Exactly 7 days apart — must NOT be summed into one window
    expect(result).toEqual({ met: false, progress: 12 });
  });
});

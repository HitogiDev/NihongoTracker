import { Types } from 'mongoose';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { evaluateLogOnDate } from '../../../services/achievements/conditions/logOnDate.condition.js';

import Log from '../../../models/log.model.js';

import { evaluateLogTimeRange } from '../../../services/achievements/conditions/logTimeRange.condition.js';

vi.mock('../../../models/log.model.js', () => ({
  default: {
    aggregate: vi.fn(),
    findOne: vi.fn(),
  },
}));

function mockFindOne(data: unknown) {
  vi.mocked(Log.findOne).mockReturnValue({
    select: vi.fn().mockReturnValue({
      lean: vi.fn().mockResolvedValue(data),
    }),
  } as unknown as ReturnType<typeof Log.findOne>);
}

describe('evaluateLogOnDate', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns met=false when no log matches the date pattern', async () => {
    mockFindOne(null);
    const result = await evaluateLogOnDate(new Types.ObjectId(), '01-01');
    expect(result).toEqual({ met: false, progress: 0 });
  });

  it('returns met=true when a log matches Jan 1 (New Year)', async () => {
    mockFindOne({ _id: 'someId' });
    const result = await evaluateLogOnDate(new Types.ObjectId(), '01-01');
    expect(result).toEqual({ met: true, progress: 1 });
  });

  it('returns met=true for Tanabata (07-07)', async () => {
    mockFindOne({ _id: 'someId' });
    const result = await evaluateLogOnDate(new Types.ObjectId(), '07-07');
    expect(result.met).toBe(true);
  });

  it('returns met=true for Culture Day (11-03)', async () => {
    mockFindOne({ _id: 'someId' });
    const result = await evaluateLogOnDate(new Types.ObjectId(), '11-03');
    expect(result.met).toBe(true);
  });

  it('returns met=false for a date with no matching log', async () => {
    mockFindOne(null);
    const result = await evaluateLogOnDate(new Types.ObjectId(), '12-25');
    expect(result.met).toBe(false);
  });
});

describe('evaluateLogTimeRange', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns met=false progress=0 with no matching logs', async () => {
    vi.mocked(Log.aggregate).mockResolvedValue([]);
    const result = await evaluateLogTimeRange(new Types.ObjectId(), 0, 6, 10);
    expect(result).toEqual({ met: false, progress: 0 });
  });

  it('meets Night Owl (0-6h, 10 times) threshold', async () => {
    vi.mocked(Log.aggregate).mockResolvedValue([{ total: 10 }]);
    const result = await evaluateLogTimeRange(new Types.ObjectId(), 0, 6, 10);
    expect(result.met).toBe(true);
    expect(result.progress).toBe(10);
  });

  it('does not meet threshold with 9 logs (needs 10)', async () => {
    vi.mocked(Log.aggregate).mockResolvedValue([{ total: 9 }]);
    const result = await evaluateLogTimeRange(new Types.ObjectId(), 0, 6, 10);
    expect(result.met).toBe(false);
    expect(result.progress).toBe(9);
  });

  it('meets Early Bird (4-7h) threshold', async () => {
    vi.mocked(Log.aggregate).mockResolvedValue([{ total: 15 }]);
    const result = await evaluateLogTimeRange(new Types.ObjectId(), 4, 7, 10);
    expect(result.met).toBe(true);
  });
});

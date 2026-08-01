import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../models/log.model.js', () => ({
  default: {
    aggregate: vi.fn(),
    findOne: vi.fn(),
  },
}));

import Log from '../../../models/log.model.js';
import { evaluateLogTimeRange } from '../../../services/achievements/conditions/logTimeRange.condition.js';
import { evaluateLogOnDate } from '../../../services/achievements/conditions/logOnDate.condition.js';
import { evaluateSingleDayHours } from '../../../services/achievements/conditions/singleDayHours.condition.js';
import { evaluateSessionsInDay } from '../../../services/achievements/conditions/sessionsInDay.condition.js';
import { evaluateWeeklyHours } from '../../../services/achievements/conditions/weeklyHours.condition.js';

/** The $match filter the evaluator handed to Mongo. */
function matchStage(): any {
  const stages = vi.mocked(Log.aggregate).mock.calls[0][0] as any[];
  return stages.find((s) => s.$match)?.$match;
}

/**
 * Logs flagged unknownDate carry a placeholder date, so they must not count
 * towards anything that asks *when* the user immersed.
 */
describe('date-based conditions ignore unknownDate logs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(Log.aggregate).mockResolvedValue([] as never);
  });

  it('logTimeRange excludes them', async () => {
    await evaluateLogTimeRange({} as any, 0, 6, 1);
    expect(matchStage().unknownDate).toEqual({ $ne: true });
  });

  it('singleDayHours excludes them', async () => {
    await evaluateSingleDayHours({} as any, 10);
    expect(matchStage().unknownDate).toEqual({ $ne: true });
  });

  it('sessionsInDay excludes them', async () => {
    await evaluateSessionsInDay({} as any, 5);
    expect(matchStage().unknownDate).toEqual({ $ne: true });
  });

  it('weeklyHours excludes them', async () => {
    await evaluateWeeklyHours({} as any, 24);
    expect(matchStage().unknownDate).toEqual({ $ne: true });
  });

  it('logOnDate excludes them', async () => {
    vi.mocked(Log.findOne).mockReturnValue({
      select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(null) }),
    } as never);

    await evaluateLogOnDate({} as any, '01-01');

    const filter = vi.mocked(Log.findOne).mock.calls[0][0] as any;
    expect(filter.unknownDate).toEqual({ $ne: true });
  });
});

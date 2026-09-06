import { beforeEach, describe, expect, it, vi } from 'vitest';
import { evaluateLogDuringAiring } from '../../../services/achievements/conditions/logDuringAiring.condition.js';

vi.mock('../../../models/log.model.js', () => ({
  default: { aggregate: vi.fn() },
}));

import Log from '../../../models/log.model.js';

describe('evaluateLogDuringAiring', () => {
  beforeEach(() => vi.clearAllMocks());

  it('awards the achievement when an eligible log exists', async () => {
    vi.mocked(Log.aggregate).mockResolvedValue([{ total: 1 }]);

    await expect(evaluateLogDuringAiring({} as never)).resolves.toEqual({
      met: true,
      progress: 1,
    });
  });

  it('treats a missing end date like an ongoing series', async () => {
    vi.mocked(Log.aggregate).mockResolvedValue([]);

    await evaluateLogDuringAiring({} as never);

    const pipeline = vi.mocked(Log.aggregate).mock.calls[0]?.[0];
    expect(JSON.stringify(pipeline)).toContain('$ifNull');
  });
});

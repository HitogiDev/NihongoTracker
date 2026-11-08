import { Types } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { evaluateDuelsWon } from '../../../services/achievements/conditions/duelsWon.condition.js';
import Duel from '../../../models/duel.model.js';

vi.mock('../../../models/duel.model.js', () => ({
  default: { countDocuments: vi.fn() },
}));

describe('evaluateDuelsWon', () => {
  beforeEach(() => vi.clearAllMocks());

  it('counts only completed duels won by the user', async () => {
    const userId = new Types.ObjectId();
    vi.mocked(Duel.countDocuments).mockResolvedValue(0 as never);

    await evaluateDuelsWon(userId, 1);

    expect(Duel.countDocuments).toHaveBeenCalledWith({
      status: 'completed',
      winner: userId,
    });
  });

  it('is not met below the threshold and reports progress', async () => {
    vi.mocked(Duel.countDocuments).mockResolvedValue(3 as never);
    const result = await evaluateDuelsWon(new Types.ObjectId(), 10);
    expect(result).toEqual({ met: false, progress: 3 });
  });

  it('is met at the threshold', async () => {
    vi.mocked(Duel.countDocuments).mockResolvedValue(10 as never);
    const result = await evaluateDuelsWon(new Types.ObjectId(), 10);
    expect(result).toEqual({ met: true, progress: 10 });
  });
});

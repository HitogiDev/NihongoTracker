import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';
import Log from '../models/log.model.js';
import User from '../models/user.model.js';
import { calculateEditedLogXp } from '../middlewares/calculateXp.js';
import { recalculateUserXpFromLogs } from '../services/updateStats.js';
import { recalculateStreaksForUser } from '../services/streaks.js';
import { evaluateAutoCompleteForUserMedia } from '../services/autoComplete.js';
import { bulkEditLogs } from '../services/bulkEditLogs.js';

vi.mock('../models/log.model.js', () => ({ default: { find: vi.fn() } }));
vi.mock('../models/user.model.js', () => ({ default: { findById: vi.fn() } }));
vi.mock('../middlewares/calculateXp.js', () => ({ calculateEditedLogXp: vi.fn() }));
vi.mock('../services/updateStats.js', () => ({ recalculateUserXpFromLogs: vi.fn() }));
vi.mock('../services/streaks.js', () => ({ recalculateStreaksForUser: vi.fn() }));
vi.mock('../services/autoComplete.js', () => ({ evaluateAutoCompleteForUserMedia: vi.fn() }));

const ownerId = new Types.ObjectId();
const firstId = new Types.ObjectId().toString();
const secondId = new Types.ObjectId().toString();

function makeLog(id: string) {
  const log = {
    _id: new Types.ObjectId(id),
    user: ownerId,
    type: 'video',
    mediaId: 'video-1',
    date: new Date('2025-01-01T12:00:00.000Z'),
    description: 'Original',
    time: 30,
    xp: 20,
    validate: vi.fn().mockResolvedValue(undefined),
    save: vi.fn().mockResolvedValue(undefined),
    set: vi.fn((patch: Record<string, unknown>) => Object.assign(log, patch)),
  };
  return log;
}

describe('bulkEditLogs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(User.findById).mockResolvedValue({ _id: ownerId } as never);
    vi.mocked(calculateEditedLogXp).mockResolvedValue({ xp: 80, xpBreakdown: null } as never);
  });

  it('rejects an empty selection before reading logs', async () => {
    await expect(bulkEditLogs([], { description: 'New' }, ownerId)).rejects.toThrow();
    expect(Log.find).not.toHaveBeenCalled();
  });

  it('rejects any missing or unowned ID without writing', async () => {
    const first = makeLog(firstId);
    vi.mocked(Log.find).mockResolvedValue([first] as never);
    await expect(bulkEditLogs([firstId, secondId], { description: 'New' }, ownerId)).rejects.toThrow();
    expect(Log.find).toHaveBeenCalledWith({
      _id: { $in: [firstId, secondId] },
      user: ownerId,
    });
    expect(first.save).not.toHaveBeenCalled();
  });

  it('validates every log before saving the first one', async () => {
    const first = makeLog(firstId);
    const second = makeLog(secondId);
    second.validate.mockRejectedValue(new Error('Invalid log'));
    vi.mocked(Log.find).mockResolvedValue([first, second] as never);
    await expect(bulkEditLogs([firstId, secondId], { time: 45 }, ownerId)).rejects.toThrow('Invalid log');
    expect(first.save).not.toHaveBeenCalled();
    expect(second.save).not.toHaveBeenCalled();
  });

  it('updates all selected logs and recalculates owner totals and streak once', async () => {
    const first = makeLog(firstId);
    const second = makeLog(secondId);
    vi.mocked(Log.find).mockResolvedValue([first, second] as never);
    const date = '2025-01-02T12:00:00.000Z';

    await expect(bulkEditLogs([firstId, secondId], { date, description: 'New' }, ownerId)).resolves.toBe(2);

    expect(first.description).toBe('New');
    expect(second.description).toBe('New');
    expect(first.time).toBe(30);
    expect(first.xp).toBe(80);
    expect(second.xp).toBe(80);
    expect(calculateEditedLogXp).toHaveBeenCalledTimes(2);
    expect(first.save).toHaveBeenCalledOnce();
    expect(second.save).toHaveBeenCalledOnce();
    expect(recalculateUserXpFromLogs).toHaveBeenCalledOnce();
    expect(recalculateStreaksForUser).toHaveBeenCalledOnce();
    expect(evaluateAutoCompleteForUserMedia).toHaveBeenCalledOnce();
  });
});

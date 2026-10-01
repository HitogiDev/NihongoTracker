import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';
import type { NextFunction, Request, Response } from 'express';
import { getDailyGoals } from '../controllers/dailyGoals.controller.js';
import { getLongTermGoals } from '../controllers/longTermGoals.controller.js';
import { goalTodayKey } from '../services/goalPeriod.js';
import { isValidGoalMediaType } from '../services/goalMediaType.js';

const mocks = vi.hoisted(() => ({
  dailyFind: vi.fn(),
  longTermFind: vi.fn(),
  logFind: vi.fn(),
  userFindOne: vi.fn()
}));

vi.mock('../models/dailyGoal.model.js', () => ({
  default: { find: mocks.dailyFind }
}));
vi.mock('../models/longTermGoal.model.js', () => ({
  default: { find: mocks.longTermFind }
}));
vi.mock('../models/log.model.js', () => ({
  default: { find: mocks.logFind }
}));
vi.mock('../models/user.model.js', () => ({
  default: { findOne: mocks.userFindOne }
}));
vi.mock('../models/media.model.js', () => ({ Anime: { find: vi.fn() } }));

function response() {
  const res = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  return res;
}

const request = { params: { username: 'reader' } } as unknown as Request;
const next = vi.fn() as NextFunction;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.userFindOne.mockResolvedValue({
    _id: new Types.ObjectId(),
    settings: { timezone: 'UTC' }
  });
});

describe('goal media filtering', () => {
  it('does not offer Other as a goal media type', () => {
    expect(isValidGoalMediaType('other')).toBe(false);
    expect(isValidGoalMediaType('anime')).toBe(true);
  });

  it('reports separate recurring progress for the same metric and different media', async () => {
    const goals = [
      {
        _id: new Types.ObjectId(),
        type: 'time',
        cadence: 'daily',
        target: 25,
        isActive: true
      },
      {
        _id: new Types.ObjectId(),
        type: 'time',
        mediaType: 'anime',
        cadence: 'daily',
        target: 25,
        isActive: true
      },
      {
        _id: new Types.ObjectId(),
        type: 'time',
        mediaType: 'manga',
        cadence: 'daily',
        target: 25,
        isActive: true
      }
    ];
    mocks.dailyFind.mockReturnValue({ sort: vi.fn().mockResolvedValue(goals) });
    mocks.logFind.mockResolvedValue([
      { type: 'anime', time: 30 },
      { type: 'manga', time: 10 }
    ]);
    const res = response();

    await getDailyGoals(request, res as unknown as Response, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        goalProgress: {
          [String(goals[0]._id)]: 40,
          [String(goals[1]._id)]: 30,
          [String(goals[2]._id)]: 10
        }
      })
    );
  });

  it('limits custom period progress to the selected media type', async () => {
    const goal = {
      _id: new Types.ObjectId(),
      user: new Types.ObjectId(),
      type: 'time',
      mediaType: 'anime',
      totalTarget: 100,
      startDate: new Date(Date.now() - 86_400_000),
      targetDate: new Date(Date.now() + 86_400_000 * 7),
      displayTimeframe: 'daily',
      toObject() {
        return { ...this };
      }
    };
    mocks.longTermFind.mockReturnValue({
      sort: vi.fn().mockResolvedValue([goal])
    });
    mocks.logFind.mockImplementation(async (query) =>
      query.type === 'anime'
        ? [
            { type: 'anime', time: 30, date: new Date() },
            { type: 'anime', time: 50, date: new Date(Date.now() - 86_400_000 * 2) }
          ]
        : [
            { type: 'anime', time: 30, date: new Date() },
            { type: 'manga', time: 10, date: new Date() }
          ]
    );
    const res = response();

    await getLongTermGoals(request, res as unknown as Response, next);

    expect(next).not.toHaveBeenCalled();
    expect(mocks.logFind).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'anime' })
    );
    expect(res.json.mock.calls[0][0].goals[0].progress.totalProgress).toBe(30);
  });

  it('counts a one-day goal and shows the amount still needed today', async () => {
    const today = goalTodayKey('UTC');
    const goal = {
      _id: new Types.ObjectId(),
      user: new Types.ObjectId(),
      type: 'time',
      totalTarget: 100,
      startDate: new Date(`${today}T00:00:00Z`),
      targetDate: new Date(`${today}T00:00:00Z`),
      displayTimeframe: 'daily',
      toObject() {
        return { ...this };
      }
    };
    mocks.longTermFind.mockReturnValue({
      sort: vi.fn().mockResolvedValue([goal])
    });
    mocks.logFind.mockResolvedValue([
      { type: 'anime', time: 30, date: new Date() }
    ]);
    const res = response();

    await getLongTermGoals(request, res as unknown as Response, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.json.mock.calls[0][0].goals[0].progress).toEqual(
      expect.objectContaining({
        totalProgress: 30,
        remainingDays: 0,
        requiredPerTimeframe: 70
      })
    );
  });
});

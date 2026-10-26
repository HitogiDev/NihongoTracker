import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { goalTimeframePace } from './goalPace.ts';

const base = {
  totalTarget: 1_000_000,
  totalProgress: 0,
  remainingTarget: 1_000_000,
  remainingDays: 7,
  requiredPerTimeframe: 0,
  timeframeProgress: 0
};

describe('goalTimeframePace', () => {
  it('treats a goal reached before its due date as done for today', () => {
    // 1.0M reached with a week left: the backend sends requiredPerTimeframe 0.
    const pace = goalTimeframePace({
      ...base,
      totalProgress: 1_000_000,
      remainingTarget: 0,
      timeframeProgress: 14_100
    });

    assert.deepEqual(pace, {
      completed: true,
      requirement: 0,
      remaining: 0,
      percentage: 100
    });
  });

  it('never goes negative when progress is far above the target', () => {
    const pace = goalTimeframePace({
      ...base,
      totalProgress: 3_500_000,
      remainingTarget: 0,
      remainingDays: 0,
      timeframeProgress: 2_000_000
    });

    assert.equal(pace.requirement, 0);
    assert.equal(pace.remaining, 0);
    assert.equal(pace.percentage, 100);
  });

  it('marks a goal completed on its last day as done', () => {
    const pace = goalTimeframePace({
      ...base,
      totalProgress: 1_000_000,
      remainingTarget: 0,
      remainingDays: 0,
      timeframeProgress: 50_000
    });

    assert.equal(pace.completed, true);
    assert.equal(pace.remaining, 0);
  });

  it('keeps the backend pace for goals not yet reached', () => {
    const pace = goalTimeframePace({
      ...base,
      totalProgress: 300_000,
      remainingTarget: 700_000,
      requiredPerTimeframe: 87_500,
      timeframeProgress: 43_750
    });

    assert.deepEqual(pace, {
      completed: false,
      requirement: 87_500,
      remaining: 43_750,
      percentage: 50
    });
  });

  it('falls back to remaining / days when the backend sends no pace', () => {
    const pace = goalTimeframePace({
      ...base,
      totalProgress: 300_000,
      remainingTarget: 700_000,
      timeframeProgress: 0
    });

    assert.equal(pace.requirement, 100_000);
    assert.equal(pace.percentage, 0);
  });
});

import { describe, expect, it } from 'vitest';
import { goalTodayKey, isGoalTargetDatePast } from '../services/goalPeriod.js';

describe('custom period date validation', () => {
  it('accepts today in the goal owner timezone', () => {
    const now = new Date('2026-10-01T01:00:00Z');
    const september30 = new Date('2026-09-30T00:00:00Z');

    expect(goalTodayKey('America/Santo_Domingo', now)).toBe('2026-09-30');
    expect(
      isGoalTargetDatePast(september30, 'America/Santo_Domingo', now)
    ).toBe(false);
    expect(isGoalTargetDatePast(september30, 'UTC', now)).toBe(true);
  });
});

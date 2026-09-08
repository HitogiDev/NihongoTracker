import { describe, expect, it } from 'vitest';
import { calculateForecastSchedule } from '../services/immersionForecast.service.js';

const base = {
  targetTotal: 1_000,
  startingProgress: 0,
  currentProgress: 0,
  createdAt: new Date('2026-09-01T14:00:00.000Z'),
  targetDate: new Date('2026-09-10T12:00:00.000Z'),
  timezone: 'America/Santo_Domingo',
  now: new Date('2026-09-01T15:00:00.000Z'),
  estimatedMinutes: 120,
};

describe('calculateForecastSchedule', () => {
  it('includes today and deadline in daily quota', () => {
    const result = calculateForecastSchedule(base);
    expect(result.remainingDays).toBe(10);
    expect(result.requiredPerDay).toBe(100);
    expect(result.behindBy).toBe(0);
    expect(result.status).toBe('on_track');
  });

  it('recommends a higher quota after missed days', () => {
    const result = calculateForecastSchedule({
      ...base,
      now: new Date('2026-09-04T15:00:00.000Z'),
    });
    expect(result.remainingDays).toBe(7);
    expect(result.requiredPerDay).toBe(143);
    expect(result.behindBy).toBe(300);
    expect(result.status).toBe('behind');
  });

  it('accounts for progress that existed before forecast creation', () => {
    const result = calculateForecastSchedule({
      ...base,
      startingProgress: 400,
      currentProgress: 520,
      now: new Date('2026-09-04T15:00:00.000Z'),
    });
    expect(result.remaining).toBe(480);
    expect(result.behindBy).toBe(60);
  });

  it('reports completion and overdue states', () => {
    expect(
      calculateForecastSchedule({ ...base, currentProgress: 1_000 }).status
    ).toBe('completed');
    expect(
      calculateForecastSchedule({
        ...base,
        now: new Date('2026-09-11T15:00:00.000Z'),
      }).status
    ).toBe('overdue');
  });

  it('preserves missing pace data', () => {
    const result = calculateForecastSchedule({
      ...base,
      estimatedMinutes: null,
    });
    expect(result.estimatedMinutes).toBeNull();
    expect(result.paceStatus).toBe('insufficient_data');
  });
});

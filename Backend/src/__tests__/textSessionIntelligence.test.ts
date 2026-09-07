import { describe, expect, it } from 'vitest';
import { computeTextSessionIntelligence } from '../services/textSessionIntelligence.js';

function line(atSeconds: number, chars = 10) {
  return {
    charsCount: chars,
    createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, atSeconds)),
    elapsedSeconds: atSeconds,
  };
}

describe('computeTextSessionIntelligence', () => {
  it('learns a stable cadence and flags a substantially longer recoverable gap', () => {
    const lines = [
      ...Array.from({ length: 9 }, (_, index) => line(index * 10)),
      line(140),
    ];

    const result = computeTextSessionIntelligence({
      lines,
      sessionSeconds: 140,
      loggedAt: lines[lines.length - 1].createdAt,
      settings: { mode: 'automatic', afkThresholdSeconds: 300 },
    });

    expect(result.baselineIntervalSeconds).toBe(10);
    expect(result.distractionThresholdSeconds).toBe(30);
    expect(result.distractionCount).toBe(1);
    expect(result.distractedSeconds).toBe(30);
    expect(result.longestDistractionSeconds).toBe(30);
  });

  it('reclassifies a long gap as AFK instead of distraction', () => {
    const lines = [line(0), line(20), line(420)];

    const result = computeTextSessionIntelligence({
      lines,
      sessionSeconds: 140,
      loggedAt: lines[lines.length - 1].createdAt,
      settings: {
        mode: 'manual',
        manualThresholdSeconds: 40,
        afkThresholdSeconds: 300,
      },
    });

    expect(result.afkSeconds).toBe(400);
    expect(result.distractedSeconds).toBe(0);
    expect(result.distractionCount).toBe(0);
    expect(result.periods).toContainEqual({
      startSecond: 20,
      endSecond: 420,
      type: 'afk',
    });
  });

  it('calibrates for a naturally slower reader instead of locking to fallback', () => {
    const lines = Array.from({ length: 10 }, (_, index) => line(index * 50));

    const result = computeTextSessionIntelligence({
      lines,
      sessionSeconds: 450,
      loggedAt: lines[lines.length - 1].createdAt,
      settings: { mode: 'automatic', afkThresholdSeconds: 300 },
    });

    expect(result.baselineIntervalSeconds).toBe(50);
    expect(result.distractionThresholdSeconds).toBe(125);
    expect(result.distractionCount).toBe(0);
  });

  it('uses a manual threshold and excludes its grace period', () => {
    const lines = [line(0), line(100)];

    const result = computeTextSessionIntelligence({
      lines,
      sessionSeconds: 100,
      loggedAt: lines[lines.length - 1].createdAt,
      settings: {
        mode: 'manual',
        manualThresholdSeconds: 40,
        afkThresholdSeconds: 300,
      },
    });

    expect(result.focusedSeconds).toBe(40);
    expect(result.distractedSeconds).toBe(60);
    expect(result.focusPercentage).toBe(40);
  });

  it('builds minute buckets and first/last thirty-minute speeds', () => {
    const lines = [line(10, 100), line(610, 200), line(1900, 300)];

    const result = computeTextSessionIntelligence({
      lines,
      sessionSeconds: 3600,
      loggedAt: lines[lines.length - 1].createdAt,
      settings: { mode: 'off', afkThresholdSeconds: 300 },
    });

    expect(result.charactersPerMinute).toHaveLength(60);
    expect(result.charactersPerMinute[0]).toBe(100);
    expect(result.charactersPerMinute[10]).toBe(200);
    expect(result.charactersPerMinute[31]).toBe(300);
    expect(result.firstThirtyMinutesSpeed).toBe(600);
    expect(result.lastThirtyMinutesSpeed).toBe(600);
  });

  it('keeps automatic calibration robust against an AFK outlier', () => {
    const lines = [
      ...Array.from({ length: 10 }, (_, index) => line(index * 15)),
      line(750),
      line(765),
    ];

    const result = computeTextSessionIntelligence({
      lines,
      sessionSeconds: 180,
      loggedAt: lines[lines.length - 1].createdAt,
      settings: { mode: 'automatic', afkThresholdSeconds: 300 },
    });

    expect(result.baselineIntervalSeconds).toBe(15);
    expect(result.distractionThresholdSeconds).toBe(38);
    expect(result.afkSeconds).toBe(615);
  });
});

import { describe, it, expect } from 'vitest';
import {
  computeXp,
  continuousLevel,
  comfortDifficulty,
  difficultyMultiplier,
  effectiveComfort,
  getLogCategory,
  medianOf,
  normalizeJitenDifficulty,
  weightedPercentile,
  XP_FORMULA_VERSION,
} from '../../services/xp.js';
import { calculateLevel } from '../../services/calculateLevel.js';

describe('getLogCategory', () => {
  it('maps types to the same categories as updateStats', () => {
    expect(getLogCategory('anime')).toBe('listening');
    expect(getLogCategory('video')).toBe('listening');
    expect(getLogCategory('movie')).toBe('listening');
    expect(getLogCategory('tv show')).toBe('listening');
    expect(getLogCategory('audio')).toBe('listening');
    expect(getLogCategory('reading')).toBe('reading');
    expect(getLogCategory('manga')).toBe('reading');
    expect(getLogCategory('vn')).toBe('reading');
    expect(getLogCategory('game')).toBe('reading');
    expect(getLogCategory('other')).toBeNull();
  });
});

describe('continuousLevel', () => {
  it('is 0 at 0 xp and grows monotonically', () => {
    expect(continuousLevel(0)).toBe(0);
    expect(continuousLevel(-5)).toBe(0);
    expect(continuousLevel(1000)).toBeGreaterThan(continuousLevel(100));
  });

  it('floors to the same discrete level as calculateLevel', () => {
    for (const xp of [1, 135, 5000, 10000, 100000, 1000000]) {
      expect(Math.floor(continuousLevel(xp))).toBe(calculateLevel(xp));
    }
  });
});

describe('normalizeJitenDifficulty', () => {
  it('maps the native 0-6 scale onto 0-100', () => {
    expect(normalizeJitenDifficulty(0)).toBe(0);
    expect(normalizeJitenDifficulty(3)).toBeCloseTo(50);
    expect(normalizeJitenDifficulty(6)).toBe(100);
  });

  it('returns null for missing or invalid values', () => {
    expect(normalizeJitenDifficulty(null)).toBeNull();
    expect(normalizeJitenDifficulty(undefined)).toBeNull();
    expect(normalizeJitenDifficulty(-1)).toBeNull();
  });

  it('clamps values above the native max', () => {
    expect(normalizeJitenDifficulty(10)).toBe(100);
  });
});

describe('difficultyMultiplier', () => {
  it('is neutral without difficulty data', () => {
    expect(difficultyMultiplier(null, 0)).toBe(1);
    expect(difficultyMultiplier(undefined, 50)).toBe(1);
  });

  it('never penalizes content at or below comfort difficulty', () => {
    // Level 25 → comfort 50
    expect(comfortDifficulty(25)).toBeCloseTo(50);
    expect(difficultyMultiplier(20, 25)).toBe(1);
    expect(difficultyMultiplier(50, 25)).toBe(1);
  });

  it('reaches the max bonus at every level (normalized gap)', () => {
    expect(difficultyMultiplier(100, 0)).toBeCloseTo(1.3);
    expect(difficultyMultiplier(100, 25)).toBeCloseTo(1.3);
    expect(difficultyMultiplier(100, 100)).toBeCloseTo(1.3);
  });

  it('scales linearly inside the remaining difficulty space', () => {
    // Level 0 → comfort 0: d=50 is half the space
    expect(difficultyMultiplier(50, 0)).toBeCloseTo(1.15);
    // Level 25 → comfort 50: d=75 is half the remaining space
    expect(difficultyMultiplier(75, 25)).toBeCloseTo(1.15);
    // Level 100 → comfort 80: d=90 is half the remaining space
    expect(difficultyMultiplier(90, 100)).toBeCloseTo(1.15);
  });

  it('shrinks the bonus for the same content as the level grows', () => {
    const d = 70;
    const low = difficultyMultiplier(d, 1);
    const mid = difficultyMultiplier(d, 25);
    const high = difficultyMultiplier(d, 100);
    expect(low).toBeGreaterThan(mid);
    expect(mid).toBeGreaterThan(high);
    expect(high).toBe(1);
  });

  it('clamps out-of-range difficulty values', () => {
    expect(difficultyMultiplier(150, 0)).toBeCloseTo(1.3);
    expect(difficultyMultiplier(-10, 0)).toBe(1);
  });
});

describe('medianOf', () => {
  it('handles empty, odd and even sample counts', () => {
    expect(medianOf([])).toBeNull();
    expect(medianOf([7])).toBe(7);
    expect(medianOf([1, 100, 3])).toBe(3);
    expect(medianOf([1, 3, 5, 100])).toBe(4);
  });
});

describe('weightedPercentile', () => {
  it('returns null without positive weights', () => {
    expect(weightedPercentile([], 0.75)).toBeNull();
    expect(weightedPercentile([{ value: 50, weight: 0 }], 0.75)).toBeNull();
  });

  it('weights by hours, not by sample count', () => {
    // 9 hours easy + 1 hour hard → p75 stays at the easy difficulty
    const samples = [
      { value: 20, weight: 9 },
      { value: 90, weight: 1 },
    ];
    expect(weightedPercentile(samples, 0.75)).toBe(20);
    // 3 hours easy + 7 hours hard → p75 lands on the hard difficulty
    const inverted = [
      { value: 20, weight: 3 },
      { value: 90, weight: 7 },
    ];
    expect(weightedPercentile(inverted, 0.75)).toBe(90);
  });

  it('picks the value where cumulative weight crosses the fraction', () => {
    const samples = [
      { value: 10, weight: 1 },
      { value: 50, weight: 1 },
      { value: 80, weight: 1 },
      { value: 95, weight: 1 },
    ];
    expect(weightedPercentile(samples, 0.75)).toBe(80);
  });
});

describe('effectiveComfort — i+1 consumed-difficulty signal', () => {
  it('raises comfort when consumed difficulty exceeds the level floor', () => {
    // Level 0 → floor 0; consuming ~d=50 content moves comfort to 50
    expect(effectiveComfort(0, 50)).toBe(50);
  });

  it('never drops below the level-based floor (anti-sandbagging)', () => {
    // Level 25 → floor 50; farming easy content (p75=20) cannot lower it
    expect(effectiveComfort(25, 20)).toBeCloseTo(50);
  });

  it('falls back to the level floor without enough tagged history', () => {
    expect(effectiveComfort(25, null)).toBeCloseTo(50);
    expect(effectiveComfort(25, undefined)).toBeCloseTo(50);
  });

  it('shrinks the bonus for content the user already consumes routinely', () => {
    // Newcomer by level, but already consuming d≈70 content: d=70 is neutral,
    // only content above their demonstrated frontier earns a bonus.
    expect(difficultyMultiplier(70, 0, 70)).toBe(1);
    expect(difficultyMultiplier(85, 0, 70)).toBeCloseTo(1.15);
    expect(difficultyMultiplier(100, 0, 70)).toBeCloseTo(1.3);
  });
});

describe('computeXp — listening types', () => {
  it('credits 135 XP per hour of time', () => {
    expect(computeXp({ type: 'anime', time: 60 }).xp).toBe(135);
    expect(computeXp({ type: 'movie', time: 90 }).xp).toBe(202);
    expect(computeXp({ type: 'audio', time: 30 }).xp).toBe(67);
  });

  it('falls back to 24-minute episodes for anime and tv shows', () => {
    expect(computeXp({ type: 'anime', episodes: 2 }).xp).toBe(108);
    expect(computeXp({ type: 'tv show', episodes: 3 }).xp).toBe(162);
  });

  it('prefers time over episodes when both are present', () => {
    expect(computeXp({ type: 'anime', time: 60, episodes: 1 }).xp).toBe(135);
  });

  it('returns 0 without time or episodes', () => {
    expect(computeXp({ type: 'audio' }).xp).toBe(0);
  });
});

describe('computeXp — reading types, time as base', () => {
  it('gives a fast reader the same XP as a listener for the same hour', () => {
    const listener = computeXp({ type: 'anime', time: 60 });
    const fastReader = computeXp({ type: 'reading', time: 60, chars: 20000 });
    expect(fastReader.xp).toBe(listener.xp);
  });

  it('caps implausible time claims using chars (2000 chars/hour floor)', () => {
    // 120 min claimed but only 1000 chars read → 30 credited minutes
    const result = computeXp({ type: 'reading', time: 120, chars: 1000 });
    expect(result.breakdown.timeCreditedMin).toBeCloseTo(30);
    expect(result.xp).toBe(67);
  });

  it('estimates time from chars at the reference speed without history', () => {
    expect(computeXp({ type: 'reading', chars: 9450 }).xp).toBe(135);
    expect(computeXp({ type: 'vn', chars: 4725 }).xp).toBe(67);
  });

  it('estimates time from chars using the personal speed when available', () => {
    const result = computeXp(
      { type: 'reading', chars: 14000 },
      { personalSpeedCph: 14000 }
    );
    expect(result.breakdown.timeCreditedMin).toBeCloseTo(60);
    expect(result.xp).toBe(135);
  });

  it('clamps personal speed to the plausible range', () => {
    // 60000 cph clamps to 30000 → 30000 chars = 1 hour
    const tooFast = computeXp(
      { type: 'reading', chars: 30000 },
      { personalSpeedCph: 60000 }
    );
    expect(tooFast.breakdown.timeCreditedMin).toBeCloseTo(60);
    // 1000 cph clamps to 3000 → 3000 chars = 1 hour
    const tooSlow = computeXp(
      { type: 'reading', chars: 3000 },
      { personalSpeedCph: 1000 }
    );
    expect(tooSlow.breakdown.timeCreditedMin).toBeCloseTo(60);
  });

  it('estimates chars from pages when only pages are present', () => {
    // 40 pages × 250 chars = 10000 chars at reference speed ≈ 63.49 min
    const result = computeXp({ type: 'reading', pages: 40 });
    expect(result.breakdown.timeCreditedMin).toBeCloseTo(63.49, 1);
    expect(result.xp).toBe(142);
  });
});

describe('computeXp — game gameplay dilution', () => {
  it('applies 0.75 to unvalidated game time', () => {
    expect(computeXp({ type: 'game', time: 60 }).xp).toBe(101);
  });

  it('credits full rate when chars validate the time', () => {
    expect(computeXp({ type: 'game', time: 60, chars: 12000 }).xp).toBe(135);
  });

  it('credits full rate for chars-only game logs', () => {
    expect(computeXp({ type: 'game', chars: 9450 }).xp).toBe(135);
  });
});

describe('computeXp — other', () => {
  it('always earns 0 XP, regardless of time (intended, not a bug)', () => {
    expect(computeXp({ type: 'other', time: 60 }).xp).toBe(0);
    expect(computeXp({ type: 'other' }).xp).toBe(0);
  });
});

describe('computeXp — difficulty multiplier integration', () => {
  it('applies the multiplier over base XP', () => {
    const result = computeXp(
      { type: 'reading', time: 60 },
      { difficulty: 100, categoryLevel: 0 }
    );
    expect(result.breakdown.baseXp).toBe(135);
    expect(result.breakdown.multiplier).toBeCloseTo(1.3);
    expect(result.xp).toBe(175);
  });

  it('keeps the XP/hour ceiling identical across levels', () => {
    const newcomer = computeXp(
      { type: 'reading', time: 60 },
      { difficulty: 100, categoryLevel: 0 }
    );
    const veteran = computeXp(
      { type: 'reading', time: 60 },
      { difficulty: 100, categoryLevel: 100 }
    );
    expect(newcomer.xp).toBe(veteran.xp);
  });

  it('records an auditable breakdown', () => {
    const { breakdown } = computeXp(
      { type: 'reading', time: 60 },
      { difficulty: 85, categoryLevel: 25 }
    );
    expect(breakdown.version).toBe(XP_FORMULA_VERSION);
    expect(breakdown.difficulty).toBe(85);
    expect(breakdown.categoryLevelAt).toBe(25);
    expect(breakdown.comfortAt).toBeCloseTo(50);
    expect(breakdown.baseXp).toBe(135);
    expect(breakdown.timeCreditedMin).toBe(60);
  });

  it('uses the consumed-difficulty signal to raise the comfort point', () => {
    const withConsumed = computeXp(
      { type: 'reading', time: 60 },
      { difficulty: 85, categoryLevel: 0, consumedDifficulty: 70 }
    );
    expect(withConsumed.breakdown.comfortAt).toBe(70);
    expect(withConsumed.breakdown.multiplier).toBeCloseTo(1.15);
    expect(withConsumed.xp).toBe(155);
  });

  it('honors a fixed comfortAt snapshot over recomputation (edits)', () => {
    const result = computeXp(
      { type: 'reading', time: 60 },
      {
        difficulty: 85,
        categoryLevel: 100,
        consumedDifficulty: 95,
        comfortAt: 70,
      }
    );
    expect(result.breakdown.comfortAt).toBe(70);
    expect(result.breakdown.multiplier).toBeCloseTo(1.15);
  });

  it('stores a null difficulty and neutral multiplier without data', () => {
    const { breakdown } = computeXp({ type: 'anime', time: 60 });
    expect(breakdown.difficulty).toBeNull();
    expect(breakdown.multiplier).toBe(1);
  });
});

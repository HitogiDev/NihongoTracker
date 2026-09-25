import { describe, expect, it } from 'vitest';
import { buildMonthlyRankHistory } from '../services/rankSnapshot.service.js';

const at = (day: number) => new Date(Date.UTC(2026, 8, day));

describe('buildMonthlyRankHistory', () => {
  it('keeps a point for every effective monthly position change', () => {
    const history = buildMonthlyRankHistory(
      [
        { userId: 'target', xp: 100, date: at(2) },
        { userId: 'other-a', xp: 120, date: at(3) },
        { userId: 'target', xp: 50, date: at(4) },
        { userId: 'other-b', xp: 200, date: at(5) },
        { userId: 'other-a', xp: 100, date: at(6) },
      ],
      'target',
      at(1),
      at(7)
    );

    expect(history).toEqual([
      { date: at(1), position: 1 },
      { date: at(3), position: 2 },
      { date: at(4), position: 1 },
      { date: at(5), position: 2 },
      { date: at(6), position: 3 },
      { date: at(7), position: 3 },
    ]);
  });

  it('does not count a tie as an overtake', () => {
    const history = buildMonthlyRankHistory(
      [
        { userId: 'target', xp: 100, date: at(2) },
        { userId: 'other', xp: 100, date: at(3) },
        { userId: 'other', xp: 1, date: at(4) },
      ],
      'target',
      at(1),
      at(5)
    );

    expect(history).toEqual([
      { date: at(1), position: 1 },
      { date: at(4), position: 2 },
      { date: at(5), position: 2 },
    ]);
  });

  it('returns a drawable flat line when the position did not change', () => {
    expect(buildMonthlyRankHistory([], 'target', at(1), at(2))).toEqual([
      { date: at(1), position: 1 },
      { date: at(2), position: 1 },
    ]);
  });
});

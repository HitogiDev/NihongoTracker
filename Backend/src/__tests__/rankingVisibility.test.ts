import { describe, expect, it } from 'vitest';
import { isRankingAchievementKey } from '../services/achievements/rankingVisibility.js';

describe('ranking achievement visibility', () => {
  it('recognizes every competitive achievement key', () => {
    expect(isRankingAchievementKey('rank_top10')).toBe(true);
    expect(isRankingAchievementKey('rank_podium')).toBe(true);
    expect(isRankingAchievementKey('rank_king')).toBe(true);
    expect(isRankingAchievementKey('rank_consistent')).toBe(true);
    expect(isRankingAchievementKey('secret_dethroned')).toBe(true);
  });

  it('does not classify unrelated achievements as competitive', () => {
    expect(isRankingAchievementKey('streak_30')).toBe(false);
    expect(isRankingAchievementKey(undefined)).toBe(false);
    expect(isRankingAchievementKey(null)).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { hasLevelRecommendationFilters } from '../services/levelRecommendationAccess.js';
import { userRoles } from '../types.js';

describe('hasLevelRecommendationFilters', () => {
  it('allows active Enthusiast and Consumer supporters', () => {
    for (const tier of ['enthusiast', 'consumer'] as const) {
      expect(
        hasLevelRecommendationFilters({
          roles: [],
          patreon: { isActive: true, tier },
        } as never)
      ).toBe(true);
    }
  });

  it('allows admins', () => {
    expect(
      hasLevelRecommendationFilters({ roles: [userRoles.admin] } as never)
    ).toBe(true);
  });

  it('denies free users, Donators, and lapsed supporters', () => {
    expect(hasLevelRecommendationFilters({ roles: [] } as never)).toBe(false);
    expect(
      hasLevelRecommendationFilters({
        roles: [],
        patreon: { isActive: true, tier: 'donator' },
      } as never)
    ).toBe(false);
    expect(
      hasLevelRecommendationFilters({
        roles: [],
        patreon: { isActive: false, tier: 'consumer' },
      } as never)
    ).toBe(false);
  });
});

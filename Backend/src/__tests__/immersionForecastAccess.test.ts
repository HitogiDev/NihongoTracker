import { describe, expect, it } from 'vitest';
import { hasImmersionForecastAccess } from '../services/immersionForecastAccess.js';
import { userRoles } from '../types.js';

const user = (
  tier: 'donator' | 'enthusiast' | 'consumer' | null,
  isActive = true,
  roles: userRoles[] = []
) => ({ roles, patreon: { tier, isActive } });

describe('hasImmersionForecastAccess', () => {
  it('allows active Enthusiast, Consumer, and admins', () => {
    expect(hasImmersionForecastAccess(user('enthusiast'))).toBe(true);
    expect(hasImmersionForecastAccess(user('consumer'))).toBe(true);
    expect(
      hasImmersionForecastAccess(user(null, false, [userRoles.admin]))
    ).toBe(true);
  });

  it('rejects inactive and lower tiers', () => {
    expect(hasImmersionForecastAccess(user('enthusiast', false))).toBe(false);
    expect(hasImmersionForecastAccess(user('donator'))).toBe(false);
    expect(hasImmersionForecastAccess(user(null))).toBe(false);
  });
});

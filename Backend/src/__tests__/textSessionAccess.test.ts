import { describe, expect, it } from 'vitest';
import { hasSessionIntelligenceAccess } from '../services/textSessionAccess.js';
import { userRoles } from '../types.js';

const user = (
  tier: 'donator' | 'enthusiast' | 'consumer' | null,
  isActive = true,
  roles: userRoles[] = [userRoles.user]
) => ({ roles, patreon: { tier, isActive } });

describe('hasSessionIntelligenceAccess', () => {
  it('allows active Enthusiast and Consumer supporters', () => {
    expect(hasSessionIntelligenceAccess(user('enthusiast'))).toBe(true);
    expect(hasSessionIntelligenceAccess(user('consumer'))).toBe(true);
  });

  it('rejects Donator, inactive, and free accounts', () => {
    expect(hasSessionIntelligenceAccess(user('donator'))).toBe(false);
    expect(hasSessionIntelligenceAccess(user('enthusiast', false))).toBe(false);
    expect(hasSessionIntelligenceAccess(user(null))).toBe(false);
  });

  it('allows administrators independently of Patreon', () => {
    expect(
      hasSessionIntelligenceAccess(user(null, false, [userRoles.admin]))
    ).toBe(true);
  });
});

import type { IUser } from '../types';

type AccessUser = Pick<IUser, 'patreon' | 'roles'> | null | undefined;

/** Mirrors `hasEnthusiastAccess` in the backend. The API still enforces it. */
export function hasEnthusiastAccess(user: AccessUser): boolean {
  return Boolean(
    user?.roles?.includes('admin') ||
      (user?.patreon?.isActive &&
        (user.patreon.tier === 'enthusiast' ||
          user.patreon.tier === 'consumer'))
  );
}

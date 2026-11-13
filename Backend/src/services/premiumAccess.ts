import { IUser, userRoles } from '../types.js';

type AccessUser = Pick<IUser, 'roles' | 'patreon'>;

/** Active Enthusiast or Consumer patrons and admins. */
export function hasEnthusiastAccess(user: AccessUser): boolean {
  const tier = user.patreon?.tier;
  return Boolean(
    user.roles?.includes(userRoles.admin) ||
      (user.patreon?.isActive && (tier === 'enthusiast' || tier === 'consumer'))
  );
}

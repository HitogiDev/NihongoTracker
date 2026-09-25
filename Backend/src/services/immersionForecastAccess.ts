import { IUser, userRoles } from '../types.js';

type ForecastUser = Pick<IUser, 'roles' | 'patreon'>;

export function hasImmersionForecastAccess(user: ForecastUser): boolean {
  const tier = user.patreon?.tier;
  return Boolean(
    user.roles?.includes(userRoles.admin) ||
      (user.patreon?.isActive && (tier === 'enthusiast' || tier === 'consumer'))
  );
}

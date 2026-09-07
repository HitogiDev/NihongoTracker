import { IUser, userRoles } from '../types.js';

type SessionIntelligenceUser = Pick<IUser, 'roles' | 'patreon'>;

export function hasSessionIntelligenceAccess(user: SessionIntelligenceUser) {
  const tier = user.patreon?.tier;
  return Boolean(
    user.roles?.includes(userRoles.admin) ||
      (user.patreon?.isActive && (tier === 'enthusiast' || tier === 'consumer'))
  );
}

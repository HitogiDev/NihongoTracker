import { IUser, userRoles } from '../types.js';

type LevelRecommendationUser = Pick<IUser, 'roles' | 'patreon'>;

/** Filters, difficulty shift, and dismissals need Enthusiast, Consumer, or admin access. */
export function hasLevelRecommendationFilters(
  user: LevelRecommendationUser
): boolean {
  const tier = user.patreon?.tier;
  return Boolean(
    user.roles?.includes(userRoles.admin) ||
      (user.patreon?.isActive && (tier === 'enthusiast' || tier === 'consumer'))
  );
}

import { IUser, userRoles } from '../types.js';

type PostImageUser = Pick<IUser, 'roles' | 'patreon'>;

/**
 * Hosted post images need Enthusiast, Consumer, or admin access.
 * External image links are free for all users.
 */
export function hasHostedPostImages(user: PostImageUser): boolean {
  const tier = user.patreon?.tier;
  return Boolean(
    user.roles?.includes(userRoles.admin) ||
      (user.patreon?.isActive && (tier === 'enthusiast' || tier === 'consumer'))
  );
}

/** Post borders and backgrounds are a supporter cosmetic with the same tiers. */
export const hasPostDecorations = hasHostedPostImages;

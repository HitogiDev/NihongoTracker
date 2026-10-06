import { IUser, userRoles } from '../types.js';
import { apiError } from '../i18n/errorCodes.js';
import { canViewUserSocialCategory } from './socialVisibility.service.js';

export async function requireGoalVisibility(
  owner: Pick<IUser, '_id' | 'settings'>,
  viewer?: IUser
) {
  for (const category of ['profile', 'statistics'] as const) {
    if (
      !(await canViewUserSocialCategory({
        ownerId: owner._id,
        viewerId: viewer?._id,
        settings: owner.settings,
        category,
        bypass: viewer?.roles?.includes(userRoles.admin),
      }))
    ) {
      throw apiError(
        category === 'profile'
          ? 'privacy.profileRestricted'
          : 'privacy.statisticsRestricted',
        403,
        category === 'profile'
          ? 'This profile is private'
          : 'This user has restricted their statistics'
      );
    }
  }
}

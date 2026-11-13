import { IUser } from '../types.js';
import { hasEnthusiastAccess } from './premiumAccess.js';

type ForecastUser = Pick<IUser, 'roles' | 'patreon'>;

export function hasImmersionForecastAccess(user: ForecastUser): boolean {
  return hasEnthusiastAccess(user);
}

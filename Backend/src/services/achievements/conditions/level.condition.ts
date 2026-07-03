import { Types } from 'mongoose';
import User from '../../../models/user.model.js';

/**
 * Checks user level for a given stat field.
 * Supported stat values: 'userLevel', 'readingLevel', 'listeningLevel'
 */
export async function evaluateLevel(
  userId: Types.ObjectId,
  stat: string,
  threshold: number
): Promise<{ met: boolean; progress: number }> {
  const user = await User.findById(userId).select('stats').lean();
  if (!user?.stats) return { met: false, progress: 0 };

  const validStats = ['userLevel', 'readingLevel', 'listeningLevel'];
  const statKey = validStats.includes(stat) ? stat : 'userLevel';
  const level = (user.stats as any)[statKey] ?? 1;

  return { met: level >= threshold, progress: level };
}

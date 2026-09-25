import { Types } from 'mongoose';
import User from '../../../models/user.model.js';

export async function evaluateTotalXp(
  userId: Types.ObjectId,
  threshold: number
): Promise<{ met: boolean; progress: number }> {
  const user = await User.findById(userId).select('stats.userXp').lean();
  const xp = user?.stats?.userXp ?? 0;
  return { met: xp >= threshold, progress: xp };
}

import { Types } from 'mongoose';
import User from '../../../models/user.model.js';

/** Requires both category levels to reach the threshold. */
export async function evaluateReadingListeningLevel(
  userId: Types.ObjectId,
  threshold: number
): Promise<{ met: boolean; progress: number }> {
  const user = await User.findById(userId).select('stats').lean();
  const readingLevel = Number(user?.stats?.readingLevel ?? 1);
  const listeningLevel = Number(user?.stats?.listeningLevel ?? 1);
  const progress = Math.min(readingLevel, listeningLevel);

  return {
    met: readingLevel >= threshold && listeningLevel >= threshold,
    progress,
  };
}

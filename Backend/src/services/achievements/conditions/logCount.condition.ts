import { Types } from 'mongoose';
import Log from '../../../models/log.model.js';

export async function evaluateLogCount(
  userId: Types.ObjectId,
  threshold: number
): Promise<{ met: boolean; progress: number }> {
  const count = await Log.countDocuments({ user: userId });
  return { met: count >= threshold, progress: count };
}

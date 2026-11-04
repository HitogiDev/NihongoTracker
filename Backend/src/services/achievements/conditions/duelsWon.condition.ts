import { Types } from 'mongoose';
import Duel from '../../../models/duel.model.js';

/** Counts duels the user won outright. Draws do not count. */
export async function evaluateDuelsWon(
  userId: Types.ObjectId,
  threshold: number
): Promise<{ met: boolean; progress: number }> {
  const count = await Duel.countDocuments({
    status: 'completed',
    winner: userId,
  });
  return { met: count >= threshold, progress: count };
}

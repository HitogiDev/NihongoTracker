import { Types } from 'mongoose';
import { Club } from '../../../models/club.model.js';

/**
 * Counts the clubs the user is currently an active member of (founded or
 * joined). Used for the secret Club Hopper.
 */
export async function evaluateClubsJoined(
  userId: Types.ObjectId,
  threshold: number
): Promise<{ met: boolean; progress: number }> {
  const count = await Club.countDocuments({
    members: { $elemMatch: { user: userId, status: 'active' } },
  });

  return { met: count >= threshold, progress: count };
}

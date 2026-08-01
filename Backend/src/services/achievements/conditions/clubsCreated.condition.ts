import { Types } from 'mongoose';
import { Club } from '../../../models/club.model.js';

/**
 * Counts the clubs the user founded. The creator is stored as the club's
 * 'leader' member, so that role is what identifies a founder.
 * Used for Club Founder (create an immersion club).
 */
export async function evaluateClubsCreated(
  userId: Types.ObjectId,
  threshold: number
): Promise<{ met: boolean; progress: number }> {
  const count = await Club.countDocuments({
    members: { $elemMatch: { user: userId, role: 'leader' } },
  });

  return { met: count >= threshold, progress: count };
}

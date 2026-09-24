import { Types } from 'mongoose';
import ClubChallenge from '../../../models/clubChallenge.model.js';

/** Counts individual club challenges explicitly completed by the user. */
export async function evaluateCompletedClubChallenges(
  userId: Types.ObjectId,
  threshold: number
): Promise<{ met: boolean; progress: number }> {
  const count = await ClubChallenge.countDocuments({
    completedParticipants: userId,
  });
  return { met: count >= threshold, progress: count };
}

import { Types } from 'mongoose';
import WeeklyRankSnapshot from '../../../models/weeklyRankSnapshot.model.js';

/**
 * Dethroned: the user held #1 on the weekly leaderboard and later showed up in
 * a snapshot at a worse position — somebody took the top spot from them.
 *
 * Reads the weekly snapshots the rank cron already records.
 */
export async function evaluateRankDethroned(
  userId: Types.ObjectId
): Promise<{ met: boolean; progress: number }> {
  const snapshots = await WeeklyRankSnapshot.find({ userId })
    .select('weekStart position')
    .sort({ weekStart: 1 })
    .lean();

  let wasFirst = false;
  for (const snapshot of snapshots) {
    if (wasFirst && snapshot.position > 1) {
      return { met: true, progress: 1 };
    }
    if (snapshot.position === 1) wasFirst = true;
  }

  return { met: false, progress: 0 };
}

import { Types } from 'mongoose';
import { getStreakRuns } from './streakHistory.js';

/**
 * Loyal: after breaking a streak, the user came straight back and logged every
 * day for a full week.
 *
 * Only runs after the first count — the very first streak was never preceded by
 * a break. Progress is the longest such comeback run.
 */
export async function evaluateStreakAfterBreak(
  userId: Types.ObjectId,
  threshold: number,
  timezone = 'UTC'
): Promise<{ met: boolean; progress: number }> {
  const runs = await getStreakRuns(userId, timezone);
  if (runs.length < 2) return { met: false, progress: 0 };

  const longestComeback = Math.max(...runs.slice(1).map((r) => r.length));

  return { met: longestComeback >= threshold, progress: longestComeback };
}

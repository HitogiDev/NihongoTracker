import { Types } from 'mongoose';
import { getStreakRuns } from './streakHistory.js';

/**
 * Phoenix: the user broke a streak and then built a longer one than any they
 * had before it.
 *
 * `threshold` is the minimum length that comeback streak must reach, so a
 * couple of days after a single stray log day don't count.
 * Progress is the length of the best comeback streak so far.
 */
export async function evaluateStreakComeback(
  userId: Types.ObjectId,
  threshold: number,
  timezone = 'UTC'
): Promise<{ met: boolean; progress: number }> {
  const runs = await getStreakRuns(userId, timezone);
  if (runs.length < 2) return { met: false, progress: 0 };

  let bestBefore = runs[0].length;
  let bestComeback = 0;

  for (let i = 1; i < runs.length; i++) {
    // Every run after the first follows a broken streak
    if (runs[i].length > bestBefore && runs[i].length > bestComeback) {
      bestComeback = runs[i].length;
    }
    if (runs[i].length > bestBefore) bestBefore = runs[i].length;
  }

  return { met: bestComeback >= threshold, progress: bestComeback };
}

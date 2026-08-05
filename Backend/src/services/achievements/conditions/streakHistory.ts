import { Types } from 'mongoose';
import Log from '../../../models/log.model.js';

export interface StreakRun {
  startKey: string;
  endKey: string;
  length: number;
}

/**
 * Rebuilds every streak the user has ever had, in order, from their logs.
 * Days are bucketed in the user's timezone; unknownDate logs are ignored the
 * same way streaks.ts ignores them.
 *
 * A "run" is a maximal set of consecutive logged days, so any run after the
 * first is by definition one the user started after breaking a streak.
 */
export async function getStreakRuns(
  userId: Types.ObjectId,
  timezone: string
): Promise<StreakRun[]> {
  const rows = await Log.aggregate<{ _id: string }>([
    { $match: { user: userId, unknownDate: { $ne: true } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$date', timezone } },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  if (rows.length === 0) return [];

  const dayMs = 24 * 60 * 60 * 1000;
  const toTime = (key: string) => {
    const [y, m, d] = key.split('-').map(Number);
    // UTC midnight anchors keep days exactly 24h apart across DST
    return Date.UTC(y, m - 1, d);
  };

  const runs: StreakRun[] = [];
  let start = rows[0]._id;
  let prev = rows[0]._id;
  let length = 1;

  for (let i = 1; i < rows.length; i++) {
    const key = rows[i]._id;
    if (toTime(key) - toTime(prev) === dayMs) {
      length++;
    } else {
      runs.push({ startKey: start, endKey: prev, length });
      start = key;
      length = 1;
    }
    prev = key;
  }
  runs.push({ startKey: start, endKey: prev, length });

  return runs;
}

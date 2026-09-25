import { Types } from 'mongoose';
import Log from '../../../models/log.model.js';
import {
  EFFECTIVE_MINUTES_EXPR,
  HAS_EFFECTIVE_TIME_MATCH,
} from './effectiveMinutes.js';

/**
 * Finds the longest run of consecutive days on which the user logged at least
 * `hours` hours every single day.
 * Used for the secret Iron Will (7 days straight of 4h+).
 *
 * Days are bucketed in the user's timezone; unknownDate logs are ignored.
 * Progress is the longest qualifying run found.
 */
export async function evaluateConsecutiveDaysWithHours(
  userId: Types.ObjectId,
  threshold: number,
  hours: number,
  timezone = 'UTC'
): Promise<{ met: boolean; progress: number }> {
  const rows = await Log.aggregate<{ _id: string; totalMinutes: number }>([
    {
      $match: {
        user: userId,
        unknownDate: { $ne: true },
        ...HAS_EFFECTIVE_TIME_MATCH,
      },
    },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$date', timezone } },
        totalMinutes: { $sum: EFFECTIVE_MINUTES_EXPR },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const required = hours * 60;
  const dayMs = 24 * 60 * 60 * 1000;
  const toTime = (key: string) => {
    const [y, m, d] = key.split('-').map(Number);
    // UTC midnight anchors keep days exactly 24h apart across DST
    return Date.UTC(y, m - 1, d);
  };

  let longest = 0;
  let run = 0;
  let prevTime: number | null = null;

  for (const row of rows) {
    if (row.totalMinutes < required) {
      run = 0;
      prevTime = null;
      continue;
    }

    const time = toTime(row._id);
    run = prevTime !== null && time - prevTime === dayMs ? run + 1 : 1;
    prevTime = time;
    if (run > longest) longest = run;
  }

  return { met: longest >= threshold, progress: longest };
}

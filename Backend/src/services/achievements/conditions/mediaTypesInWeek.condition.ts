import { Types } from 'mongoose';
import Log from '../../../models/log.model.js';

/**
 * Finds the highest number of distinct media types logged inside any rolling
 * window of `windowDays` days. Used for Renaissance Learner (6 types in a week)
 * and the secret The Floor Is Lava (4 types in a single day).
 *
 * Days are bucketed in the user's timezone, and the window slides over logged
 * days the same way weeklyHours does.
 */
export async function evaluateMediaTypesInWeek(
  userId: Types.ObjectId,
  threshold: number,
  timezone = 'UTC',
  windowDays = 7
): Promise<{ met: boolean; progress: number }> {
  const rows = await Log.aggregate<{ _id: { day: string; type: string } }>([
    // unknownDate logs have a placeholder date — they belong to no real week
    { $match: { user: userId, unknownDate: { $ne: true } } },
    {
      $group: {
        _id: {
          day: { $dateToString: { format: '%Y-%m-%d', date: '$date', timezone } },
          type: '$type',
        },
      },
    },
    { $sort: { '_id.day': 1 } },
  ]);

  if (rows.length === 0) return { met: false, progress: 0 };

  // Collapse to one entry per day holding that day's set of types
  const byDay = new Map<string, string[]>();
  for (const row of rows) {
    const types = byDay.get(row._id.day);
    if (types) types.push(row._id.type);
    else byDay.set(row._id.day, [row._id.type]);
  }

  const days = Array.from(byDay.entries())
    .map(([day, types]) => {
      const [y, m, d] = day.split('-').map(Number);
      // UTC midnight anchors keep every day exactly 24h apart across DST
      return { time: Date.UTC(y, m - 1, d), types };
    })
    .sort((a, b) => a.time - b.time);

  const WINDOW_MS = windowDays * 24 * 60 * 60 * 1000;
  // Types currently inside the window -> how many of the window's days have them
  const counts = new Map<string, number>();

  const add = (types: string[]) => {
    for (const t of types) counts.set(t, (counts.get(t) ?? 0) + 1);
  };
  const remove = (types: string[]) => {
    for (const t of types) {
      const next = (counts.get(t) ?? 0) - 1;
      if (next > 0) counts.set(t, next);
      else counts.delete(t);
    }
  };

  let maxTypes = 0;
  let windowStart = 0;

  for (let i = 0; i < days.length; i++) {
    add(days[i].types);

    while (days[i].time - days[windowStart].time >= WINDOW_MS) {
      remove(days[windowStart].types);
      windowStart++;
    }

    if (counts.size > maxTypes) maxTypes = counts.size;
  }

  return { met: maxTypes >= threshold, progress: maxTypes };
}

import { Types } from 'mongoose';
import Log from '../../../models/log.model.js';
import { LISTENING_TYPES, READING_TYPES } from '../../xp.js';

/** Counts distinct local days that contain at least one reading and one listening log. */
export async function evaluateReadingListeningDays(
  userId: Types.ObjectId,
  threshold: number,
  timezone = 'UTC'
): Promise<{ met: boolean; progress: number }> {
  const rows = await Log.aggregate<{
    _id: { day: string; type: string };
  }>([
    {
      $match: {
        user: userId,
        unknownDate: { $ne: true },
        type: { $in: [...READING_TYPES, ...LISTENING_TYPES] },
      },
    },
    {
      $group: {
        _id: {
          day: {
            $dateToString: { format: '%Y-%m-%d', date: '$date', timezone },
          },
          type: '$type',
        },
      },
    },
    { $sort: { '_id.day': 1 } },
  ]);

  const readingTypes = new Set<string>(READING_TYPES);
  const listeningTypes = new Set<string>(LISTENING_TYPES);
  const typesByDay = new Map<string, Set<string>>();
  for (const row of rows) {
    const types = typesByDay.get(row._id.day) ?? new Set<string>();
    types.add(row._id.type);
    typesByDay.set(row._id.day, types);
  }

  let qualifyingDays = 0;
  for (const types of typesByDay.values()) {
    const hasReading = [...types].some((type) => readingTypes.has(type));
    const hasListening = [...types].some((type) => listeningTypes.has(type));
    if (hasReading && hasListening) qualifyingDays += 1;
  }

  return { met: qualifyingDays >= threshold, progress: qualifyingDays };
}

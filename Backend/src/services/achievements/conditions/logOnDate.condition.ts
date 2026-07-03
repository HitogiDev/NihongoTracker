import { Types } from 'mongoose';
import Log from '../../../models/log.model.js';

/**
 * Checks whether the user has logged on a specific calendar date (any year).
 * datePattern is a 'MM-DD' string, e.g. '07-07' for Tanabata.
 */
export async function evaluateLogOnDate(
  userId: Types.ObjectId,
  datePattern: string
): Promise<{ met: boolean; progress: number }> {
  const [month, day] = datePattern.split('-').map(Number);

  const log = await Log.findOne({
    user: userId,
    $expr: {
      $and: [
        { $eq: [{ $month: '$date' }, month] },
        { $eq: [{ $dayOfMonth: '$date' }, day] },
      ],
    },
  })
    .select('_id')
    .lean();

  return { met: !!log, progress: log ? 1 : 0 };
}

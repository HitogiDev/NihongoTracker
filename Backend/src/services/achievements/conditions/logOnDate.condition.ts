import { Types } from 'mongoose';
import Log from '../../../models/log.model.js';

/**
 * Checks whether the user has logged on a specific calendar date (any year), as
 * seen in the user's timezone.
 * datePattern is a 'MM-DD' string, e.g. '07-07' for Tanabata.
 */
export async function evaluateLogOnDate(
  userId: Types.ObjectId,
  datePattern: string,
  timezone = 'UTC'
): Promise<{ met: boolean; progress: number }> {
  const [month, day] = datePattern.split('-').map(Number);

  const log = await Log.findOne({
    user: userId,
    // unknownDate logs have a placeholder date — they can't prove the user
    // logged on a specific calendar day
    unknownDate: { $ne: true },
    $expr: {
      $and: [
        { $eq: [{ $month: { date: '$date', timezone } }, month] },
        { $eq: [{ $dayOfMonth: { date: '$date', timezone } }, day] },
      ],
    },
  })
    .select('_id')
    .lean();

  return { met: !!log, progress: log ? 1 : 0 };
}

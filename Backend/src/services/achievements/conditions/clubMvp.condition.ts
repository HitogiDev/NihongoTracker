import { Types } from 'mongoose';
import { Club } from '../../../models/club.model.js';
import Log from '../../../models/log.model.js';

/**
 * Checks whether the user finished as the top contributor on a club challenge —
 * a club media whose reading/watching period has ended.
 * Used for Club MVP.
 *
 * "Top contributor" is the most XP logged against that media by an active club
 * member during the challenge window, matching the club media rankings screen.
 * Only ended challenges count: a lead in an ongoing one can still be lost.
 */
export async function evaluateClubMvp(
  userId: Types.ObjectId,
  threshold: number
): Promise<{ met: boolean; progress: number }> {
  const now = new Date();

  const clubs = await Club.find({
    members: { $elemMatch: { user: userId, status: 'active' } },
  })
    .select('members currentMedia')
    .lean();

  let wins = 0;

  for (const club of clubs) {
    const memberIds = club.members
      .filter((m) => m.status === 'active')
      .map((m) => m.user);

    for (const media of club.currentMedia ?? []) {
      if (!media.mediaId || !media.endDate || new Date(media.endDate) > now) {
        continue;
      }

      const [top] = await Log.aggregate<{ _id: Types.ObjectId; totalXp: number }>(
        [
          {
            $match: {
              user: { $in: memberIds },
              mediaId: media.mediaId,
              type: media.mediaType,
              unknownDate: { $ne: true },
              date: { $gte: new Date(media.startDate), $lte: new Date(media.endDate) },
            },
          },
          { $group: { _id: '$user', totalXp: { $sum: { $ifNull: ['$xp', 0] } } } },
          { $sort: { totalXp: -1 } },
          { $limit: 1 },
        ]
      );

      if (top && top.totalXp > 0 && top._id.toString() === userId.toString()) {
        wins++;
        if (wins >= threshold) return { met: true, progress: wins };
      }
    }
  }

  return { met: wins >= threshold, progress: wins };
}

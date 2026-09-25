import { FilterQuery, Types } from 'mongoose';
import Log from '../models/log.model.js';
import User from '../models/user.model.js';
import { IClub, IClubMedia, ILog } from '../types.js';
import { buildVisibleImmersionLogFilter } from './socialVisibility.service.js';

interface MediaEngagementRow {
  _id: { mediaId: string; mediaType: string; user: Types.ObjectId };
  logs: number;
  time: number;
  chars: number;
  pages: number;
  episodes: number;
}

export async function getClubMediaEngagement(input: {
  club: Pick<IClub, 'members'>;
  media: IClubMedia[];
  viewerId?: Types.ObjectId;
}) {
  if (input.media.length === 0) return new Map<string, object>();
  const memberIds = input.club.members
    .filter((member) => member.status === 'active')
    .map((member) => member.user);
  const visibility = await buildVisibleImmersionLogFilter(
    memberIds,
    input.viewerId,
    'immersionActivity'
  );
  const mediaClauses: FilterQuery<ILog>[] = input.media
    .filter((media) => media.mediaId)
    .map((media) => ({
      mediaId: media.mediaId,
      type: media.mediaType,
      unknownDate: { $ne: true },
      date: { $gte: media.startDate, $lte: media.endDate },
    }));
  if (mediaClauses.length === 0) return new Map<string, object>();
  const rows = await Log.aggregate<MediaEngagementRow>([
    { $match: { ...visibility, $or: mediaClauses } },
    {
      $group: {
        _id: { mediaId: '$mediaId', mediaType: '$type', user: '$user' },
        logs: { $sum: 1 },
        time: { $sum: { $ifNull: ['$time', 0] } },
        chars: { $sum: { $ifNull: ['$chars', 0] } },
        pages: { $sum: { $ifNull: ['$pages', 0] } },
        episodes: { $sum: { $ifNull: ['$episodes', 0] } },
      },
    },
  ]);
  const userIds = [...new Set(rows.map((row) => row._id.user.toString()))].map(
    (id) => new Types.ObjectId(id)
  );
  const users = await User.find({ _id: { $in: userIds } })
    .select('_id username avatar')
    .lean();
  const userById = new Map(users.map((user) => [user._id.toString(), user]));
  const result = new Map<string, object>();
  for (const media of input.media) {
    const key = `${media.mediaType}:${media.mediaId ?? ''}`;
    const mediaRows = rows.filter(
      (row) =>
        row._id.mediaId === media.mediaId &&
        row._id.mediaType === media.mediaType
    );
    result.set(key, {
      participantCount: mediaRows.length,
      participants: mediaRows
        .map((row) => userById.get(row._id.user.toString()))
        .filter(Boolean),
      aggregateProgress: mediaRows.reduce(
        (totals, row) => ({
          logs: totals.logs + row.logs,
          minutes: totals.minutes + row.time,
          characters: totals.characters + row.chars,
          pages: totals.pages + row.pages,
          episodes: totals.episodes + row.episodes,
        }),
        { logs: 0, minutes: 0, characters: 0, pages: 0, episodes: 0 }
      ),
    });
  }
  return result;
}

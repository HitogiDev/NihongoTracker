import { Types } from 'mongoose';
import User from '../models/user.model.js';
import { IClub } from '../types.js';
import {
  aggregateVisibleLogMetricByUser,
  ClubLogMetric,
} from './clubLogMetrics.service.js';
import { getVisibleSocialOwnerIds } from './socialVisibility.service.js';

export type ClubLeaderboardMetric = Extract<
  ClubLogMetric,
  'xp' | 'time' | 'chars' | 'reading' | 'listening'
>;
export type ClubLeaderboardPeriod = 'week' | 'month' | 'all-time';

function periodStart(period: ClubLeaderboardPeriod, now = new Date()) {
  if (period === 'all-time') return undefined;
  if (period === 'month') {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  }
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
  start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
  return start;
}

export async function getClubLeaderboard(input: {
  club: Pick<IClub, 'members'>;
  viewerId?: Types.ObjectId;
  metric: ClubLeaderboardMetric;
  period: ClubLeaderboardPeriod;
}) {
  const memberIds = input.club.members
    .filter((member) => member.status === 'active')
    .map((member) => member.user);
  const visibleMemberIds = await getVisibleSocialOwnerIds({
    ownerIds: memberIds,
    viewerId: input.viewerId,
    category: 'statistics',
  });
  const rows = await aggregateVisibleLogMetricByUser({
    ownerIds: visibleMemberIds,
    viewerId: input.viewerId,
    metric: input.metric,
    startDate: periodStart(input.period),
  });
  const users = await User.find({ _id: { $in: visibleMemberIds } })
    .select('_id username avatar stats.userLevel')
    .lean();
  const valueByUser = new Map(
    rows.map((row) => [row._id.toString(), row.value])
  );
  return users
    .map((user) => ({ user, value: valueByUser.get(user._id.toString()) ?? 0 }))
    .filter((entry) => input.period === 'all-time' || entry.value > 0)
    .sort((left, right) => right.value - left.value)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}

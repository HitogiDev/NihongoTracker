import { FilterQuery, PipelineStage, Types } from 'mongoose';
import Log from '../models/log.model.js';
import { ClubChallengeMetric, ILog } from '../types.js';
import { LISTENING_TYPES, READING_TYPES } from './xp.js';
import { buildVisibleImmersionLogFilter } from './socialVisibility.service.js';

export type ClubLogMetric =
  | ClubChallengeMetric
  | 'xp'
  | 'reading'
  | 'listening';

export interface ClubLogMetricRow {
  _id: Types.ObjectId;
  value: number;
}

interface ClubLogMetricInput {
  ownerIds: Types.ObjectId[];
  viewerId?: Types.ObjectId;
  metric: ClubLogMetric;
  startDate?: Date;
  endDate?: Date;
  mediaId?: string;
  mediaType?: string;
  privacyCategory?: 'statistics' | 'immersionActivity';
}

const effectiveTimeExpression = {
  $cond: [
    {
      $and: [
        { $in: ['$type', ['anime', 'tv show']] },
        {
          $or: [
            { $eq: ['$time', 0] },
            { $eq: ['$time', null] },
            { $eq: [{ $type: '$time' }, 'missing'] },
          ],
        },
        { $gt: ['$episodes', 0] },
      ],
    },
    { $multiply: ['$episodes', 24] },
    { $ifNull: ['$time', 0] },
  ],
};

function metricExpression(metric: Exclude<ClubLogMetric, 'active_days'>) {
  if (metric === 'time') return effectiveTimeExpression;
  if (metric === 'xp') return { $ifNull: ['$xp', 0] };
  if (metric === 'chars') return { $ifNull: ['$chars', 0] };
  if (metric === 'pages') return { $ifNull: ['$pages', 0] };
  if (metric === 'episodes') return { $ifNull: ['$episodes', 0] };
  if (metric === 'reading') {
    return {
      $cond: [{ $in: ['$type', READING_TYPES] }, effectiveTimeExpression, 0],
    };
  }
  return {
    $cond: [{ $in: ['$type', LISTENING_TYPES] }, effectiveTimeExpression, 0],
  };
}

export async function aggregateVisibleLogMetricByUser(
  input: ClubLogMetricInput
): Promise<ClubLogMetricRow[]> {
  if (input.ownerIds.length === 0) return [];
  const visibilityFilter = await buildVisibleImmersionLogFilter(
    input.ownerIds,
    input.viewerId,
    input.privacyCategory ?? 'statistics'
  );
  const match: FilterQuery<ILog> = {
    ...visibilityFilter,
    unknownDate: { $ne: true },
    ...(input.startDate || input.endDate
      ? {
          date: {
            ...(input.startDate ? { $gte: input.startDate } : {}),
            ...(input.endDate ? { $lte: input.endDate } : {}),
          },
        }
      : {}),
    ...(input.mediaId ? { mediaId: input.mediaId } : {}),
    ...(input.mediaType ? { type: input.mediaType } : {}),
  };

  if (input.metric === 'active_days') {
    return Log.aggregate<ClubLogMetricRow>([
      { $match: match },
      {
        $group: {
          _id: {
            user: '$user',
            day: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
          },
        },
      },
      { $group: { _id: '$_id.user', value: { $sum: 1 } } },
    ]);
  }

  const pipeline: PipelineStage[] = [
    { $match: match },
    {
      $group: {
        _id: '$user',
        value: { $sum: metricExpression(input.metric) },
      },
    },
  ];
  return Log.aggregate<ClubLogMetricRow>(pipeline);
}

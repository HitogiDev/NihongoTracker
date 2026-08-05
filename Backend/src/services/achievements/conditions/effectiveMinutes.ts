/**
 * Effective logged minutes for a log document.
 *
 * Anime episodes are commonly logged without a duration, and the rest of the
 * app (profile stats, club rankings) treats those as 24 minutes per episode.
 * The achievement evaluators used to sum `time` alone and additionally filter
 * on `time > 0`, so those episode-only logs were dropped entirely — a user
 * whose profile proudly showed 2,000 hours could be far short of the
 * "2,000 hours" achievement. Keep this in sync with the stats aggregation in
 * users.controller.ts.
 */
export const EFFECTIVE_MINUTES_EXPR = {
  $cond: [
    {
      $and: [
        { $eq: ['$type', 'anime'] },
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

/**
 * Matches logs that contribute any time at all: either a real duration, or an
 * anime entry with episodes we can convert. Replaces the old `time: { $gt: 0 }`
 * filter, which silently discarded episode-only anime logs.
 */
export const HAS_EFFECTIVE_TIME_MATCH = {
  $or: [
    { time: { $gt: 0 } },
    { type: 'anime', episodes: { $gt: 0 } },
  ],
};

/** Same rule as EFFECTIVE_MINUTES_EXPR, for documents already in memory. */
export function effectiveMinutes(log: {
  type?: string;
  time?: number | null;
  episodes?: number | null;
}): number {
  if (log.type === 'anime' && !log.time && (log.episodes ?? 0) > 0) {
    return (log.episodes as number) * 24;
  }
  return log.time ?? 0;
}

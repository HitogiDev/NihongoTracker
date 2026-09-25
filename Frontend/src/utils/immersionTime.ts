/**
 * Minutes a log actually contributes to immersion totals.
 *
 * Anime is routinely logged as "3 episodes" with no duration, so summing `time`
 * alone silently drops those logs. Every server-side total (profile stats,
 * club rankings, achievement thresholds) converts them at 24 minutes per
 * episode instead.
 *
 * This is the browser-side mirror of `EFFECTIVE_MINUTES_EXPR` /
 * `effectiveMinutes` in
 * `Backend/src/services/achievements/conditions/effectiveMinutes.ts`. Change
 * the rule in both places or the profile will disagree with the stats screen.
 */
export const MINUTES_PER_ANIME_EPISODE = 24;

export function effectiveLogMinutes(log: {
  type?: string;
  time?: number | null;
  episodes?: number | null;
}): number {
  if (log.type === 'anime' && !log.time && (log.episodes ?? 0) > 0) {
    return (log.episodes as number) * MINUTES_PER_ANIME_EPISODE;
  }
  return Math.max(0, Number(log.time) || 0);
}

/** Total effective minutes across a list of logs. */
export function totalEffectiveMinutes(
  logs: ReadonlyArray<{
    type?: string;
    time?: number | null;
    episodes?: number | null;
  }>
): number {
  return logs.reduce((total, log) => total + effectiveLogMinutes(log), 0);
}

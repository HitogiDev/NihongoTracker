/**
 * Pure parsing helpers for AniList list activity.
 *
 * Kept apart from `anilistSync.service.ts` so the parsing rules can be tested
 * without dragging in Mongo, Meilisearch and the achievement engine.
 */

/**
 * Episodes covered by a list activity, or 0 when it isn't episode progress.
 *
 * AniList phrases these as a status plus a progress string: "watched episode"
 * with "5", or "12 - 14" when several episodes were ticked off at once.
 * Status changes ("plans to watch", "completed", "dropped") carry no episode
 * count of their own and are not immersion. "rewatched episode" matches the
 * same substring as "watched episode", which is deliberate — a rewatch is
 * still time spent listening.
 */
export function parseEpisodeProgress(
  status?: string | null,
  progress?: string | null
): number {
  if (!status || !progress) return 0;
  if (!status.toLowerCase().includes('watched episode')) return 0;

  const parts = progress
    .split('-')
    .map((part) => Number.parseInt(part.trim(), 10))
    .filter((value) => Number.isFinite(value));

  if (parts.length === 0) return 0;
  if (parts.length === 1) return 1;

  const [from, to] = parts;
  const span = to - from + 1;
  // Reversed or absurd ranges are bad data, not a 9000-episode binge.
  return span > 0 && span <= 500 ? span : 1;
}

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
  const range = parseEpisodeRange(status, progress);
  if (!range) return 0;
  return range.to - range.from + 1;
}

/**
 * The inclusive episode range a list activity covers, or `null` when it isn't
 * episode progress.
 *
 * AniList combines several consecutive progress updates for the same show into
 * one activity, replacing the originals with a brand-new activity id whose
 * progress spans the whole range ("1" and "2 - 3" become "1 - 3"). Keeping the
 * range — not just the count — is what lets the sync recognise the merged
 * activity as superseding the logs it absorbed instead of duplicating them.
 */
export function parseEpisodeRange(
  status?: string | null,
  progress?: string | null
): { from: number; to: number } | null {
  if (!status || !progress) return null;
  if (!status.toLowerCase().includes('watched episode')) return null;

  const parts = progress
    .split('-')
    .map((part) => Number.parseInt(part.trim(), 10))
    .filter((value) => Number.isFinite(value));

  if (parts.length === 0) return null;
  if (parts.length === 1) return { from: parts[0], to: parts[0] };

  const [from, to] = parts;
  const span = to - from + 1;
  // Reversed or absurd ranges are bad data, not a 9000-episode binge.
  return span > 0 && span <= 500 ? { from, to } : { from, to: from };
}

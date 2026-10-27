import { Types } from 'mongoose';
import Log from '../models/log.model.js';
import { MediaBase } from '../models/media.model.js';
import UserMediaStatus from '../models/userMediaStatus.model.js';
import { fetchJitenDetail } from './jiten.js';

/** Log types that link to a media document. Video is excluded because it tracks channels. */
export const CURRENT_MEDIA_TYPES = [
  'anime',
  'manga',
  'light-novel',
  'vn',
  'game',
  'movie',
  'tv show',
] as const;
export type CurrentMediaType = (typeof CURRENT_MEDIA_TYPES)[number];

export const CURRENT_MEDIA_LIMIT = 3;
const RECENT_WINDOW_DAYS = 30;
/** Extra candidates, because completed or paused media are removed after the query. */
const CANDIDATE_LIMIT = 20;
const INACTIVE_STATUSES = new Set(['completed', 'dropped', 'paused', 'planning']);
const CHARACTER_TYPES = new Set<CurrentMediaType>(['manga', 'light-novel', 'vn', 'game']);

export interface CurrentMediaProgress {
  unit: 'episodes' | 'chars' | 'minutes';
  current: number;
  total: number;
}

export interface CurrentMediaTotals {
  episodes: number;
  chars: number;
  time: number;
}

interface MediaTotalsSource {
  episodes?: number | null;
  characters?: number | null;
  runtime?: number | null;
}

/** Return progress only when a total is known for the unit of the media type. */
export function computeMediaProgress(
  type: CurrentMediaType,
  media: MediaTotalsSource,
  totals: CurrentMediaTotals
): CurrentMediaProgress | null {
  const pick = (
    unit: CurrentMediaProgress['unit'],
    current: number,
    total?: number | null
  ) => (total && total > 0 ? { unit, current, total } : null);

  switch (type) {
    case 'anime':
    case 'tv show':
      return pick('episodes', totals.episodes, media.episodes);
    case 'manga':
    case 'light-novel':
    case 'vn':
    case 'game':
      return pick('chars', totals.chars, media.characters);
    case 'movie':
      return pick('minutes', totals.time, media.runtime);
    default:
      return null;
  }
}

export interface CurrentMediaItem {
  mediaId: string;
  type: CurrentMediaType;
  title: unknown;
  contentImage?: string;
  coverImage?: string;
  isAdult: boolean;
  isAdultImage: boolean;
  lastLogDate: Date;
  progress: CurrentMediaProgress | null;
}

interface CandidateGroup {
  _id: { mediaId: string; type: CurrentMediaType };
  lastLogDate: Date;
}

/** Use the Jiten character count when the media document has none, as auto-complete does. */
async function resolveCharacterTotal(
  { mediaId, type }: CandidateGroup['_id'],
  media: MediaTotalsSource
): Promise<number | null> {
  if (!CHARACTER_TYPES.has(type)) return null;
  if (media.characters && media.characters > 0) return media.characters;
  const detail = await fetchJitenDetail(type, mediaId);
  const count = Number(detail?.data.mainDeck.characterCount);
  return Number.isFinite(count) && count > 0 ? count : null;
}

/**
 * Return the media that a user logged most recently and has not finished.
 * Media with a completed, dropped, paused, planning, or hidden status are skipped.
 * Media at full progress are skipped with the same rule that MediaDetails uses to auto-complete them.
 */
export async function getCurrentMedia(
  userId: Types.ObjectId,
  now = new Date()
): Promise<CurrentMediaItem[]> {
  const since = new Date(now.getTime() - RECENT_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const candidates = await Log.aggregate<CandidateGroup>([
    {
      $match: {
        user: userId,
        private: { $ne: true },
        type: { $in: [...CURRENT_MEDIA_TYPES] },
        mediaId: { $nin: [null, ''] },
        date: { $gte: since, $lte: now },
      },
    },
    {
      $group: {
        _id: { mediaId: '$mediaId', type: '$type' },
        lastLogDate: { $max: '$date' },
      },
    },
    { $sort: { lastLogDate: -1 } },
    { $limit: CANDIDATE_LIMIT },
  ]);
  if (candidates.length === 0) return [];

  const keyOf = (mediaId: string, type: string) => `${type}:${mediaId}`;
  const pairs = candidates.map(({ _id }) => _id);
  const [statuses, mediaDocs, totals] = await Promise.all([
    UserMediaStatus.find({ user: userId, $or: pairs })
      .select('mediaId type status completed autoCompleteSuppressed hiddenFromList')
      .lean(),
    MediaBase.find({
      $or: pairs.map(({ mediaId, type }) => ({ contentId: mediaId, type })),
    })
      .select(
        'contentId type title contentImage coverImage isAdult isAdultImage episodes characters runtime'
      )
      .lean(),
    Log.aggregate<{ _id: CandidateGroup['_id'] } & CurrentMediaTotals>([
      { $match: { user: userId, private: { $ne: true }, $or: pairs } },
      {
        $group: {
          _id: { mediaId: '$mediaId', type: '$type' },
          episodes: { $sum: { $ifNull: ['$episodes', 0] } },
          chars: { $sum: { $ifNull: ['$chars', 0] } },
          time: { $sum: { $ifNull: ['$time', 0] } },
        },
      },
    ]),
  ]);

  const statusByKey = new Map(
    statuses.map((status) => [keyOf(status.mediaId, status.type), status])
  );
  const mediaByKey = new Map(
    mediaDocs.map((media) => [keyOf(media.contentId, media.type), media])
  );
  const totalsByKey = new Map(
    totals.map((total) => [keyOf(total._id.mediaId, total._id.type), total])
  );

  const items: CurrentMediaItem[] = [];
  for (const { _id, lastLogDate } of candidates) {
    const key = keyOf(_id.mediaId, _id.type);
    const status = statusByKey.get(key);
    if (status?.completed || status?.hiddenFromList) continue;
    if (status?.status && INACTIVE_STATUSES.has(status.status)) continue;
    const media = mediaByKey.get(key) as
      | (MediaTotalsSource & Record<string, unknown>)
      | undefined;
    if (!media) continue;

    const progress = computeMediaProgress(
      _id.type,
      { ...media, characters: await resolveCharacterTotal(_id, media) },
      totalsByKey.get(key) ?? { episodes: 0, chars: 0, time: 0 }
    );
    if (
      progress &&
      progress.current >= progress.total &&
      (!status?.autoCompleteSuppressed || status.status === 'in_progress')
    ) {
      continue;
    }

    items.push({
      mediaId: _id.mediaId,
      type: _id.type,
      title: media.title,
      contentImage: media.contentImage as string | undefined,
      coverImage: media.coverImage as string | undefined,
      isAdult: media.isAdult === true,
      isAdultImage: media.isAdultImage === true,
      lastLogDate,
      progress,
    });
    if (items.length === CURRENT_MEDIA_LIMIT) break;
  }
  return items;
}

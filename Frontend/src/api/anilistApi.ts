import { gql, GraphQLClient } from 'graphql-request';
import type { IAnilistStatus, IMediaDocument } from '../types';

const ANILIST_GRAPHQL_URL = 'https://graphql.anilist.co';
const REQUEST_DELAY_MS = 2100;
const ACTIVITIES_PER_PAGE = 50;
const MAX_INCREMENTAL_PAGES = 10;
const MAX_BACKFILL_PAGES = 60;

const anilist = new GraphQLClient(ANILIST_GRAPHQL_URL);

interface IRawFuzzyDate {
  year?: number | null;
  month?: number | null;
  day?: number | null;
}

interface IRawAnilistMedia {
  id: number;
  title: {
    romaji?: string | null;
    english?: string | null;
    native?: string | null;
  };
  type: 'ANIME' | 'MANGA';
  format?: string | null;
  coverImage?: { large?: string | null } | null;
  episodes?: number | null;
  duration?: number | null;
  chapters?: number | null;
  volumes?: number | null;
  synonyms?: string[] | null;
  isAdult?: boolean | null;
  bannerImage?: string | null;
  description?: string | null;
  startDate?: IRawFuzzyDate | null;
  endDate?: IRawFuzzyDate | null;
}

export interface IAnilistClientActivity {
  id: number;
  status?: string | null;
  progress?: string | null;
  createdAt: number;
  media?: { id: number; type: 'ANIME' | 'MANGA' } | null;
}

export interface IAnilistClientSyncPayload {
  activities: IAnilistClientActivity[];
  media: IMediaDocument[];
}

const MEDIA_FIELDS = gql`
  fragment BrowserMediaFields on Media {
    id
    title { romaji english native }
    type
    format
    coverImage { large }
    episodes
    duration
    chapters
    volumes
    synonyms
    isAdult
    bannerImage
    description
    startDate { year month day }
    endDate { year month day }
  }
`;

const SEARCH_QUERY = gql`
  ${MEDIA_FIELDS}
  query BrowserMediaSearch(
    $search: String
    $ids: [Int]
    $type: MediaType
    $format: MediaFormat
    $page: Int
    $perPage: Int
  ) {
    Page(page: $page, perPage: $perPage) {
      media(
        id_in: $ids
        search: $search
        type: $type
        format: $format
        sort: SEARCH_MATCH
      ) { ...BrowserMediaFields }
    }
  }
`;

const SYNC_MEDIA_FIELDS = gql`
  fragment BrowserSyncMediaFields on Media {
    id
    title { romaji english native }
    type
    format
    coverImage { large }
    episodes
    duration
    synonyms
    isAdult
    bannerImage
    startDate { year month day }
    endDate { year month day }
  }
`;

const ACTIVITY_QUERY = gql`
  ${SYNC_MEDIA_FIELDS}
  query BrowserActivitySync(
    $userId: Int
    $page: Int
    $perPage: Int
    $createdAtGreater: Int
  ) {
    Page(page: $page, perPage: $perPage) {
      pageInfo { hasNextPage }
      activities(
        userId: $userId
        type: ANIME_LIST
        createdAt_greater: $createdAtGreater
        sort: ID_DESC
      ) {
        ... on ListActivity {
          id
          status
          progress
          createdAt
          media { ...BrowserSyncMediaFields }
        }
      }
    }
  }
`;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function toFuzzyDate(
  date: IRawFuzzyDate | null | undefined,
  boundary: 'start' | 'end'
): Date | null {
  if (!date?.year) return null;
  if (boundary === 'start') {
    return new Date(Date.UTC(date.year, (date.month ?? 1) - 1, date.day ?? 1));
  }
  if (date.day && date.month) {
    return new Date(Date.UTC(date.year, date.month - 1, date.day + 1) - 1);
  }
  if (date.month) return new Date(Date.UTC(date.year, date.month, 1) - 1);
  return new Date(Date.UTC(date.year + 1, 0, 1) - 1);
}

function mapMedia(media: IRawAnilistMedia): IMediaDocument {
  const isAnime = media.type === 'ANIME';
  const type: IMediaDocument['type'] = isAnime
    ? 'anime'
    : media.format === 'MANGA' || media.format === 'ONE_SHOT'
      ? 'manga'
      : 'light-novel';

  return {
    contentId: media.id.toString(),
    title: {
      contentTitleNative: media.title.native ?? '',
      contentTitleRomaji: media.title.romaji ?? '',
      contentTitleEnglish: media.title.english ?? '',
    },
    contentImage: media.coverImage?.large ?? undefined,
    coverImage: media.bannerImage ?? undefined,
    description: media.description
      ? [{ description: media.description, language: 'eng' }]
      : undefined,
    type,
    episodes: isAnime ? (media.episodes ?? undefined) : undefined,
    episodeDuration: isAnime ? (media.duration ?? undefined) : undefined,
    airingStartDate: isAnime ? toFuzzyDate(media.startDate, 'start') : undefined,
    airingEndDate: isAnime ? toFuzzyDate(media.endDate, 'end') : undefined,
    chapters: !isAnime ? (media.chapters ?? undefined) : undefined,
    volumes: !isAnime ? (media.volumes ?? undefined) : undefined,
    synonyms: media.synonyms ?? [],
    isAdult: media.isAdult ?? false,
  };
}

export async function searchAnilist(
  search: string,
  type?: string,
  page: number = 1,
  perPage: number = 10,
  format?: string,
  ids?: number[] | number
): Promise<IMediaDocument[]> {
  if (!type) return [];

  const normalizedType = type.trim().toLowerCase();
  if (normalizedType === 'vn' || normalizedType === 'game') return [];
  const anilistType =
    normalizedType === 'anime' || normalizedType === 'movie'
      ? 'ANIME'
      : 'MANGA';

  const data = await anilist.request<{
    Page?: { media?: IRawAnilistMedia[] | null } | null;
  }>(SEARCH_QUERY, {
    ...(search.trim() ? { search: search.trim() } : {}),
    ...(ids !== undefined
      ? { ids: Array.isArray(ids) ? ids : [ids] }
      : {}),
    type: anilistType,
    ...(format ? { format } : {}),
    page,
    perPage,
  });

  return (data.Page?.media ?? []).map(mapMedia);
}

/** Fetch manual-sync data in the browser, keeping AniList's IP quota local. */
export async function fetchAnilistSyncPayload(
  status: IAnilistStatus,
  backfill: boolean
): Promise<IAnilistClientSyncPayload> {
  if (!status.anilistId) throw new Error('AniList account is not linked');

  const watermark = backfill ? 0 : (status.lastActivityId ?? 0);
  const createdAtGreater =
    !backfill && !watermark && status.syncFrom
      ? Math.floor(new Date(status.syncFrom).getTime() / 1000)
      : undefined;
  const maxPages = backfill ? MAX_BACKFILL_PAGES : MAX_INCREMENTAL_PAGES;
  const activities: IAnilistClientActivity[] = [];
  const media = new Map<string, IMediaDocument>();

  let page = 1;
  let hasNextPage = true;
  while (hasNextPage && page <= maxPages) {
    const data = await anilist.request<{
      Page?: {
        pageInfo?: { hasNextPage?: boolean | null } | null;
        activities?: Array<{
          id?: number;
          status?: string | null;
          progress?: string | null;
          createdAt?: number;
          media?: IRawAnilistMedia | null;
        }> | null;
      } | null;
    }>(ACTIVITY_QUERY, {
      userId: status.anilistId,
      page,
      perPage: ACTIVITIES_PER_PAGE,
      ...(createdAtGreater ? { createdAtGreater } : {}),
    });

    let reachedWatermark = false;
    for (const raw of data.Page?.activities ?? []) {
      if (typeof raw.id !== 'number' || typeof raw.createdAt !== 'number') {
        continue;
      }
      if (watermark && raw.id <= watermark) {
        reachedWatermark = true;
        break;
      }
      const rawMedia = raw.media;
      activities.push({
        id: raw.id,
        status: raw.status,
        progress: raw.progress,
        createdAt: raw.createdAt,
        media: rawMedia
          ? { id: rawMedia.id, type: rawMedia.type }
          : null,
      });
      if (rawMedia?.type === 'ANIME') {
        media.set(rawMedia.id.toString(), mapMedia(rawMedia));
      }
    }

    if (reachedWatermark) break;
    hasNextPage = Boolean(data.Page?.pageInfo?.hasNextPage);
    page += 1;
    if (hasNextPage && page <= maxPages) await sleep(REQUEST_DELAY_MS);
  }

  return { activities, media: Array.from(media.values()) };
}

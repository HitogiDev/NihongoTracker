import { gql, GraphQLClient } from 'graphql-request';
import {
  AnilistSearchResult,
  IMediaDocument,
  SearchAnilistArgs,
} from '../types.js';

const query = gql`
  query ($search: String, $ids: [Int], $type: MediaType, $format: MediaFormat) {
    Page {
      pageInfo {
        total
        currentPage
        lastPage
        hasNextPage
        perPage
      }
      media(
        id_in: $ids
        search: $search
        type: $type
        format: $format
        sort: SEARCH_MATCH
      ) {
        id
        title {
          romaji
          english
          native
        }
        type
        format
        coverImage {
          large
        }
        episodes
        duration
        chapters
        volumes
        synonyms
        isAdult
        bannerImage
        description
        startDate {
          year
          month
          day
        }
        endDate {
          year
          month
          day
        }
      }
    }
  }
`;

const anilist = new GraphQLClient('https://graphql.anilist.co');

export async function searchAnilist(variables: {
  search?: string | null;
  type?: 'ANIME' | 'MANGA' | null;
  format?: SearchAnilistArgs['format'];
  ids?: number[] | null;
}): Promise<IMediaDocument[]> {
  const cleanedVariables: SearchAnilistArgs = cleanVariables(
    variables
  ) as SearchAnilistArgs;
  const data: AnilistSearchResult = await anilist.request(
    query,
    cleanedVariables
  );

  if (!data.Page.media.length) return [];

  return data.Page.media.map((media) => ({
    contentId: media.id.toString(),
    title: {
      contentTitleNative: media.title.native,
      contentTitleRomaji: media.title.romaji,
      contentTitleEnglish: media.title.english,
    },
    contentImage: media.coverImage.large,
    coverImage: media.bannerImage,
    description: [{ description: media.description, language: 'eng' }],
    type: determineMediaType(media.type, media.format),
    ...(media.synonyms.length && {
      synonyms: media.synonyms.map((synonym) => synonym.trim()),
    }),
    ...(media.type === 'ANIME' && {
      episodes: media.episodes,
      episodeDuration: media.duration,
      // Airing window, used by the "Currently Airing" achievement to tell
      // whether a log happened while the show was still on air
      airingStartDate: toFuzzyDate(media.startDate),
      airingEndDate: toFuzzyDate(media.endDate),
    }),
    ...(media.type === 'MANGA' && {
      chapters: media.chapters,
      volumes: media.volumes,
    }),
    isAdult: media.isAdult,
  })) as IMediaDocument[];
}

/**
 * AniList fuzzy dates can have null parts (e.g. a year with no known day).
 * Anything without at least a year is unusable; missing month/day default to
 * the start of the period, which is close enough for an airing-window check.
 */
function toFuzzyDate(
  date?: { year: number | null; month: number | null; day: number | null } | null
): Date | null {
  if (!date?.year) return null;
  return new Date(Date.UTC(date.year, (date.month ?? 1) - 1, date.day ?? 1));
}

function cleanVariables<T extends object>(variables: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(variables).filter(
      ([_, value]) => value !== undefined && value !== null
    )
  ) as Partial<T>;
}

function determineMediaType(
  type: string,
  format: string
): 'anime' | 'manga' | 'light-novel' {
  if (type.toLowerCase() === 'anime' || type.toLowerCase() === 'music')
    return 'anime';
  if (format === 'MANGA' || format === 'ONE_SHOT') return 'manga';
  return 'light-novel';
}

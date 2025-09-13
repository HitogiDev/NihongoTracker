import { gql, GraphQLClient } from 'graphql-request';
import { AnilistSearchResult, IMediaDocument } from '../types';

const query = gql`
  query (
    $search: String
    $ids: [Int]
    $type: MediaType
    $format: MediaFormat
    $page: Int
    $perPage: Int
  ) {
    Page(page: $page, perPage: $perPage) {
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
        bannerImage
        isAdult
        description
      }
    }
  }
`;

const anilist = new GraphQLClient('https://graphql.anilist.co');

interface SearchAnilistArgs {
  search: string;
  type?: string;
  page?: number;
  perPage?: number;
  format?: string;
  ids?: number[] | number;
}

export async function searchAnilist(
  search: string,
  type?: string,
  page: number = 1,
  perPage: number = 10,
  format?: string,
  ids?: number[] | number
): Promise<IMediaDocument[]> {
  const variables: SearchAnilistArgs = {
    search: search,
    type: type,
    page: page,
    perPage: perPage,
  };
  if (ids) variables['ids'] = ids;
  if (format) variables['format'] = format;
  if (!type) return [];
  const data: AnilistSearchResult = await anilist.request(query, variables);
  const media = data.Page.media.map((media) => ({
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
      ...(media.episodes ? { episodes: media.episodes } : {}),
      episodeDuration: media.duration,
    }),
    ...(media.type === 'MANGA' && {
      chapters: media.chapters,
      volumes: media.volumes,
    }),
    isAdult: media.isAdult,
  })) as IMediaDocument[];
  return media;
}

function determineMediaType(
  type: string,
  format: string
): 'anime' | 'manga' | 'reading' {
  if (type.toLowerCase() === 'anime' || type.toLowerCase() === 'music')
    return 'anime';
  if (format === 'MANGA' || format === 'ONE_SHOT') return 'manga';
  return 'reading';
}

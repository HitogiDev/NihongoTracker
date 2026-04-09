import { useQuery } from '@tanstack/react-query';
import debounce from 'lodash/debounce';
import { useState, useEffect } from 'react';
import { searchAnilist } from '../api/anilistApi';
import { searchMediaFn, searchYouTubeVideoFn } from '../api/trackerApi';
import {
  SearchResultType,
  IMediaDescription,
  youtubeChannelInfo,
} from '../types';

function extractYouTubeVideoId(input: string): string | null {
  const normalizeVideoId = (value: string | null | undefined) => {
    if (!value) return null;
    const cleaned = value.trim();
    return /^[A-Za-z0-9_-]{11}$/.test(cleaned) ? cleaned : null;
  };

  try {
    const parsed = new URL(
      input.startsWith('http://') || input.startsWith('https://')
        ? input
        : `https://${input}`
    );

    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    const pathSegments = parsed.pathname.split('/').filter(Boolean);

    if (host === 'youtu.be') {
      return normalizeVideoId(pathSegments[0]);
    }

    if (host.endsWith('youtube.com')) {
      if (parsed.pathname === '/watch') {
        return normalizeVideoId(parsed.searchParams.get('v'));
      }

      if (
        pathSegments[0] === 'live' ||
        pathSegments[0] === 'shorts' ||
        pathSegments[0] === 'embed' ||
        pathSegments[0] === 'v'
      ) {
        return normalizeVideoId(pathSegments[1]);
      }
    }
  } catch {
    return null;
  }

  return null;
}

function normalizeYouTubeUrl(input: string): string | null {
  const videoId = extractYouTubeVideoId(input);
  return videoId ? `https://www.youtube.com/watch?v=${videoId}` : null;
}

export default function useSearch(
  type: string,
  search: string = '',
  ids?: number[],
  page: number = 1,
  perPage: number = 10,
  options?: {
    enabled?: boolean;
  }
) {
  const [debouncedSearch, setDebouncedSearch] = useState(search);

  useEffect(() => {
    const debouncer = debounce(
      (nextValue: string) => setDebouncedSearch(nextValue),
      500
    );
    debouncer(search);

    return () => {
      debouncer.cancel();
    };
  }, [search]);

  const getDescription = (
    descriptions: IMediaDescription[] | undefined
  ): string => {
    if (!descriptions || descriptions.length === 0) return '';

    const preferredLanguages = ['eng', 'jpn', 'spa'];

    for (const lang of preferredLanguages) {
      const desc = descriptions.find((d) => d.language === lang);
      if (desc) return desc.description;
    }

    return descriptions[0].description;
  };

  const baseEnabled = debouncedSearch.trim().length > 0 && type !== '';
  const isEnabled = baseEnabled && (options?.enabled ?? true);

  return useQuery<SearchResultType[] | undefined, Error>({
    queryKey: ['searchMedia', debouncedSearch, type, page, perPage, ids],
    queryFn: async () => {
      if (!debouncedSearch.trim() || !type) return [];

      if (type === 'video') {
        const normalizedYouTubeUrl = normalizeYouTubeUrl(debouncedSearch);
        if (normalizedYouTubeUrl) {
          try {
            const youtubeResult =
              await searchYouTubeVideoFn(normalizedYouTubeUrl);
            // Convert YouTube result to match IMediaDocument format
            const videoItem: SearchResultType & {
              __youtubeChannelInfo?: youtubeChannelInfo;
            } = {
              contentId: youtubeResult.video.contentId,
              title: youtubeResult.video.title,
              contentImage: youtubeResult.video.contentImage,
              description: youtubeResult.video.description,
              type: 'video',
              episodeDuration: youtubeResult.video.episodeDuration,
              isAdult: youtubeResult.video.isAdult,
              // Store channel info in a way we can access it
              __youtubeChannelInfo: {
                channelId: youtubeResult.channel.contentId,
                channelTitle: youtubeResult.channel.title.contentTitleNative,
                channelImage: youtubeResult.channel.contentImage,
                channelDescription: getDescription(
                  youtubeResult.channel.description
                ),
              },
            };

            return [videoItem];
          } catch (error) {
            console.error('YouTube search error:', error);
            return [];
          }
        } else {
          return []; // No results for non-YouTube video searches
        }
      }

      if (type === 'anime' || type === 'manga' || type === 'reading') {
        // try {

        // const dbResults = await searchMediaFn({
        //   type,
        //   search: debouncedSearch,
        //   ids,
        //   page,
        //   perPage,
        // });

        // if (dbResults && dbResults.length >= 10) {
        //   return dbResults;
        // }

        //   if (type === 'anime') {
        //     const animeResults = await searchAnilist(
        //       debouncedSearch,
        //       'ANIME',
        //       page,
        //       perPage,
        //       undefined,
        //       ids
        //     );
        //     return [...dbResults, ...animeResults];
        //   } else if (type === 'manga') {
        //     const mangaResults = await searchAnilist(
        //       debouncedSearch,
        //       'MANGA',
        //       page,
        //       perPage,
        //       'MANGA',
        //       ids
        //     );
        //     return [...dbResults, ...mangaResults];
        //   } else if (type === 'reading') {
        //     const readingResults = await searchAnilist(
        //       debouncedSearch,
        //       'MANGA',
        //       page,
        //       perPage,
        //       'NOVEL',
        //       ids
        //     );
        //     return [...dbResults, ...readingResults];
        //   }
        // } catch (error) {
        //   console.error(`Search error for ${type}:`, error);
        //   // On error, try AniList as fallback
        if (type === 'anime') {
          return searchAnilist(
            debouncedSearch,
            'ANIME',
            page,
            perPage,
            undefined,
            ids
          );
        } else if (type === 'manga') {
          return searchAnilist(
            debouncedSearch,
            'MANGA',
            page,
            perPage,
            'MANGA',
            ids
          );
        } else if (type === 'reading') {
          return searchAnilist(
            debouncedSearch,
            'MANGA',
            page,
            perPage,
            'NOVEL',
            ids
          );
        }
        // }
      }

      // VN, movie, and TV show only search in database
      if (type === 'vn' || type === 'movie' || type === 'tv show') {
        return searchMediaFn({
          type,
          search: debouncedSearch,
          ids,
          page,
          perPage,
        });
      }

      return [];
    },
    enabled: isEnabled,
    staleTime: type === 'video' ? 5 * 60 * 1000 : 0, // Cache YouTube results for 5 minutes
  });
}

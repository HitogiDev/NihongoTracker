import { useQuery, keepPreviousData } from '@tanstack/react-query';
import debounce from 'lodash/debounce';
import { useState, useEffect } from 'react';
import { searchAnilist } from '../api/anilistApi';
import {
  searchMediaFn,
  searchYouTubeVideoFn,
  searchGoogleBooksFn,
} from '../api/trackerApi';
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

function mergeSearchResults(
  localResults: SearchResultType[],
  externalResults: SearchResultType[],
  limit: number
): SearchResultType[] {
  const seen = new Set<string>();
  const combined: SearchResultType[] = [];

  for (
    let index = 0;
    index < Math.max(localResults.length, externalResults.length);
    index += 1
  ) {
    if (localResults[index]) combined.push(localResults[index]);
    if (externalResults[index]) combined.push(externalResults[index]);
  }

  return combined
    .filter((result) => {
      const key = `${result.type}:${result.contentId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
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

      if (type === 'anime' || type === 'manga' || type === 'light-novel') {
        const localSearch = searchMediaFn({
          type,
          search: debouncedSearch,
          ids,
          page,
          perPage,
        }).catch((error) => {
          console.error(`NihongoTracker search error for ${type}:`, error);
          return [];
        });

        const externalSearch = (async () => {
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
              undefined,
              ids
            );
          } else {
            return searchAnilist(
              debouncedSearch,
              'MANGA',
              page,
              perPage,
              'NOVEL',
              ids
            );
          }
        })().catch((error) => {
          console.error(`AniList search error for ${type}:`, error);
          return [];
        });

        const [localResults, externalResults] = await Promise.all([
          localSearch,
          externalSearch,
        ]);
        return mergeSearchResults(localResults, externalResults, perPage);
      }

      // Keep approved/local books visible alongside Google Books discovery.
      if (type === 'book') {
        const [localResults, externalResults] = await Promise.all([
          searchMediaFn({
            type,
            search: debouncedSearch,
            ids,
            page,
            perPage,
          }).catch(() => []),
          searchGoogleBooksFn(debouncedSearch).catch(() => []),
        ]);
        return mergeSearchResults(localResults, externalResults, perPage);
      }

      // VN, game, movie, and TV show only search in database
      if (
        type === 'vn' ||
        type === 'game' ||
        type === 'movie' ||
        type === 'tv show'
      ) {
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
    // Keep the last results visible while a new query is in flight so the
    // dropdown doesn't flash empty between keystrokes (smooths Google Books,
    // which can lag on rate-limited bursts).
    placeholderData: keepPreviousData,
    retry: 1,
    staleTime: type === 'video' ? 5 * 60 * 1000 : 0, // Cache YouTube results for 5 minutes
  });
}

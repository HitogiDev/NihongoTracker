import { useQuery } from '@tanstack/react-query';
import debounce from 'lodash/debounce';
import { useState, useEffect } from 'react';
import { searchAnilist } from '../api/anilistApi';
import { searchMediaFn, searchYouTubeVideoFn } from '../api/trackerApi';
import { IMediaDocument, MediaDescription, youtubeChannelInfo } from '../types';

export default function useSearch(
  type: string,
  search: string = '',
  ids?: number[],
  page: number = 1,
  perPage: number = 10
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
    descriptions: MediaDescription[] | undefined
  ): string => {
    if (!descriptions || descriptions.length === 0) return '';

    const preferredLanguages = ['eng', 'jpn', 'spa'];

    for (const lang of preferredLanguages) {
      const desc = descriptions.find((d) => d.language === lang);
      if (desc) return desc.description;
    }

    return descriptions[0].description;
  };

  return useQuery<IMediaDocument[] | undefined, Error>({
    queryKey: ['searchMedia', debouncedSearch, type, page, perPage, ids],
    queryFn: async () => {
      if (!debouncedSearch.trim() || !type) return [];

      if (type === 'video') {
        const isYouTubeUrl =
          /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)/.test(
            debouncedSearch
          );
        if (isYouTubeUrl) {
          try {
            const youtubeResult = await searchYouTubeVideoFn(debouncedSearch);
            // Convert YouTube result to match IMediaDocument format
            const videoItem: IMediaDocument & {
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

      // Database-first search for anime, manga, and reading
      if (type === 'anime' || type === 'manga' || type === 'reading') {
        try {
          // First, search in database
          const dbResults = await searchMediaFn({
            type,
            search: debouncedSearch,
            ids,
            page,
            perPage,
          });

          // If we have results in the database, return them
          if (dbResults && dbResults.length > 0) {
            return dbResults;
          }

          // If no results in database, fall back to AniList
          console.log(`No DB results for ${type}, searching AniList...`);

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
        } catch (error) {
          console.error(`Search error for ${type}:`, error);
          // On error, try AniList as fallback
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
        }
      }

      // VN and movie only search in database
      if (type === 'vn' || type === 'movie') {
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
    enabled: debouncedSearch.trim().length > 0 && type !== '', // Always enable when we have search and type
    staleTime: type === 'video' ? 5 * 60 * 1000 : 0, // Cache YouTube results for 5 minutes
  });
}

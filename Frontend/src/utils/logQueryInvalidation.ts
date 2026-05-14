import type { QueryClient } from '@tanstack/react-query';
import type { ILog } from '../types.js';

const LOG_SCREEN_QUERY_KEYS: Partial<Record<ILog['type'], string[]>> = {
  anime: ['animeLogs'],
  manga: ['mangaLogs'],
  reading: ['readingLogs'],
  vn: ['vnLogs'],
  game: ['gameLogs'],
  video: ['videoLogs', 'movieLogs', 'tvShowLogs'],
  movie: ['movieLogs'],
  'tv show': ['tvShowLogs'],
};

export const invalidateLogScreenQueries = (
  queryClient: QueryClient,
  type: ILog['type'] | null | undefined,
  username?: string
) => {
  if (!type) return;
  const keys = LOG_SCREEN_QUERY_KEYS[type];
  if (!keys || keys.length === 0) return;

  keys.forEach((key) => {
    queryClient.invalidateQueries({
      predicate: (query) => {
        if (query.queryKey[0] !== key) return false;
        if (!username) return true;
        return query.queryKey[1] === username;
      },
    });
  });
};

import api from '../api/axiosConfig';
import { useUserDataStore } from '../store/userData';
import { isNativeApp } from '../utils/nativeRuntime';
import type {
  IClub,
  IConnectionsResponse,
  ILog,
  SearchResultType,
} from '../types';
import { rememberMedia } from './mediaCache';
import { pruneImageCache } from './imageCache';
import { refreshOfflineAccount } from './offlineQueue';

let prefetching = false;
let lastFetchedAt = 0;
let lastAccount = '';

export async function prefetchPersonalData() {
  const user = useUserDataStore.getState().user;
  if (!isNativeApp() || !navigator.onLine || !user || prefetching) return;
  if (lastAccount === user._id && Date.now() - lastFetchedAt < 15 * 60000)
    return;
  prefetching = true;
  const sameAccount = () => useUserDataStore.getState().user?._id === user._id;
  try {
    const requests = [
      api.get(`users/${user.username}`),
      api.get<ILog[]>(`users/${user.username}/logs`, {
        params: { page: 1, limit: 20 },
      }),
      api.get<ILog[]>(`users/${user.username}/recentlogs`, {
        params: { limit: 10 },
      }),
      api.get(`users/${user.username}/dashboard`),
      api.get('users/me/customization'),
      api.get('users/ranking', {
        params: {
          limit: 10,
          page: 1,
          filter: 'userXp',
          timeFilter: 'month',
          timezone: user.settings?.timezone || 'UTC',
          audience: 'all',
        },
      }),
      api.get<IClub[]>('clubs/user/my-clubs'),
    ];
    const results = await Promise.allSettled(requests);
    if (!sameAccount()) return;
    const logs = results[1];
    if (logs.status === 'fulfilled' && Array.isArray(logs.value.data)) {
      for (const log of logs.value.data as ILog[]) {
        if (!sameAccount()) return;
        if (log.mediaId && log.media) {
          const result = await api
            .get<SearchResultType>(`media/${log.media.type}/${log.mediaId}`)
            .catch(() => null);
          if (result && sameAccount()) await rememberMedia([result.data]);
        }
      }
    }
    const clubs = results[6];
    if (clubs.status === 'fulfilled' && Array.isArray(clubs.value.data)) {
      for (const club of clubs.value.data as IClub[]) {
        if (!sameAccount()) return;
        await api.get(`clubs/${club._id}`).catch(() => undefined);
      }
    }
    for (let page = 1; sameAccount(); page++) {
      const response = await api
        .get<IConnectionsResponse>(`users/${user.username}/following`, {
          params: { page, limit: 20 },
        })
        .catch(() => null);
      if (!response || !sameAccount()) break;
      for (const connection of response.data.users) {
        if (!sameAccount()) return;
        await api.get(`users/${connection.username}`).catch(() => undefined);
      }
      if (page * 20 >= response.data.total || !response.data.users.length)
        break;
    }
    if (sameAccount()) {
      await refreshOfflineAccount();
      lastAccount = user._id;
      lastFetchedAt = Date.now();
    }
    await pruneImageCache(user._id);
  } finally {
    prefetching = false;
  }
}

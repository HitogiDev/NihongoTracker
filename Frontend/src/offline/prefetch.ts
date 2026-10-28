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
import { pruneApiCache } from './offlineStore';
import { refreshOfflineAccount } from './offlineQueue';

const MAX_MEDIA_DETAILS = 10;
const MAX_CLUBS = 10;
const MAX_FOLLOWED_PROFILES = 20;

let prefetching = false;
let lastFetchedAt = 0;
let lastAccount = '';

/** Skip optional downloads when the user turned on Android Data Saver. */
function saveData() {
  const connection = (navigator as Navigator & {
    connection?: { saveData?: boolean };
  }).connection;
  return connection?.saveData === true;
}

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
    // Detail requests run one at a time. Limit them so a resume does not
    // send hundreds of requests over a mobile connection.
    const logs = results[1];
    if (logs.status === 'fulfilled' && Array.isArray(logs.value.data)) {
      const media = new Set<string>();
      for (const log of logs.value.data as ILog[]) {
        if (log.mediaId && log.media)
          media.add(`${log.media.type}/${log.mediaId}`);
      }
      for (const path of [...media].slice(0, MAX_MEDIA_DETAILS)) {
        if (!sameAccount()) return;
        const result = await api
          .get<SearchResultType>(`media/${path}`)
          .catch(() => null);
        if (result && sameAccount()) await rememberMedia([result.data]);
      }
    }
    const clubs = results[6];
    if (clubs.status === 'fulfilled' && Array.isArray(clubs.value.data)) {
      for (const club of (clubs.value.data as IClub[]).slice(0, MAX_CLUBS)) {
        if (!sameAccount()) return;
        await api.get(`clubs/${club._id}`).catch(() => undefined);
      }
    }
    if (!saveData()) {
      const response = await api
        .get<IConnectionsResponse>(`users/${user.username}/following`, {
          params: { page: 1, limit: MAX_FOLLOWED_PROFILES },
        })
        .catch(() => null);
      for (const connection of response?.data.users ?? []) {
        if (!sameAccount()) return;
        await api.get(`users/${connection.username}`).catch(() => undefined);
      }
    }
    if (sameAccount()) {
      await refreshOfflineAccount();
      lastAccount = user._id;
      lastFetchedAt = Date.now();
    }
    await pruneImageCache(user._id);
    await pruneApiCache(user._id);
  } finally {
    prefetching = false;
  }
}

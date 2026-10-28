import { get, update } from 'idb-keyval';
import type { SearchResultType } from '../types';
import { useUserDataStore } from '../store/userData';
import { isNativeApp } from '../utils/nativeRuntime';

const key = (userId: string) => `nihongo:media:${userId}`;

export async function rememberMedia(results: SearchResultType[]) {
  const userId = useUserDataStore.getState().user?._id;
  if (!isNativeApp() || !userId || !results.length) return results;
  await update<SearchResultType[]>(key(userId), (previous) => {
    const combined = new Map(
      (previous ?? []).map((item) => [`${item.type}:${item.contentId}`, item]),
    );
    results.forEach((item) =>
      combined.set(`${item.type}:${item.contentId}`, item),
    );
    return [...combined.values()].slice(-500);
  });
  return results;
}

export async function searchCachedMedia(
  type: string,
  search: string,
  page: number,
  perPage: number,
) {
  const userId = useUserDataStore.getState().user?._id;
  if (!userId) return [];
  const media = (await get<SearchResultType[]>(key(userId))) ?? [];
  const normalized = search.trim().toLowerCase();
  return media
    .filter(
      (item) =>
        item.type === type &&
        Object.values(item.title).some((title) =>
          title?.toLowerCase().includes(normalized),
        ),
    )
    .slice((page - 1) * perPage, page * perPage);
}

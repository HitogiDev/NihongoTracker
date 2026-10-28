import { del, delMany, entries, get, keys, set } from 'idb-keyval';
import { cacheResponseImages } from './imageCache';
import { apiCacheStore, migrateLegacyEntries, outboxStore } from './idbStores';

const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_CACHED_RESPONSES = 400;
const QUEUE_EVENT = 'nihongo:offline-queue-change';

/**
 * Do not keep responses that are useless offline or that change with each keystroke.
 * Offline media search reads `mediaCache` instead of these responses.
 */
const UNCACHED_REQUESTS =
  /\/api\/(?:users\/search|media\/(?:search|multi-search|utils|youtube)|users\/compare|anilist|patreon|changelogs\/admin)\b/;

/** Image URLs are cached only from responses that the app shows offline. */
const IMAGE_SOURCE_REQUESTS =
  /\/api\/(?:users\/[^/?]+(?:\/(?:logs|recentlogs|dashboard|following))?|users\/me(?:\/customization)?|users\/ranking|clubs(?:\/[^/?]+)?|clubs\/user\/my-clubs|media\/[^/?]+\/[^/?]+)(?:\?|$)/;

export function isCacheableRequest(requestKey: string) {
  return !UNCACHED_REQUESTS.test(requestKey);
}

export type OfflineOperationType =
  | 'log'
  | 'profile'
  | 'settings'
  | 'follow'
  | 'unfollow'
  | 'joinClub'
  | 'leaveClub';

export interface OfflineOperation {
  id: string;
  userId: string;
  type: OfflineOperationType;
  payload: Record<string, unknown>;
  createdAt: number;
  status: 'pending' | 'failed';
  error?: string;
  attempted?: boolean;
}

interface CachedApiResponse {
  data: unknown;
  storedAt: number;
}

const cacheKey = (userId: string, requestKey: string) =>
  `nihongo:api:${userId}:${requestKey}`;
const operationKey = (operation: OfflineOperation) =>
  `nihongo:outbox:${operation.userId}:${operation.id}`;

export function notifyOfflineQueueChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(QUEUE_EVENT));
  }
}

export function offlineQueueEventName() {
  return QUEUE_EVENT;
}

export async function cacheApiResponse(
  userId: string,
  requestKey: string,
  data: unknown,
) {
  if (!isCacheableRequest(requestKey)) return;
  await set(
    cacheKey(userId, requestKey),
    { data, storedAt: Date.now() } satisfies CachedApiResponse,
    apiCacheStore,
  );
  if (IMAGE_SOURCE_REQUESTS.test(requestKey))
    void cacheResponseImages(userId, data).catch(() => undefined);
}

export async function readCachedApiResponse(
  userId: string,
  requestKey: string,
): Promise<unknown | null> {
  const cached = await get<CachedApiResponse>(
    cacheKey(userId, requestKey),
    apiCacheStore,
  );
  if (!cached || Date.now() - cached.storedAt > CACHE_TTL_MS) return null;
  return cached.data;
}

/** Delete expired responses and keep only the most recent responses. */
export async function pruneApiCache(userId: string) {
  const prefix = `nihongo:api:${userId}:`;
  const now = Date.now();
  const cached = (await entries<string, CachedApiResponse>(apiCacheStore))
    .filter(([key]) => typeof key === 'string' && key.startsWith(prefix))
    .sort(([, left], [, right]) => (right?.storedAt ?? 0) - (left?.storedAt ?? 0));
  const stale = cached
    .filter(
      ([, value], index) =>
        index >= MAX_CACHED_RESPONSES ||
        !value ||
        now - value.storedAt > CACHE_TTL_MS,
    )
    .map(([key]) => key);
  if (stale.length) await delMany(stale, apiCacheStore);
}

export async function enqueueOfflineOperation(
  operation: Omit<OfflineOperation, 'createdAt' | 'status'>,
) {
  const entry: OfflineOperation = {
    ...operation,
    createdAt: Date.now(),
    status: 'pending',
  };
  await migrateLegacyEntries();
  await set(operationKey(entry), entry, outboxStore);
  notifyOfflineQueueChanged();
  return entry;
}

export async function getOfflineOperations(userId: string) {
  await migrateLegacyEntries();
  const matchingKeys = (await keys(outboxStore)).filter(
    (key): key is string =>
      typeof key === 'string' && key.startsWith(`nihongo:outbox:${userId}:`),
  );
  const operations = await Promise.all(
    matchingKeys.map((key) => get<OfflineOperation>(key, outboxStore)),
  );
  return operations
    .filter((operation): operation is OfflineOperation => Boolean(operation))
    .sort((left, right) => left.createdAt - right.createdAt);
}

export async function updateOfflineOperation(operation: OfflineOperation) {
  await set(operationKey(operation), operation, outboxStore);
  notifyOfflineQueueChanged();
}

export async function removeOfflineOperation(operation: OfflineOperation) {
  await del(operationKey(operation), outboxStore);
  notifyOfflineQueueChanged();
}

export async function discardFailedOfflineOperations(userId: string) {
  const operations = await getOfflineOperations(userId);
  await Promise.all(
    operations
      .filter((operation) => operation.status === 'failed')
      .map(removeOfflineOperation),
  );
}

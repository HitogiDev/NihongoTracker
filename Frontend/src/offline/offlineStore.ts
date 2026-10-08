import { del, get, keys, set } from 'idb-keyval';
import { cacheResponseImages } from './imageCache';

const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const QUEUE_EVENT = 'nihongo:offline-queue-change';

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
  await set(cacheKey(userId, requestKey), {
    data,
    storedAt: Date.now(),
  } satisfies CachedApiResponse);
  void cacheResponseImages(userId, data).catch(() => undefined);
}

export async function readCachedApiResponse(
  userId: string,
  requestKey: string,
): Promise<unknown | null> {
  const cached = await get<CachedApiResponse>(cacheKey(userId, requestKey));
  if (!cached || Date.now() - cached.storedAt > CACHE_TTL_MS) return null;
  return cached.data;
}

export async function enqueueOfflineOperation(
  operation: Omit<OfflineOperation, 'createdAt' | 'status'>,
) {
  const entry: OfflineOperation = {
    ...operation,
    createdAt: Date.now(),
    status: 'pending',
  };
  await set(operationKey(entry), entry);
  notifyOfflineQueueChanged();
  return entry;
}

export async function getOfflineOperations(userId: string) {
  const matchingKeys = (await keys()).filter(
    (key): key is string =>
      typeof key === 'string' && key.startsWith(`nihongo:outbox:${userId}:`),
  );
  const operations = await Promise.all(
    matchingKeys.map((key) => get<OfflineOperation>(key)),
  );
  return operations
    .filter((operation): operation is OfflineOperation => Boolean(operation))
    .sort((left, right) => left.createdAt - right.createdAt);
}

export async function updateOfflineOperation(operation: OfflineOperation) {
  await set(operationKey(operation), operation);
  notifyOfflineQueueChanged();
}

export async function removeOfflineOperation(operation: OfflineOperation) {
  await del(operationKey(operation));
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

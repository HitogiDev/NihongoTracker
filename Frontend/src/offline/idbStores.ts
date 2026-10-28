import { createStore, del, entries, keys, set, type UseStore } from 'idb-keyval';

/**
 * Each cache has its own database, so a scan of one cache does not read the
 * other caches. Older builds kept these entries in the default idb-keyval store.
 */
export const outboxStore: UseStore = createStore('nihongo-outbox', 'entries');
export const apiCacheStore: UseStore = createStore('nihongo-api-cache', 'entries');
export const imageCacheStore: UseStore = createStore(
  'nihongo-image-cache',
  'entries',
);

let migration: Promise<void> | null = null;

/**
 * Move queued changes out of the default store and delete old cache entries.
 * Cached responses and images are not moved because the app downloads them again.
 */
export function migrateLegacyEntries() {
  migration ??= (async () => {
    const legacyKeys = (await keys()).filter(
      (key): key is string =>
        typeof key === 'string' &&
        (key.startsWith('nihongo:outbox:') ||
          key.startsWith('nihongo:api:') ||
          key.startsWith('nihongo:image:')),
    );
    if (!legacyKeys.length) return;
    const legacyOutbox = (await entries()).filter(
      ([key]) => typeof key === 'string' && key.startsWith('nihongo:outbox:'),
    );
    for (const [key, value] of legacyOutbox) {
      await set(key, value, outboxStore);
    }
    for (const key of legacyKeys) {
      await del(key);
    }
  })().catch((error: unknown) => {
    migration = null;
    throw error;
  });
  return migration;
}

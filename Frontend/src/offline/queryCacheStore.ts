import { clear, createStore } from 'idb-keyval';

/** Keep the persisted query cache in its own database, apart from the other caches. */
export const queryCacheStore = createStore('nihongo-query-cache', 'entries');

/** Delete the persisted queries of every account. */
export function clearPersistedQueries() {
  return clear(queryCacheStore).catch(() => undefined);
}

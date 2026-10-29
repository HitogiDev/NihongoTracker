import { del, get, set } from 'idb-keyval';
import type {
  PersistedClient,
  PersistQueryClientProviderProps,
  Persister,
} from '@tanstack/react-query-persist-client';
import { useUserDataStore } from '../store/userData';
import { queryCacheStore } from './queryCacheStore';

/** Cached screens older than this are not worth showing before the refresh. */
export const PERSISTED_QUERY_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const PERSIST_THROTTLE_MS = 2000;

/** Searches change with each keystroke, so a saved result has no later use. */
const UNPERSISTED_KEYS = /search|autocomplete|mention|suggest/i;

/** Each account has its own entry, so one account never reads another's screens. */
function entryKey() {
  const accountId = useUserDataStore.getState().user?._id;
  return accountId ? `nihongo:query:${accountId}` : null;
}

let pendingClient: PersistedClient | null = null;
let writeTimer: ReturnType<typeof setTimeout> | undefined;

/** Every cache change calls this function, so it saves only the latest snapshot. */
function scheduleWrite(client: PersistedClient) {
  pendingClient = client;
  if (writeTimer) return;
  writeTimer = setTimeout(() => {
    writeTimer = undefined;
    const snapshot = pendingClient;
    pendingClient = null;
    const key = entryKey();
    if (snapshot && key) void set(key, snapshot, queryCacheStore).catch(() => undefined);
  }, PERSIST_THROTTLE_MS);
}

const persister: Persister = {
  persistClient: (client: PersistedClient) => {
    scheduleWrite(client);
    return Promise.resolve();
  },
  restoreClient: async () => {
    const key = entryKey();
    return key ? get<PersistedClient>(key, queryCacheStore) : undefined;
  },
  removeClient: async () => {
    pendingClient = null;
    const key = entryKey();
    if (key) await del(key, queryCacheStore);
  },
};

export const persistOptions: PersistQueryClientProviderProps['persistOptions'] =
  {
    persister,
    maxAge: PERSISTED_QUERY_MAX_AGE_MS,
    buster: '1',
    dehydrateOptions: {
      shouldDehydrateQuery: (query) =>
        query.state.status === 'success' &&
        query.meta?.persist !== false &&
        !UNPERSISTED_KEYS.test(JSON.stringify(query.queryKey)),
    },
  };

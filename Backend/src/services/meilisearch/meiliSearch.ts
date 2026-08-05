import type { MultiSearchResponse } from 'meilisearch';
import client from './meiliClient.js';

const INDEX_TASK_TIMEOUT_MS = 30000;
const INDEX_UID_CACHE_TTL_MS = 60000;

let indexUidCache: { uids: Set<string>; fetchedAt: number } | null = null;

export function invalidateIndexUidCache(): void {
  indexUidCache = null;
}

// Set of index uids that currently exist on the server, cached briefly so it can
// be consulted on every search without an extra round trip each time.
export async function getExistingIndexUids(
  forceRefresh = false
): Promise<Set<string>> {
  if (
    !forceRefresh &&
    indexUidCache &&
    Date.now() - indexUidCache.fetchedAt < INDEX_UID_CACHE_TTL_MS
  ) {
    return indexUidCache.uids;
  }

  const { results } = await client.getIndexes({ limit: 1000 });
  const uids = new Set(results.map((index) => index.uid));
  indexUidCache = { uids, fetchedAt: Date.now() };
  return uids;
}

// Documents
export async function searchDocuments(
  indexName: string,
  query: string,
  options = {}
) {
  const index = client.index(indexName);
  const searchResults = await index.search(query, options);
  console.log(searchResults);
  return searchResults;
}

export async function deleteDocument(indexName: string, documentId: string) {
  const index = client.index(indexName);
  const response = await index.deleteDocument(documentId);
  return response;
}

export async function deleteDocuments(
  indexName: string,
  documentIds: string[]
) {
  if (documentIds.length === 0) {
    return null;
  }

  const index = client.index(indexName);
  const response = await index.deleteDocuments(documentIds);
  return response;
}

export async function getDocument(indexName: string, documentId: string) {
  const index = client.index(indexName);
  const document = await index.getDocument(documentId);
  return document;
}

export async function addDocuments(indexName: string, documents: any[]) {
  const index = client.index(indexName);
  const document = await index.addDocuments(documents);
  return document;
}

// Indexes

export async function indexDocuments(indexName: string, documents: any[]) {
  const index = client.index(indexName);
  const response = await index.addDocuments(documents);
  return response;
}

// Index creation is an async Meilisearch task: the HTTP call only enqueues it.
// Wait for the task to finish so callers can rely on the index actually existing
// (and surface a real error when creation fails instead of failing silently).
export async function createIndex(indexName: string, primaryKey?: string) {
  const task = await client
    .createIndex(indexName, { primaryKey })
    .waitTask({ timeout: INDEX_TASK_TIMEOUT_MS });

  if (task.status !== 'succeeded') {
    throw new Error(
      `Meilisearch index "${indexName}" creation ${task.status}: ${
        task.error?.message ?? 'unknown error'
      }`
    );
  }

  invalidateIndexUidCache();
  return task;
}

export async function deleteIndex(indexName: string) {
  const response = await client.deleteIndex(indexName);
  return response;
}

export async function getIndex(indexName: string) {
  const index = await client.getIndex(indexName);
  return index;
}

export async function listIndexes() {
  const indexes = await client.getIndexes();
  return indexes;
}

export async function getIndexStats(indexName: string) {
  const index = client.index(indexName);
  const stats = await index.getStats();
  return stats;
}

export async function clearIndex(indexName: string) {
  const index = client.index(indexName);
  const response = await index.deleteAllDocuments();
  return response;
}

// Multi-search across multiple indexes
export async function multiSearchDocuments(
  queries: Array<{
    indexUid: string;
    q: string;
    limit?: number;
    offset?: number;
    showRankingScore?: boolean;
  }>
) {
  // Meilisearch rejects the *whole* multi-search with a 400 when a single
  // indexUid doesn't exist, so drop unknown indexes rather than lose every
  // result (an index can legitimately be missing until its first sync runs).
  let effectiveQueries = queries;
  try {
    const existing = await getExistingIndexUids();
    effectiveQueries = queries.filter((q) => existing.has(q.indexUid));

    if (effectiveQueries.length !== queries.length) {
      const missing = queries
        .filter((q) => !existing.has(q.indexUid))
        .map((q) => q.indexUid);
      console.warn(
        `Meilisearch multi-search skipped missing index(es): ${missing.join(', ')}`
      );
      invalidateIndexUidCache();
    }
  } catch (error) {
    // Listing failed — fall back to querying everything as before.
    console.warn('Failed to list Meilisearch indexes:', error);
  }

  if (effectiveQueries.length === 0) {
    return { results: [] } as MultiSearchResponse;
  }

  const response = await client.multiSearch({ queries: effectiveQueries });
  return response;
}

// Settings
export async function updateIndexSettings(
  indexName: string,
  settings: Record<string, any>
) {
  const index = client.index(indexName);
  const response = await index.updateSettings(settings);
  return response;
}

export async function getIndexSettings(indexName: string) {
  const index = client.index(indexName);
  const settings = await index.getSettings();
  return settings;
}

export async function resetIndexSettings(indexName: string) {
  const index = client.index(indexName);
  const response = await index.resetSettings();
  return response;
}

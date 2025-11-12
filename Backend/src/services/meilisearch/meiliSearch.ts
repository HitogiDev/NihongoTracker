import client from './meiliClient.js';

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

export async function createIndex(indexName: string, primaryKey?: string) {
  const response = await client.createIndex(indexName, { primaryKey });
  return response;
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

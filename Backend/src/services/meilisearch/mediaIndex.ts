import { MediaBase } from '../../models/media.model.js';
import {
  addDocuments,
  createIndex,
  updateIndexSettings,
  getIndexStats,
  getExistingIndexUids,
  invalidateIndexUidCache,
} from './meiliSearch.js';

export const MEDIA_INDEXES = [
  'anime',
  'manga',
  'reading',
  'vn',
  'movie',
  'tv_show',
  'game',
  'book',
] as const;

const MEDIA_INDEX_SETTINGS = {
  searchableAttributes: [
    'title.contentTitleNative',
    'title.contentTitleEnglish',
    'title.contentTitleRomaji',
    'synonyms',
  ],
  displayedAttributes: [
    '_id',
    'contentId',
    'title',
    'contentImage',
    'coverImage',
    'isAdult',
    'isAdultImage',
    'synonyms',
    'type',
  ],
  typoTolerance: {
    enabled: true,
    minWordSizeForTypos: {
      oneTypo: 3,
      twoTypos: 6,
    },
  },
};

export async function initMediaIndexes() {
  let existing: Set<string>;
  try {
    existing = await getExistingIndexUids(true);
  } catch (error) {
    console.error('Failed to list Meilisearch indexes:', error);
    existing = new Set();
  }

  const failed: string[] = [];

  // Per-index error handling: one index failing to initialize must not stop the
  // rest from being created (that would leave later indexes — e.g. newly added
  // ones — missing, and multi-search 400s on a missing index).
  for (const indexName of MEDIA_INDEXES) {
    try {
      if (!existing.has(indexName)) {
        await createIndex(indexName, '_id');
      }
      await updateIndexSettings(indexName, MEDIA_INDEX_SETTINGS);
    } catch (error) {
      failed.push(indexName);
      console.error(
        `Failed to initialize Meilisearch index "${indexName}":`,
        error
      );
    }
  }

  invalidateIndexUidCache();

  if (failed.length > 0) {
    console.error(
      `⚠️  Meilisearch media indexes initialized with failures: ${failed.join(', ')}`
    );
    return;
  }

  console.log('✅ Meilisearch media indexes initialized');
}

async function isIndexEmpty(indexName: string): Promise<boolean> {
  try {
    const stats = await getIndexStats(indexName);
    return stats.numberOfDocuments === 0;
  } catch {
    return true;
  }
}

// Map db type values to index names
const TYPE_TO_INDEX: Record<string, string> = {
  anime: 'anime',
  manga: 'manga',
  reading: 'reading',
  vn: 'vn',
  movie: 'movie',
  'tv show': 'tv_show',
  game: 'game',
  book: 'book',
};

async function syncIndexes(indexNames: readonly string[]) {
  let totalDocs = 0;

  for (const indexName of indexNames) {
    const dbType = Object.entries(TYPE_TO_INDEX).find(
      ([, idx]) => idx === indexName
    )?.[0];

    if (!dbType) continue;

    const media = await MediaBase.find({ type: dbType })
      .select(
        'contentId title contentImage coverImage isAdult isAdultImage synonyms type'
      )
      .lean();

    if (media.length === 0) continue;

    const documents = media.map((doc) => ({
      _id: String(doc._id),
      contentId: doc.contentId,
      title: doc.title,
      contentImage: doc.contentImage,
      coverImage: doc.coverImage,
      isAdult: doc.isAdult,
      isAdultImage: (doc as { isAdultImage?: boolean }).isAdultImage ?? false,
      synonyms: doc.synonyms || [],
      type: doc.type,
    }));

    const BATCH_SIZE = 1000;
    for (let i = 0; i < documents.length; i += BATCH_SIZE) {
      const batch = documents.slice(i, i + BATCH_SIZE);
      await addDocuments(indexName, batch);
    }

    console.log(`  📚 ${indexName}: ${documents.length} documents queued`);
    totalDocs += documents.length;
  }

  return totalDocs;
}

// Add (or update) a single media document in its type's search index. Used
// when media is created outside the startup sync (e.g. approved user requests).
export async function addMediaToIndex(doc: {
  _id: unknown;
  contentId: string;
  title: unknown;
  contentImage?: string;
  coverImage?: string;
  isAdult?: boolean;
  isAdultImage?: boolean;
  synonyms?: string[];
  type: string;
}): Promise<void> {
  const indexName = TYPE_TO_INDEX[doc.type];
  if (!indexName) return;

  await addDocuments(indexName, [
    {
      _id: String(doc._id),
      contentId: doc.contentId,
      title: doc.title,
      contentImage: doc.contentImage,
      coverImage: doc.coverImage,
      isAdult: doc.isAdult ?? false,
      isAdultImage: doc.isAdultImage ?? false,
      synonyms: doc.synonyms || [],
      type: doc.type,
    },
  ]);
}

export async function syncAllMedia() {
  try {
    // Check if any index is empty — only sync those
    const emptyChecks = await Promise.all(
      MEDIA_INDEXES.map(async (idx) => ({
        index: idx,
        empty: await isIndexEmpty(idx),
      }))
    );

    const indexesToSync = emptyChecks
      .filter((c) => c.empty)
      .map((c) => c.index);

    if (indexesToSync.length === 0) {
      console.log(
        '✅ Meilisearch media indexes already populated, skipping sync'
      );
      return;
    }

    console.log(
      `🔄 Syncing media to empty indexes: ${indexesToSync.join(', ')}`
    );

    await syncIndexes(indexesToSync);
    console.log('✅ Meilisearch media sync complete');
  } catch (error) {
    console.error('Failed to sync media to Meilisearch:', error);
  }
}

export async function forceSyncAllMedia() {
  console.log('🔄 Force syncing all media indexes...');
  const totalDocs = await syncIndexes(MEDIA_INDEXES);
  console.log(`✅ Force synced ${totalDocs} media documents to Meilisearch`);
  return totalDocs;
}

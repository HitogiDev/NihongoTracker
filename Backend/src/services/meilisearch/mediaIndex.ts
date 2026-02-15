import { MediaBase } from '../../models/media.model.js';
import {
  addDocuments,
  createIndex,
  updateIndexSettings,
  getIndexStats,
} from './meiliSearch.js';

const MEDIA_INDEXES = ['anime', 'manga', 'vn', 'movie', 'tv_show'] as const;

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
  try {
    for (const indexName of MEDIA_INDEXES) {
      try {
        await createIndex(indexName, '_id');
      } catch {
        // Index may already exist — that's fine
      }
      await updateIndexSettings(indexName, MEDIA_INDEX_SETTINGS);
    }
    console.log('✅ Meilisearch media indexes initialized');
  } catch (error) {
    console.error('Failed to initialize media indexes:', error);
  }
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
  vn: 'vn',
  movie: 'movie',
  'tv show': 'tv_show',
};

async function syncIndexes(indexNames: readonly string[]) {
  let totalDocs = 0;

  for (const indexName of indexNames) {
    const dbType = Object.entries(TYPE_TO_INDEX).find(
      ([, idx]) => idx === indexName
    )?.[0];

    if (!dbType) continue;

    const media = await MediaBase.find({ type: dbType })
      .select('contentId title contentImage coverImage isAdult synonyms type')
      .lean();

    if (media.length === 0) continue;

    const documents = media.map((doc) => ({
      _id: String(doc._id),
      contentId: doc.contentId,
      title: doc.title,
      contentImage: doc.contentImage,
      coverImage: doc.coverImage,
      isAdult: doc.isAdult,
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

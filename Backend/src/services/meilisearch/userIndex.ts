import User from '../../models/user.model.js';
import {
  addDocuments,
  createIndex,
  updateIndexSettings,
  getIndexStats,
} from './meiliSearch.js';

const USERS_INDEX = 'users';

interface MeiliUserDocument {
  id: string;
  username: string;
  avatar: string | null;
  banner: string | null;
  xp: number;
}

function toMeiliUserDocument(user: {
  _id: unknown;
  username: string;
  avatar?: string;
  banner?: string;
  stats?: { userXp?: number };
}): MeiliUserDocument {
  return {
    id: String(user._id),
    username: user.username,
    avatar: user.avatar || null,
    banner: user.banner || null,
    xp: user.stats?.userXp ?? 0,
  };
}

export async function indexUser(user: {
  _id: unknown;
  username: string;
  avatar?: string;
  banner?: string;
  stats?: { userXp?: number };
}) {
  try {
    await addDocuments(USERS_INDEX, [toMeiliUserDocument(user)]);
  } catch (error) {
    console.error('Failed to index user in Meilisearch:', error);
  }
}

export async function initUsersIndex() {
  try {
    await createIndex(USERS_INDEX, 'id');
    await updateIndexSettings(USERS_INDEX, {
      searchableAttributes: ['username'],
      displayedAttributes: ['id', 'username', 'avatar', 'banner', 'xp'],
      sortableAttributes: ['xp'],
      typoTolerance: {
        enabled: true,
        minWordSizeForTypos: {
          oneTypo: 3,
          twoTypos: 6,
        },
      },
    });
    console.log('✅ Meilisearch users index initialized');
  } catch (error) {
    console.error('Failed to initialize users index:', error);
  }
}

export async function syncAllUsers() {
  try {
    // Skip if index already has data
    try {
      const stats = await getIndexStats(USERS_INDEX);
      if (stats.numberOfDocuments > 0) {
        console.log(
          '✅ Meilisearch users index already populated, skipping sync'
        );
        return;
      }
    } catch {
      // Index might not exist yet, proceed with sync
    }

    const users = await User.find({})
      .select('username avatar banner stats.userXp')
      .lean();

    const documents = users.map(toMeiliUserDocument);

    // Meilisearch handles batches internally, but chunk for safety
    const BATCH_SIZE = 1000;
    for (let i = 0; i < documents.length; i += BATCH_SIZE) {
      const batch = documents.slice(i, i + BATCH_SIZE);
      await addDocuments(USERS_INDEX, batch);
    }

    console.log(`✅ Synced ${documents.length} users to Meilisearch`);
  } catch (error) {
    console.error('Failed to sync users to Meilisearch:', error);
  }
}

export async function forceSyncAllUsers() {
  try {
    const users = await User.find({})
      .select('username avatar banner stats.userXp')
      .lean();

    const documents = users.map(toMeiliUserDocument);

    const BATCH_SIZE = 1000;
    for (let i = 0; i < documents.length; i += BATCH_SIZE) {
      const batch = documents.slice(i, i + BATCH_SIZE);
      await addDocuments(USERS_INDEX, batch);
    }

    return documents.length;
  } catch (error) {
    console.error('Failed to force sync users to Meilisearch:', error);
    throw error;
  }
}

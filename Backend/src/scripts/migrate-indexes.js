#!/usr/bin/env node

/**
 * Production Database Migration Script
 *
 * This script creates performance indexes for the NihongoTracker application.
 * It's designed to run safely in production environments.
 *
 * Usage:
 *   NODE_ENV=production npm run migrate:indexes
 *
 * Environment Variables Required:
 *   - DATABASE_URL or MONGODB_URI: MongoDB connection string
 *   - NODE_ENV: Environment (development, staging, production)
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.DATABASE_URL || process.env.MONGODB_URI;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Production safety checks
const PRODUCTION_SAFETY = {
  requireConfirmation: NODE_ENV === 'production',
  maxRetries: 3,
  timeoutMs: 30000, // 30 seconds timeout per index
};

console.log(`
🔧 NihongoTracker Database Migration
Environment: ${NODE_ENV}
Time: ${new Date().toISOString()}
`);

// Indexes to ensure, grouped by collection.
const MIGRATIONS = [
  {
    collection: 'livepresences',
    indexes: [
      {
        key: { user: 1 },
        name: 'user_1',
        description: 'One current presence document per user',
        unique: true,
      },
      {
        key: { sharing: 1, expiresAt: 1 },
        name: 'sharing_1_expiresAt_1',
        description: 'Active opt-in presence discovery',
      },
      {
        key: { groupSession: 1, sharing: 1, expiresAt: 1 },
        name: 'groupSession_1_sharing_1_expiresAt_1',
        description: 'Visible active participants in one club session',
      },
      {
        key: { expiresAt: 1 },
        name: 'expiresAt_1',
        description: 'Expire stale presence records automatically',
        expireAfterSeconds: 0,
      },
    ],
  },
  {
    collection: 'clublivesessions',
    indexes: [
      {
        key: { club: 1, status: 1, startedAt: -1 },
        name: 'club_1_status_1_startedAt_-1',
        description: 'Active live sessions for a club',
      },
      {
        key: { club: 1, createdBy: 1, status: 1 },
        name: 'club_1_createdBy_1_status_1',
        description: 'One active session per creator in each club',
        unique: true,
        partialFilterExpression: { status: 'active' },
      },
      {
        key: { expireAt: 1 },
        name: 'expireAt_1',
        description: 'Remove ended session records after retention',
        expireAfterSeconds: 0,
      },
    ],
  },
  {
    collection: 'activities',
    indexes: [
      {
        key: { visibility: 1, occurredAt: -1 },
        name: 'visibility_1_occurredAt_-1',
        description: 'Global activity feed',
      },
      {
        key: { actor: 1, occurredAt: -1 },
        name: 'actor_1_occurredAt_-1',
        description: 'Profile and following activity feeds',
      },
      {
        key: { club: 1, occurredAt: -1 },
        name: 'club_1_occurredAt_-1',
        description: 'Club activity feeds',
      },
      {
        key: { 'metadata.mediaId': 1, 'metadata.mediaType': 1, occurredAt: -1 },
        name: 'metadata.mediaId_1_metadata.mediaType_1_occurredAt_-1',
        description: 'Media community activity feeds',
      },
      {
        key: { 'metadata.mediaId': 1, 'metadata.logType': 1, occurredAt: -1 },
        name: 'metadata.mediaId_1_metadata.logType_1_occurredAt_-1',
        description: 'Historical log activity on media community feeds',
      },
      {
        key: { dedupeKey: 1 },
        name: 'dedupeKey_1',
        description: 'One activity per source event',
        unique: true,
        sparse: true,
      },
    ],
  },
  {
    collection: 'activityreactions',
    indexes: [
      {
        key: { activity: 1, user: 1 },
        name: 'activity_1_user_1',
        description: 'One reaction per user and activity',
        unique: true,
      },
      {
        key: { user: 1, createdAt: -1 },
        name: 'user_1_createdAt_-1',
        description: 'Current-user reaction lookups',
      },
    ],
  },
  {
    collection: 'activitycomments',
    indexes: [
      {
        key: { activity: 1, createdAt: -1 },
        name: 'activity_1_createdAt_-1',
        description: 'Paginated activity comments',
      },
      {
        key: { activity: 1, parentComment: 1, createdAt: -1 },
        name: 'activity_1_parentComment_1_createdAt_-1',
        description: 'Activity comment thread lookups',
      },
      {
        key: { user: 1, createdAt: -1 },
        name: 'user_1_createdAt_-1',
        description: 'Comment moderation by author',
      },
    ],
  },
  {
    collection: 'activitycommentlikes',
    indexes: [
      {
        key: { comment: 1, user: 1 },
        name: 'comment_1_user_1',
        description: 'One like per user and activity comment',
        unique: true,
      },
      {
        key: { user: 1, createdAt: -1 },
        name: 'user_1_createdAt_-1',
        description: 'Activity comment likes by user',
      },
    ],
  },
  {
    collection: 'follows',
    indexes: [
      {
        key: { follower: 1, following: 1 },
        name: 'follower_1_following_1',
        description: 'Prevent duplicate follow relationships',
        unique: true,
      },
      {
        key: { following: 1, createdAt: -1 },
        name: 'following_1_createdAt_-1',
        description: 'Follower lists and follower counts',
      },
      {
        key: { follower: 1, createdAt: -1 },
        name: 'follower_1_createdAt_-1',
        description: 'Following lists and following counts',
      },
    ],
  },
  {
    collection: 'mediarecommendations',
    indexes: [
      {
        key: { sender: 1, recipient: 1, mediaId: 1, mediaType: 1 },
        name: 'sender_1_recipient_1_mediaId_1_mediaType_1',
        description: 'Prevent duplicate media recommendations',
        unique: true,
      },
      {
        key: { recipient: 1, status: 1, createdAt: -1 },
        name: 'recipient_1_status_1_createdAt_-1',
        description: 'Received recommendation inbox',
      },
      {
        key: { sender: 1, createdAt: -1 },
        name: 'sender_1_createdAt_-1',
        description: 'Sent recommendation history',
      },
    ],
  },
  {
    collection: 'usermediastatuses',
    indexes: [
      {
        key: { mediaId: 1, type: 1, hiddenFromList: 1, user: 1 },
        name: 'mediaId_1_type_1_hiddenFromList_1_user_1',
        description: 'Media community visibility candidate lookup',
      },
    ],
  },
  {
    collection: 'clubchallenges',
    indexes: [
      {
        key: { club: 1, status: 1, startDate: -1 },
        name: 'club_1_status_1_startDate_-1',
        description: 'Club challenge lists by lifecycle state',
      },
      {
        key: { scope: 1, visibility: 1, status: 1, startDate: -1 },
        name: 'scope_1_visibility_1_status_1_startDate_-1',
        description: 'Global and official challenge discovery',
      },
      {
        key: { participants: 1, status: 1, endDate: 1 },
        name: 'participants_1_status_1_endDate_1',
        description: 'Participant active and completed challenge lookup',
      },
      {
        key: { club: 1, legacyGoalId: 1 },
        name: 'club_1_legacyGoalId_1',
        description: 'Map legacy embedded club goals to unified objectives',
        sparse: true,
      },
    ],
  },
  {
    collection: 'immersionforecasts',
    indexes: [
      {
        key: { user: 1, mediaId: 1, mediaType: 1 },
        name: 'user_1_mediaId_1_mediaType_1',
        description: 'One immersion forecast per user and media',
        unique: true,
      },
    ],
  },
  {
    collection: 'logs',
    indexes: [
      {
        key: { user: 1, date: -1 },
        name: 'user_1_date_-1',
        description: 'User logs sorted by date (most recent first)',
      },
      {
        key: { user: 1, mediaId: 1, type: 1 },
        name: 'user_1_mediaId_1_type_1',
        description:
          'User-specific media and type queries (critical for MediaDetails)',
      },
      {
        key: { user: 1, type: 1, date: -1 },
        name: 'user_1_type_1_date_-1',
        description: 'User type filtering with date sorting',
      },
      {
        key: { user: 1, mediaId: 1, date: -1 },
        name: 'user_1_mediaId_1_date_-1',
        description: 'User media timeline queries',
      },
      {
        key: { mediaId: 1, type: 1 },
        name: 'mediaId_1_type_1',
        description: 'Media type lookup queries',
      },
      {
        key: { type: 1, date: -1 },
        name: 'type_1_date_-1',
        description: 'Type-based queries sorted by date',
      },
      {
        key: { user: 1, mediaId: 1, type: 1, date: -1 },
        name: 'user_1_mediaId_1_type_1_date_-1',
        description:
          'CRITICAL: Complete MediaDetails query optimization (user + media + type + date sort)',
      },
      {
        key: { manabeId: 1 },
        name: 'manabeId_1',
        description: 'Manabe log ID for duplicate detection during sync',
        sparse: true,
      },
      {
        key: { user: 1, anilistActivityId: 1 },
        name: 'user_1_anilistActivityId_1',
        description:
          'One log per AniList list activity — makes AniList sync idempotent',
        unique: true,
        partialFilterExpression: { anilistActivityId: { $type: 'number' } },
      },
    ],
  },
  {
    collection: 'media',
    indexes: [
      {
        key: { type: 1, jitenDifficulty: 1 },
        name: 'type_1_jitenDifficulty_1',
        description:
          'Jiten difficulty backfill scan (linkable types missing a difficulty) — avoids a full collection scan over the IGDB/VNDB dumps',
      },
    ],
  },
];

async function createProductionIndexes() {
  let retries = 0;

  while (retries < PRODUCTION_SAFETY.maxRetries) {
    try {
      console.log(`🔄 Attempt ${retries + 1}/${PRODUCTION_SAFETY.maxRetries}`);

      // Validate environment
      if (!MONGODB_URI) {
        throw new Error(
          '❌ Missing DATABASE_URL or MONGODB_URI environment variable'
        );
      }

      // Production confirmation
      if (PRODUCTION_SAFETY.requireConfirmation) {
        console.log('⚠️  PRODUCTION ENVIRONMENT DETECTED');
        console.log(
          'This script will create database indexes that may impact performance temporarily.'
        );
        console.log(
          'Indexes will be created in background mode to minimize disruption.'
        );

        // In a real production script, you might want to add readline confirmation
        // For now, we'll proceed with safety measures
      }

      console.log('🔄 Connecting to MongoDB...');
      await mongoose.connect(MONGODB_URI, {
        serverSelectionTimeoutMS: PRODUCTION_SAFETY.timeoutMs,
        socketTimeoutMS: PRODUCTION_SAFETY.timeoutMs,
      });
      console.log('✅ Connected to MongoDB');

      const db = mongoose.connection.db;

      let created = 0;
      let skipped = 0;
      let total = 0;

      for (const migration of MIGRATIONS) {
        const collection = db.collection(migration.collection);
        console.log(`\n📦 Collection: ${migration.collection}`);

        // Get collection stats
        try {
          const stats = await collection.stats();
          console.log(
            `📊 Collection stats: ${stats.count} documents, ${(stats.size / 1024 / 1024).toFixed(2)} MB`
          );
        } catch (statsError) {
          console.log(`📊 Collection stats unavailable: ${statsError.message}`);
        }

        // Check existing indexes
        console.log('🔍 Checking existing indexes...');
        const existingIndexes = await collection.listIndexes().toArray();
        const existingIndexNames = new Set(
          existingIndexes.map((idx) => idx.name)
        );

        console.log(`📋 Found ${existingIndexes.length} existing indexes`);
        console.log(
          `🔄 Processing ${migration.indexes.length} potential indexes...`
        );

        for (const indexSpec of migration.indexes) {
          if (existingIndexNames.has(indexSpec.name)) {
            console.log(
              `⏭️  Index "${indexSpec.name}" already exists, skipping`
            );
            skipped++;
          } else {
            console.log(`🔧 Creating index: ${indexSpec.name}`);
            console.log(`   Description: ${indexSpec.description}`);
            console.log(`   Keys: ${JSON.stringify(indexSpec.key)}`);

            const startTime = Date.now();

            const indexOptions = {
              name: indexSpec.name,
              background: true, // Critical for production: don't block operations
            };

            // Add sparse option if specified
            if (indexSpec.sparse) {
              indexOptions.sparse = true;
            }

            if (indexSpec.unique) {
              indexOptions.unique = true;
            }

            if (indexSpec.expireAfterSeconds !== undefined) {
              indexOptions.expireAfterSeconds = indexSpec.expireAfterSeconds;
            }

            // Partial indexes are how a compound index stays selective: a
            // compound *sparse* index still covers documents that only have the
            // leading field, which would make a unique constraint collide.
            if (indexSpec.partialFilterExpression) {
              indexOptions.partialFilterExpression =
                indexSpec.partialFilterExpression;
            }

            await collection.createIndex(indexSpec.key, indexOptions);

            const duration = Date.now() - startTime;
            console.log(`✅ Created "${indexSpec.name}" in ${duration}ms`);
            created++;
          }
        }

        // Per-collection verification
        console.log(`\n🔍 Index verification for ${migration.collection}:`);
        const finalIndexes = await collection.listIndexes().toArray();
        finalIndexes.forEach((index, i) => {
          const isNew = !existingIndexNames.has(index.name);
          const marker = isNew ? '🆕' : '📝';
          console.log(
            `${marker} ${i + 1}. ${index.name}: ${JSON.stringify(index.key)}`
          );
        });
        total += finalIndexes.length;
      }

      console.log(`\n🎉 Migration completed successfully!`);
      console.log(`📊 Summary:`);
      console.log(`   - Created: ${created} new indexes`);
      console.log(`   - Skipped: ${skipped} existing indexes`);
      console.log(`   - Total: ${total} indexes`);

      return {
        success: true,
        created,
        skipped,
        total,
        duration: Date.now(),
      };
    } catch (error) {
      retries++;
      console.error(`❌ Attempt ${retries} failed:`, error.message);

      if (retries < PRODUCTION_SAFETY.maxRetries) {
        console.log(`⏳ Retrying in 5 seconds...`);
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }
  }

  throw new Error(`❌ Failed after ${PRODUCTION_SAFETY.maxRetries} attempts`);
}

// Main execution
async function main() {
  try {
    const result = await createProductionIndexes();
    console.log('\n✅ Migration successful:', result);
    process.exit(0);
  } catch (error) {
    console.error('\n💥 Migration failed:', error.message);
    process.exit(1);
  } finally {
    if (mongoose.connection.readyState === 1) {
      console.log('\n🔄 Closing database connection...');
      await mongoose.connection.close();
      console.log('✅ Database connection closed');
    }
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default createProductionIndexes;

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
      const collection = db.collection('logs');

      // Get collection stats
      const stats = await collection.stats();
      console.log(
        `📊 Collection stats: ${stats.count} documents, ${(stats.size / 1024 / 1024).toFixed(2)} MB`
      );

      // Check existing indexes
      console.log('🔍 Checking existing indexes...');
      const existingIndexes = await collection.listIndexes().toArray();
      const existingIndexNames = new Set(
        existingIndexes.map((idx) => idx.name)
      );

      console.log(`📋 Found ${existingIndexes.length} existing indexes`);

      // Define indexes to create
      const indexesToCreate = [
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
      ];

      console.log(
        `🔄 Processing ${indexesToCreate.length} potential indexes...`
      );

      let created = 0;
      let skipped = 0;

      for (const indexSpec of indexesToCreate) {
        if (existingIndexNames.has(indexSpec.name)) {
          console.log(`⏭️  Index "${indexSpec.name}" already exists, skipping`);
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

          await collection.createIndex(indexSpec.key, indexOptions);

          const duration = Date.now() - startTime;
          console.log(`✅ Created "${indexSpec.name}" in ${duration}ms`);
          created++;
        }
      }

      console.log(`\n🎉 Migration completed successfully!`);
      console.log(`📊 Summary:`);
      console.log(`   - Created: ${created} new indexes`);
      console.log(`   - Skipped: ${skipped} existing indexes`);
      console.log(`   - Total: ${existingIndexes.length + created} indexes`);

      // Final verification
      console.log('\n🔍 Final index verification:');
      const finalIndexes = await collection.listIndexes().toArray();
      finalIndexes.forEach((index, i) => {
        const isNew = !existingIndexNames.has(index.name);
        const marker = isNew ? '🆕' : '📝';
        console.log(
          `${marker} ${i + 1}. ${index.name}: ${JSON.stringify(index.key)}`
        );
      });

      return {
        success: true,
        created,
        skipped,
        total: finalIndexes.length,
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

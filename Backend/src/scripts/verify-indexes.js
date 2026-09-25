#!/usr/bin/env node

/**
 * Index Verification Script
 *
 * Verifies that all required indexes exist in the database.
 * This should be run after migrations to ensure database performance.
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.DATABASE_URL || process.env.MONGODB_URI;
const NODE_ENV = process.env.NODE_ENV || 'development';

console.log(`
🔍 Index Verification Script
Environment: ${NODE_ENV}
Time: ${new Date().toISOString()}
`);

const REQUIRED_INDEXES = [
  { name: '_id_', description: 'Default MongoDB _id index' },
  { name: 'user_1_date_-1', description: 'User logs sorted by date' },
  {
    name: 'user_1_mediaId_1_type_1',
    description: 'User-specific media and type queries',
  },
  {
    name: 'user_1_type_1_date_-1',
    description: 'User type filtering with date sorting',
  },
  {
    name: 'user_1_mediaId_1_date_-1',
    description: 'User media timeline queries',
  },
  { name: 'mediaId_1_type_1', description: 'Media type lookup queries' },
  { name: 'type_1_date_-1', description: 'Type-based queries sorted by date' },
  {
    name: 'user_1_mediaId_1_type_1_date_-1',
    description: 'CRITICAL: Complete MediaDetails optimization',
  },
];

async function verifyIndexes() {
  try {
    console.log('🔄 Connecting to MongoDB...');

    if (!MONGODB_URI) {
      throw new Error(
        'DATABASE_URL or MONGODB_URI environment variable is required'
      );
    }

    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    const collection = db.collection('logs');

    console.log('🔍 Checking existing indexes...');
    const existingIndexes = await collection.listIndexes().toArray();
    const existingIndexNames = new Set(existingIndexes.map((idx) => idx.name));

    console.log(`📋 Found ${existingIndexes.length} existing indexes\n`);

    let allGood = true;
    let missing = [];
    let present = [];

    // Check each required index
    for (const requiredIndex of REQUIRED_INDEXES) {
      if (existingIndexNames.has(requiredIndex.name)) {
        console.log(`✅ ${requiredIndex.name} - ${requiredIndex.description}`);
        present.push(requiredIndex.name);
      } else {
        console.log(
          `❌ ${requiredIndex.name} - MISSING! ${requiredIndex.description}`
        );
        missing.push(requiredIndex.name);
        allGood = false;
      }
    }

    // Check for unexpected indexes
    const expectedNames = new Set(REQUIRED_INDEXES.map((idx) => idx.name));
    const unexpected = existingIndexes.filter(
      (idx) => !expectedNames.has(idx.name)
    );

    if (unexpected.length > 0) {
      console.log('\n⚠️  Unexpected indexes found:');
      unexpected.forEach((idx) => {
        console.log(`   - ${idx.name}: ${JSON.stringify(idx.key)}`);
      });
    }

    // Summary
    console.log('\n📊 Summary:');
    console.log(`   ✅ Present: ${present.length} indexes`);
    console.log(`   ❌ Missing: ${missing.length} indexes`);
    console.log(`   ⚠️  Unexpected: ${unexpected.length} indexes`);

    if (allGood) {
      console.log(
        '\n🎉 All required indexes are present! Database is optimized.'
      );
    } else {
      console.log('\n⚠️  Missing indexes detected! Run migration to fix:');
      console.log(
        `   npm run migrate:indexes${NODE_ENV === 'production' ? ':prod' : ''}`
      );
    }

    return {
      success: allGood,
      present: present.length,
      missing: missing.length,
      unexpected: unexpected.length,
      missingIndexes: missing,
    };
  } catch (error) {
    console.error('❌ Error:', error.message);
    return { success: false, error: error.message };
  } finally {
    if (mongoose.connection.readyState === 1) {
      console.log('\n🔄 Closing database connection...');
      await mongoose.connection.close();
      console.log('✅ Database connection closed');
    }
  }
}

// Main execution
async function main() {
  try {
    const result = await verifyIndexes();
    console.log('\n📋 Verification result:', result);
    process.exit(result.success ? 0 : 1);
  } catch (error) {
    console.error('\n💥 Verification failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default verifyIndexes;

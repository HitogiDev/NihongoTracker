/* eslint-disable no-console */
/**
 * XP formula v3 migration script.
 *
 * Replays every user's logs chronologically and recomputes XP with the v3
 * engine. Rewrites every log's XP breakdown and rebuilds user stats.
 *
 * Preview: npm run migrate:xp -- --dry-run
 * Apply:   npm run migrate:xp
 * Then:    npm run backfill:achievements -- --no-revoke
 *          npm run backfill:ranks
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(scriptDirectory, '../../.env') });

const MONGO_URI =
  process.env.DATABASE_URL ||
  process.env.MONGO_URI ||
  'mongodb://localhost:27017/nihongotracker';

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  await mongoose.connect(MONGO_URI);
  console.log(`Connected to ${MONGO_URI}`);
  console.log(
    dryRun
      ? 'DRY RUN: nothing will be written'
      : 'LIVE RUN: logs and user stats will be rewritten'
  );

  const { recalculateAllUsersXpV3 } = await import(
    '../services/xpMigration.js'
  );
  const startedAt = Date.now();
  const summary = await recalculateAllUsersXpV3({ dryRun });
  const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);

  console.log('Migration summary');
  console.log(`Users processed: ${summary.processedUsers}/${summary.totalUsers}`);
  console.log(
    `Logs ${dryRun ? 'that would change' : 'updated'}: ${summary.updatedLogs}`
  );
  console.log(`Duration: ${seconds}s`);
  console.log(
    `XP totals: ${summary.previousXp} -> ${summary.recalculatedXp} (delta ${summary.xpDelta})`
  );
  console.log(
    `Users ${dryRun ? 'whose stats would change' : 'with changed stats'}: ${summary.usersWithStatsChanges}`
  );
  console.log(`Users with level changes: ${summary.usersWithLevelChanges}`);
  console.log(`Difficulty-tagged logs: ${summary.difficultyTaggedLogs}`);
  console.log(
    `Full-bonus tagged logs: ${summary.fullBonusLogs} (${summary.fullBonusPercent}%)`
  );

  if (summary.errors.length) {
    console.error(`Errors (${summary.errors.length}):`);
    for (const error of summary.errors) console.error(`  - ${error}`);
  }

  await mongoose.disconnect();
  process.exit(summary.errors.length ? 1 : 0);
}

main().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});

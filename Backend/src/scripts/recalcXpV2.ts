/**
 * XP formula v2 migration script.
 *
 * Replays every user's logs chronologically and recomputes XP with the v2
 * engine (time-based, chars validation, difficulty multiplier). Rewrites
 * each log's xp/xpBreakdown and rebuilds user stats.
 *
 * Run a dry run first to see the impact without writing:
 *   npm run migrate:xp -- --dry-run
 * Then the real thing:
 *   npm run migrate:xp
 *
 * Afterwards re-run achievement backfill so unlock progress matches:
 *   npm run backfill:achievements
 * (Already-earned totalXp achievements are never revoked.)
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../.env') });

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
      ? 'DRY RUN — nothing will be written'
      : 'LIVE RUN — logs and user stats will be rewritten'
  );

  const { recalculateAllUsersXpV2 } = await import(
    '../services/xpMigration.js'
  );

  const startedAt = Date.now();
  const summary = await recalculateAllUsersXpV2({ dryRun });
  const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);

  console.log('--- Migration summary ---');
  console.log(`Users processed: ${summary.processedUsers}/${summary.totalUsers}`);
  console.log(
    `Logs ${dryRun ? 'that would change' : 'updated'}: ${summary.updatedLogs}`
  );
  console.log(`Duration: ${seconds}s`);

  if (summary.errors.length) {
    console.error(`Errors (${summary.errors.length}):`);
    for (const err of summary.errors) console.error(`  - ${err}`);
  }

  await mongoose.disconnect();
  process.exit(summary.errors.length ? 1 : 0);
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});

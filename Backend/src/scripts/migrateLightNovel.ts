/**
 * Light-novel split migration.
 *
 * Background: the log/media type `reading` used to mean "light novel" (an
 * AniList-matchable type). It is being renamed to `light-novel`, and `reading`
 * is repurposed as a new, non-matchable free-form reading bucket that never
 * shows up in the Match Media prompt.
 *
 * This script, in order:
 *   1. Renames every existing `reading` log to `light-novel`.
 *   2. Moves the light-novel/book logs that were never matched to a media
 *      (no mediaId) into the new `reading` bucket, so they stop nagging on the
 *      matching screen.
 *   3. Renames the media documents (and every collection that stores a media
 *      type) from `reading` to `light-novel`, so the discriminator/search stay
 *      consistent with the code.
 *
 * Dry run first:
 *   npm run migrate:lightnovel -- --dry-run
 * Then the real thing:
 *   npm run migrate:lightnovel
 *
 * Idempotent: safe to re-run. After running, restart the server so Meilisearch
 * re-syncs the renamed media index (`light-novel`).
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
      : 'LIVE RUN — logs and media will be rewritten'
  );

  const db = mongoose.connection.db;
  if (!db) throw new Error('No database handle after connect');

  // ---- Step 1: rename `reading` logs to `light-novel` ---------------------
  const logs = db.collection('logs');
  const readingLogCount = await logs.countDocuments({ type: 'reading' });
  if (!dryRun && readingLogCount > 0) {
    await logs.updateMany(
      { type: 'reading' },
      { $set: { type: 'light-novel' } }
    );
  }
  console.log(
    `Step 1 — reading -> light-novel logs: ${readingLogCount} ${
      dryRun ? '(would update)' : 'updated'
    }`
  );

  // ---- Step 2: unmatched light-novel/book logs -> new `reading` bucket -----
  const unmatchedFilter = {
    type: { $in: ['light-novel', 'book'] },
    $or: [
      { mediaId: { $exists: false } },
      { mediaId: null },
      { mediaId: '' },
    ],
  };
  const unmatchedCount = await logs.countDocuments(unmatchedFilter);
  if (!dryRun && unmatchedCount > 0) {
    await logs.updateMany(unmatchedFilter, { $set: { type: 'reading' } });
  }
  console.log(
    `Step 2 — unmatched light-novel/book -> reading logs: ${unmatchedCount} ${
      dryRun ? '(would move)' : 'moved'
    }`
  );

  // ---- Step 3: rename media type `reading` -> `light-novel` everywhere -----
  // (top-level `type`/`mediaType` fields)
  const topLevelTargets: Array<{ collection: string; field: string }> = [
    { collection: 'media', field: 'type' },
    { collection: 'usermediastatuses', field: 'type' },
    { collection: 'mediareviews', field: 'mediaType' },
    { collection: 'mediarequests', field: 'type' },
    { collection: 'mediarequests', field: 'createdMediaType' },
    { collection: 'clubmediavotings', field: 'mediaType' },
  ];

  for (const { collection, field } of topLevelTargets) {
    const col = db.collection(collection);
    const count = await col.countDocuments({ [field]: 'reading' });
    if (!dryRun && count > 0) {
      await col.updateMany(
        { [field]: 'reading' },
        { $set: { [field]: 'light-novel' } }
      );
    }
    console.log(
      `Step 3 — ${collection}.${field}: ${count} ${
        dryRun ? '(would update)' : 'updated'
      }`
    );
  }

  // (nested array element `mediaType` fields — need arrayFilters)
  const nestedTargets: Array<{
    collection: string;
    arrayPath: string;
  }> = [
    { collection: 'medialists', arrayPath: 'entries' },
    { collection: 'clubs', arrayPath: 'currentMedia' },
    { collection: 'users', arrayPath: 'favorites' },
  ];

  for (const { collection, arrayPath } of nestedTargets) {
    const col = db.collection(collection);
    const filterKey = `${arrayPath}.mediaType`;
    const count = await col.countDocuments({ [filterKey]: 'reading' });
    if (!dryRun && count > 0) {
      await col.updateMany(
        { [filterKey]: 'reading' },
        { $set: { [`${arrayPath}.$[el].mediaType`]: 'light-novel' } },
        { arrayFilters: [{ 'el.mediaType': 'reading' }] }
      );
    }
    console.log(
      `Step 3 — ${collection}.${arrayPath}[].mediaType: ${count} ${
        dryRun ? '(would update docs)' : 'docs updated'
      }`
    );
  }

  console.log('--- Migration complete ---');
  if (!dryRun) {
    console.log(
      'Restart the server so Meilisearch re-syncs the renamed "light-novel" media index.'
    );
  }

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});

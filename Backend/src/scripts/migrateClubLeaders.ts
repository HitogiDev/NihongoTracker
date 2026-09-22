/* eslint-disable no-console */
/**
 * Converts legacy club `leader` roles to the canonical `owner` role.
 *
 * Preview by default:
 *   npm run migrate:club-leaders
 * Apply explicitly:
 *   npm run migrate:club-leaders -- --apply
 *
 * The migration is idempotent. Re-running it after a successful apply makes
 * no further changes. Take a database backup before applying it so the
 * original role values can be restored if a rollback is needed.
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
  const args = new Set(process.argv.slice(2));
  const apply = args.has('--apply');
  const dryRun = args.has('--dry-run') || !apply;

  if (apply && args.has('--dry-run')) {
    throw new Error('Use either --apply or --dry-run, not both');
  }

  await mongoose.connect(MONGO_URI);
  const { db } = mongoose.connection;
  if (!db) throw new Error('No database handle after connect');

  const clubs = db.collection('clubs');
  const legacyFilter = { 'members.role': 'leader' };
  const matchingClubCount = await clubs.countDocuments(legacyFilter);
  const [leaderCount] = await clubs
    .aggregate<{ count: number }>([
      { $match: legacyFilter },
      { $unwind: '$members' },
      { $match: { 'members.role': 'leader' } },
      { $count: 'count' },
    ])
    .toArray();
  const leaderMemberCount = leaderCount?.count ?? 0;
  const [ambiguousClubCount] = await clubs
    .aggregate<{ count: number }>([
      { $match: legacyFilter },
      { $unwind: '$members' },
      { $match: { 'members.role': 'leader' } },
      { $group: { _id: '$_id', leaderCount: { $sum: 1 } } },
      { $match: { leaderCount: { $gt: 1 } } },
      { $count: 'count' },
    ])
    .toArray();
  const clubsWithMultipleLeaders = ambiguousClubCount?.count ?? 0;
  const clubsWithMixedOwnerRoles = await clubs.countDocuments({
    $and: [{ 'members.role': 'leader' }, { 'members.role': 'owner' }],
  });

  console.log(
    dryRun
      ? 'DRY RUN: nothing will be written'
      : 'APPLY: converting legacy leader roles to owner'
  );
  console.log(`Clubs containing leader roles: ${matchingClubCount}`);
  console.log(`Leader members found: ${leaderMemberCount}`);
  console.log(`Clubs with multiple leaders: ${clubsWithMultipleLeaders}`);
  console.log(`Clubs mixing leader and owner roles: ${clubsWithMixedOwnerRoles}`);

  if (dryRun || leaderMemberCount === 0) return;

  if (clubsWithMultipleLeaders > 0 || clubsWithMixedOwnerRoles > 0) {
    throw new Error(
      'Ambiguous club leadership detected; resolve it before applying the migration'
    );
  }

  const result = await clubs.updateMany(
    legacyFilter,
    { $set: { 'members.$[member].role': 'owner' } },
    { arrayFilters: [{ 'member.role': 'leader' }] }
  );
  const remainingLegacyCount = await clubs.countDocuments(legacyFilter);

  console.log(`Clubs modified: ${result.modifiedCount}`);
  console.log(`Legacy leader roles remaining: ${remainingLegacyCount}`);

  if (remainingLegacyCount > 0) {
    throw new Error('Migration did not convert every legacy leader role');
  }
}

main()
  .catch((error: unknown) => {
    console.error('Club role migration failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });

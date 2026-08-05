/**
 * Weekly Rank Achievement Backfill Script
 * Run: npm run backfill:ranks
 *
 * Retroactively awards Top 10 / Podium / King / Consistent for every completed
 * Sunday→Saturday week. The weekly cron used to score the wrong window — it
 * ranked the ~25 hours of the week that had just started instead of the week
 * that had just ended — so users who finished a week in the top 10 never got
 * the achievement. This replays the history with the corrected window.
 *
 * Safe to re-run: grants are upserts and never re-award what a user already has.
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

async function backfillRanks() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');

  const { backfillRankAchievements } = await import(
    '../services/achievements/cronAchievements.service.js'
  );

  const result = await backfillRankAchievements({
    onWeek: ({ weekStart, index, total }) => {
      console.log(
        `  Week ${index}/${total} — ${weekStart.toISOString().slice(0, 10)}`
      );
    },
  });

  console.log(`\n✅ Rank backfill complete`);
  console.log(`   Weeks replayed: ${result.weeks}`);
  console.log(`   Achievements granted: ${result.granted}`);

  await mongoose.disconnect();
}

backfillRanks().catch((err) => {
  console.error('Rank backfill failed:', err);
  process.exit(1);
});

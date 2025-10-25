import mongoose from 'mongoose';
import { seedAchievements } from './seedAchievements.js';

const DATABASE_URL =
  process.env.DATABASE_URL || 'mongodb://localhost:27017/nihongotracker';

async function runSeed() {
  try {
    console.log('Connecting to database...');
    await mongoose.connect(DATABASE_URL);
    console.log('✅ Connected to database\n');

    await seedAchievements();

    console.log('\n✅ Seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

runSeed();

import mongoose from 'mongoose';

export async function connectDB() {
  try {
    if (!process.env.DATABASE_URL)
      throw new Error('Please specify the DATABASE_URL environment variable');
    await mongoose.connect(process.env.DATABASE_URL);
    console.log('💾 Database is connected');
  } catch (error) {
    throw new Error(`Database connection error: ${(error as Error).message}`);
  }
}

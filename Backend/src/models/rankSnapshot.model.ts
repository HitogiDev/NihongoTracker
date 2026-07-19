import { Schema, model, Types } from 'mongoose';

/**
 * Stores a periodic snapshot of a user's leaderboard positions.
 * Written weekly by the cron and backfilled one-time from historical
 * logs. Powers the ranking-over-time graph on the profile.
 */
export interface IRankSnapshot {
  userId: Types.ObjectId;
  /** UTC Sunday midnight that ends/labels the snapshot week */
  date: Date;
  /** 1-based all-time (cumulative XP) global leaderboard position */
  globalPosition: number;
  /** 1-based monthly (XP within that calendar month) leaderboard position */
  monthlyPosition: number;
  createdAt?: Date;
  updatedAt?: Date;
}

const RankSnapshotSchema = new Schema<IRankSnapshot>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: Date, required: true },
    globalPosition: { type: Number, required: true },
    monthlyPosition: { type: Number, required: true },
  },
  { timestamps: true }
);

RankSnapshotSchema.index({ userId: 1, date: 1 }, { unique: true });
RankSnapshotSchema.index({ date: -1 });

export default model<IRankSnapshot>('RankSnapshot', RankSnapshotSchema);

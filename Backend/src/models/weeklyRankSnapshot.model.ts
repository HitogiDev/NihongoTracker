import { Schema, model, Types } from 'mongoose';

/**
 * Stores a weekly leaderboard rank snapshot per user.
 * Used by the "Consistent" achievement to check if a user
 * has been in the top 25 for 4 consecutive weeks.
 */
export interface IWeeklyRankSnapshot {
  userId: Types.ObjectId;
  /** UTC Sunday midnight that starts the week */
  weekStart: Date;
  /** 1-based rank position on the weekly XP leaderboard */
  position: number;
  createdAt?: Date;
  updatedAt?: Date;
}

const WeeklyRankSnapshotSchema = new Schema<IWeeklyRankSnapshot>(
  {
    userId:    { type: Schema.Types.ObjectId, ref: 'User', required: true },
    weekStart: { type: Date, required: true },
    position:  { type: Number, required: true },
  },
  { timestamps: true }
);

WeeklyRankSnapshotSchema.index({ userId: 1, weekStart: -1 });
WeeklyRankSnapshotSchema.index({ weekStart: -1 });
// Unique: one snapshot per user per week
WeeklyRankSnapshotSchema.index({ userId: 1, weekStart: 1 }, { unique: true });

export default model<IWeeklyRankSnapshot>('WeeklyRankSnapshot', WeeklyRankSnapshotSchema);

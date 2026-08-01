import { Schema, model } from 'mongoose';
import { IUserAchievement } from '../types.js';

const UserAchievementSchema = new Schema<IUserAchievement>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    achievement: {
      type: Schema.Types.ObjectId,
      ref: 'Achievement',
      required: true,
    },
    unlockedAt: {
      type: Date,
      default: () => new Date(),
      required: true,
    },
    progress: {
      type: Number,
      default: 0,
    },
    notified: {
      type: Boolean,
      default: false,
    },
    // Granted by an admin rather than by an evaluated condition — never revoked
    // by the re-evaluation pass, which has no condition to check it against.
    manuallyGranted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Composite unique index: a user can only earn each achievement once
UserAchievementSchema.index({ user: 1, achievement: 1 }, { unique: true });
UserAchievementSchema.index({ user: 1, unlockedAt: -1 });
UserAchievementSchema.index({ achievement: 1 }); // for rarity % computation

export default model<IUserAchievement>('UserAchievement', UserAchievementSchema);

import { Schema, model } from 'mongoose';
import { IDailyGoal } from '../types.js';

const DailyGoalSchema = new Schema<IDailyGoal>(
  {
    user: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
    type: {
      type: String,
      required: true,
      enum: ['time', 'chars', 'episodes', 'pages'],
    },
    cadence: { type: String, enum: ['daily', 'weekly'], default: 'daily' },
    target: { type: Number, required: true, min: 1 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Ensure only one active goal per type per user
DailyGoalSchema.index({ user: 1, type: 1, cadence: 1, isActive: 1 });

export default model<IDailyGoal>('DailyGoal', DailyGoalSchema);

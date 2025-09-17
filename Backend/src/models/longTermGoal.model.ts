import { Schema, model } from 'mongoose';
import { ILongTermGoal } from '../types.js';

const LongTermGoalSchema = new Schema<ILongTermGoal>(
  {
    user: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
    type: {
      type: String,
      required: true,
      enum: ['time', 'chars', 'episodes', 'pages'],
    },
    totalTarget: { type: Number, required: true, min: 1 },
    targetDate: { type: Date, required: true },
    displayTimeframe: {
      type: String,
      required: true,
      enum: ['daily', 'weekly', 'monthly'],
      default: 'daily',
    },
    startDate: { type: Date, required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Ensure target date is in the future
LongTermGoalSchema.pre('save', function (next) {
  if (this.targetDate <= new Date()) {
    next(new Error('Target date must be in the future'));
    return;
  }

  if (this.startDate >= this.targetDate) {
    next(new Error('Start date must be before target date'));
    return;
  }

  next();
});

// Index for efficient queries
LongTermGoalSchema.index({ user: 1, isActive: 1 });
LongTermGoalSchema.index({ user: 1, type: 1, isActive: 1 });

export default model<ILongTermGoal>('LongTermGoal', LongTermGoalSchema);

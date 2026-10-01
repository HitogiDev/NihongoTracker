import { Schema, model } from 'mongoose';
import { ILongTermGoal } from '../types.js';
import { goalMediaTypes } from '../services/goalMediaType.js';

const LongTermGoalSchema = new Schema<ILongTermGoal>(
  {
    user: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
    type: {
      type: String,
      required: true,
      enum: ['time', 'chars', 'episodes', 'pages']
    },
    mediaType: { type: String, enum: goalMediaTypes, default: null },
    totalTarget: { type: Number, required: true, min: 1 },
    targetDate: { type: Date, required: true },
    displayTimeframe: {
      type: String,
      required: true,
      enum: ['daily', 'weekly', 'monthly'],
      default: 'daily'
    },
    startDate: { type: Date, required: true },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

// Date ordering is always enforced. The controller checks whether the target
// date is current or future in the user's timezone.
LongTermGoalSchema.pre('save', function (next) {
  if (this.startDate > this.targetDate) {
    next(new Error('Start date must be on or before target date'));
    return;
  }

  next();
});

// Index for efficient queries
LongTermGoalSchema.index({ user: 1, isActive: 1 });
LongTermGoalSchema.index({ user: 1, type: 1, isActive: 1 });

export default model<ILongTermGoal>('LongTermGoal', LongTermGoalSchema);

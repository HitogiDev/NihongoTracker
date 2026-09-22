import { Schema, model } from 'mongoose';
import { ACTIVITY_REACTIONS, IActivityReaction } from '../types.js';

const ActivityReactionSchema = new Schema<IActivityReaction>(
  {
    activity: {
      type: Schema.Types.ObjectId,
      ref: 'Activity',
      required: true,
    },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ACTIVITY_REACTIONS, required: true },
  },
  { timestamps: true }
);

ActivityReactionSchema.index({ activity: 1, user: 1 }, { unique: true });
ActivityReactionSchema.index({ user: 1, createdAt: -1 });

export default model<IActivityReaction>(
  'ActivityReaction',
  ActivityReactionSchema
);

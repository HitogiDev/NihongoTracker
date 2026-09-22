import { Schema, model } from 'mongoose';
import { IActivityComment } from '../types.js';

const ActivityCommentSchema = new Schema<IActivityComment>(
  {
    activity: {
      type: Schema.Types.ObjectId,
      ref: 'Activity',
      required: true,
    },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true, trim: true, maxlength: 1000 },
    likeCount: { type: Number, default: 0, min: 0 },
    editedAt: { type: Date },
  },
  { timestamps: true }
);

ActivityCommentSchema.index({ activity: 1, createdAt: -1 });
ActivityCommentSchema.index({ user: 1, createdAt: -1 });

export default model<IActivityComment>('ActivityComment', ActivityCommentSchema);

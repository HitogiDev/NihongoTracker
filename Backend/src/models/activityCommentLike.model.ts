import { Schema, model } from 'mongoose';
import { IActivityCommentLike } from '../types.js';

const ActivityCommentLikeSchema = new Schema<IActivityCommentLike>(
  {
    comment: {
      type: Schema.Types.ObjectId,
      ref: 'ActivityComment',
      required: true,
    },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

ActivityCommentLikeSchema.index({ comment: 1, user: 1 }, { unique: true });
ActivityCommentLikeSchema.index({ user: 1, createdAt: -1 });

export default model<IActivityCommentLike>(
  'ActivityCommentLike',
  ActivityCommentLikeSchema
);

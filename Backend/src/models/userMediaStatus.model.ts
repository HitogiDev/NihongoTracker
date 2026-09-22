import { Schema, model } from 'mongoose';
import { IUserMediaStatus } from '../types.js';

const UserMediaStatusSchema = new Schema<IUserMediaStatus>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    mediaId: { type: String, required: true },
    type: {
      type: String,
      required: true,
      enum: [
        'anime',
        'manga',
        'light-novel',
        'vn',
        'video',
        'movie',
        'tv show',
        'game',
        'book',
      ],
    },
    status: {
      type: String,
      enum: ['completed', 'dropped', 'paused', 'planning', 'in_progress'],
      default: null,
    },
    completed: { type: Boolean, default: false },
    completedAt: { type: Date, default: null },
    autoCompleteSuppressed: { type: Boolean, default: false },
    hiddenFromList: { type: Boolean, default: false },
  },
  { timestamps: true }
);

UserMediaStatusSchema.index({ user: 1, mediaId: 1, type: 1 }, { unique: true });
UserMediaStatusSchema.index({
  mediaId: 1,
  type: 1,
  hiddenFromList: 1,
  user: 1,
});

export default model<IUserMediaStatus>(
  'UserMediaStatus',
  UserMediaStatusSchema
);

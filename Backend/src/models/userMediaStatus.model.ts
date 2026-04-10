import { Schema, model } from 'mongoose';
import { IUserMediaStatus } from '../types.js';

const UserMediaStatusSchema = new Schema<IUserMediaStatus>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    mediaId: { type: String, required: true },
    type: {
      type: String,
      required: true,
      enum: ['anime', 'manga', 'reading', 'vn', 'video', 'movie', 'tv show'],
    },
    completed: { type: Boolean, default: false },
    completedAt: { type: Date, default: null },
    autoCompleteSuppressed: { type: Boolean, default: false },
  },
  { timestamps: true }
);

UserMediaStatusSchema.index({ user: 1, mediaId: 1, type: 1 }, { unique: true });

export default model<IUserMediaStatus>(
  'UserMediaStatus',
  UserMediaStatusSchema
);

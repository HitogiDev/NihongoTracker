import { Schema, model } from 'mongoose';
import { IMediaListComment } from '../types.js';

const MediaListCommentSchema = new Schema<IMediaListComment>(
  {
    list: { type: Schema.Types.ObjectId, ref: 'MediaList', required: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true, trim: true, maxlength: 2000 },
    editedAt: { type: Date },
  },
  { timestamps: true }
);

MediaListCommentSchema.index({ list: 1, createdAt: -1 });

export default model<IMediaListComment>(
  'MediaListComment',
  MediaListCommentSchema
);

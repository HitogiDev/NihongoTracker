import { Schema, model } from 'mongoose';
import { IMediaList, IMediaListEntry } from '../types.js';

const MEDIA_TYPES = [
  'anime',
  'manga',
  'reading',
  'vn',
  'video',
  'movie',
  'tv show',
  'game',
];

const MediaListEntrySchema = new Schema<IMediaListEntry>(
  {
    mediaId: { type: String, required: true },
    mediaType: { type: String, required: true, enum: MEDIA_TYPES },
    note: { type: String, maxlength: 500 },
    order: { type: Number, required: true, default: 0 },
    addedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const MediaListSchema = new Schema<IMediaList>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, maxlength: 2000 },
    isRanked: { type: Boolean, default: false },
    isPublic: { type: Boolean, default: true },
    entries: { type: [MediaListEntrySchema], default: [] },
    likes: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    commentCount: { type: Number, default: 0 },
    clonedFrom: {
      type: Schema.Types.ObjectId,
      ref: 'MediaList',
      default: null,
    },
  },
  { timestamps: true }
);

MediaListSchema.index({ user: 1, createdAt: -1 });
MediaListSchema.index({ isPublic: 1, updatedAt: -1 });
MediaListSchema.index({ 'entries.mediaType': 1, 'entries.mediaId': 1 });
MediaListSchema.index({ title: 'text', description: 'text' });

export default model<IMediaList>('MediaList', MediaListSchema);

import { Schema, model } from 'mongoose';
import { IMediaRequest, IMediaTitle } from '../types.js';

const MediaTitle = new Schema<IMediaTitle>(
  {
    contentTitleNative: { type: String, required: true, trim: true },
    contentTitleRomaji: { type: String, default: null, trim: true },
    contentTitleEnglish: { type: String, default: null, trim: true },
  },
  { _id: false }
);

const MEDIA_REQUEST_TYPES = [
  'anime',
  'manga',
  'reading',
  'vn',
  'video',
  'movie',
  'tv show',
  'game',
] as const;

const MediaRequestSchema = new Schema<IMediaRequest>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: MediaTitle, required: true },
    type: { type: String, required: true, enum: MEDIA_REQUEST_TYPES },
    description: [
      {
        _id: false,
        description: { type: String, trim: true, maxlength: 5000 },
        language: { type: String, enum: ['eng', 'jpn', 'spa'] },
      },
    ],
    referenceUrl: { type: String, trim: true, maxlength: 500 },
    coverImage: { type: String, trim: true, maxlength: 500 },
    isAdult: { type: Boolean, default: false },
    note: { type: String, trim: true, maxlength: 1000 },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    reviewNote: { type: String, trim: true, maxlength: 1000 },
    reviewedAt: { type: Date, default: null },
    createdMediaContentId: { type: String, default: null },
    createdMediaType: { type: String, enum: MEDIA_REQUEST_TYPES, default: null },
  },
  { timestamps: true }
);

// Queue is browsed by status, newest first.
MediaRequestSchema.index({ status: 1, createdAt: -1 });
MediaRequestSchema.index({ user: 1, createdAt: -1 });

const MediaRequest = model<IMediaRequest>('MediaRequest', MediaRequestSchema);

export default MediaRequest;

import { Schema, model } from 'mongoose';
import { IMediaReview } from '../types.js';

const MediaReviewSchema = new Schema<IMediaReview>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    mediaContentId: { type: String, required: true },
    mediaType: {
      type: String,
      required: true,
      enum: ['anime', 'manga', 'reading', 'vn', 'video', 'movie', 'tv show'],
    },
    summary: { type: String, required: true, minlength: 20, maxlength: 150 },
    content: { type: String, required: true, maxlength: 5000 },
    rating: { type: Number, min: 0.5, max: 5 },
    hasSpoilers: { type: Boolean, default: false },
    likes: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    editedAt: { type: Date },
  },
  { timestamps: true }
);

MediaReviewSchema.index(
  { user: 1, mediaContentId: 1, mediaType: 1 },
  { unique: true }
);
MediaReviewSchema.index({ mediaContentId: 1, mediaType: 1, createdAt: -1 });

const MediaReview = model<IMediaReview>('MediaReview', MediaReviewSchema);

export default MediaReview;

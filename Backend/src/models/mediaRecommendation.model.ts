import { Schema, model } from 'mongoose';
import {
  IMediaRecommendation,
  MEDIA_RECOMMENDATION_STATUSES,
} from '../types.js';

const MediaRecommendationSchema = new Schema<IMediaRecommendation>(
  {
    sender: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    recipient: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    mediaId: { type: String, required: true, trim: true, maxlength: 100 },
    mediaType: {
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
    message: { type: String, trim: true, maxlength: 280, default: '' },
    status: {
      type: String,
      enum: MEDIA_RECOMMENDATION_STATUSES,
      default: 'pending',
      required: true,
    },
    viewedAt: { type: Date, default: null },
    respondedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

MediaRecommendationSchema.pre('validate', function preventSelfRecommendation(next) {
  if (this.sender && this.recipient && this.sender.equals(this.recipient)) {
    next(new Error('A user cannot recommend media to themselves'));
    return;
  }
  next();
});

MediaRecommendationSchema.index(
  { sender: 1, recipient: 1, mediaId: 1, mediaType: 1 },
  { unique: true }
);
MediaRecommendationSchema.index({ recipient: 1, status: 1, createdAt: -1 });
MediaRecommendationSchema.index({ sender: 1, createdAt: -1 });

export default model<IMediaRecommendation>(
  'MediaRecommendation',
  MediaRecommendationSchema
);

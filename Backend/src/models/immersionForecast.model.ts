import { Schema, model } from 'mongoose';
import { IImmersionForecast } from '../types.js';

const ImmersionForecastSchema = new Schema<IImmersionForecast>(
  {
    user: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
    mediaId: { type: String, required: true },
    mediaType: {
      type: String,
      required: true,
      enum: [
        'anime',
        'manga',
        'light-novel',
        'vn',
        'movie',
        'tv show',
        'game',
        'book',
      ],
    },
    metric: {
      type: String,
      required: true,
      enum: ['chars', 'pages', 'episodes', 'minutes'],
    },
    targetTotal: { type: Number, required: true, min: 1 },
    targetSource: {
      type: String,
      required: true,
      enum: ['media', 'jiten', 'google_books'],
    },
    startingProgress: { type: Number, required: true, min: 0 },
    targetDate: { type: Date, required: true },
    timezone: { type: String, required: true },
    mediaTitle: { type: String, required: true },
    mediaImage: { type: String },
    episodeDuration: { type: Number, min: 1 },
  },
  { timestamps: true }
);

ImmersionForecastSchema.index(
  { user: 1, mediaId: 1, mediaType: 1 },
  { unique: true }
);

export default model<IImmersionForecast>(
  'ImmersionForecast',
  ImmersionForecastSchema
);

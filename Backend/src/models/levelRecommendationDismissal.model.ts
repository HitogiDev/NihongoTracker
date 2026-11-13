import { Schema, model, Types } from 'mongoose';

export interface ILevelRecommendationDismissal {
  user: Types.ObjectId;
  mediaId: string;
  mediaType: string;
  createdAt: Date;
}

const LevelRecommendationDismissalSchema =
  new Schema<ILevelRecommendationDismissal>(
    {
      user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
      mediaId: { type: String, required: true, trim: true, maxlength: 100 },
      mediaType: { type: String, required: true, trim: true, maxlength: 20 },
    },
    { timestamps: { createdAt: true, updatedAt: false } }
  );

// In production, create indexes with npm run migrate:indexes:prod.
if (process.env.NODE_ENV === 'development') {
  LevelRecommendationDismissalSchema.index(
    { user: 1, mediaType: 1, mediaId: 1 },
    { unique: true }
  );
}

export default model<ILevelRecommendationDismissal>(
  'LevelRecommendationDismissal',
  LevelRecommendationDismissalSchema
);

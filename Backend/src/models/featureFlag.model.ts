import { Schema, model } from 'mongoose';

export const FEATURE_FLAGS = ['wrapped'] as const;
export type FeatureFlag = (typeof FEATURE_FLAGS)[number];

export interface IFeatureFlag {
  key: FeatureFlag;
  enabled: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

/** Site-wide switches that admins turn on or off without a deploy. */
const FeatureFlagSchema = new Schema<IFeatureFlag>(
  {
    key: { type: String, enum: FEATURE_FLAGS, required: true, unique: true },
    enabled: { type: Boolean, required: true, default: false },
  },
  { timestamps: true }
);

export default model<IFeatureFlag>('FeatureFlag', FeatureFlagSchema);

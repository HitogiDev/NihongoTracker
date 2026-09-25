import { Schema, model } from 'mongoose';
import {
  ACTIVITY_REACTIONS,
  ACTIVITY_TYPES,
  IActivity,
  SOCIAL_VISIBILITIES,
} from '../types.js';

const reactionCountFields = Object.fromEntries(
  ACTIVITY_REACTIONS.map((reaction) => [
    reaction,
    { type: Number, default: 0, min: 0 },
  ])
);

const ActivitySchema = new Schema<IActivity>(
  {
    actor: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ACTIVITY_TYPES, required: true },
    targetType: { type: String, required: true, trim: true, maxlength: 50 },
    targetId: { type: Schema.Types.ObjectId, required: true },
    club: { type: Schema.Types.ObjectId, ref: 'Club', default: null },
    metadata: { type: Schema.Types.Mixed, default: undefined },
    visibility: {
      type: String,
      enum: SOCIAL_VISIBILITIES,
      default: 'public',
      required: true,
    },
    importance: {
      type: String,
      enum: ['normal', 'important'],
      default: 'normal',
      required: true,
    },
    dedupeKey: { type: String, trim: true, maxlength: 200 },
    reactionCounts: { type: reactionCountFields, default: () => ({}) },
    commentCount: { type: Number, default: 0, min: 0 },
    occurredAt: { type: Date, default: Date.now, required: true },
  },
  { timestamps: true }
);

ActivitySchema.index({ visibility: 1, occurredAt: -1 });
ActivitySchema.index({ actor: 1, occurredAt: -1 });
ActivitySchema.index({ club: 1, occurredAt: -1 });
ActivitySchema.index({
  'metadata.mediaId': 1,
  'metadata.mediaType': 1,
  occurredAt: -1,
});
ActivitySchema.index({
  'metadata.mediaId': 1,
  'metadata.logType': 1,
  occurredAt: -1,
});
ActivitySchema.index({ dedupeKey: 1 }, { unique: true, sparse: true });

export default model<IActivity>('Activity', ActivitySchema);

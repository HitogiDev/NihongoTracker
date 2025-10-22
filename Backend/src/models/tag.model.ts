import { Schema, model } from 'mongoose';
import { ITag } from '../types.js';

const TagSchema = new Schema<ITag>(
  {
    user: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
    name: { type: String, required: true, trim: true, maxlength: 30 },
    color: { type: String, required: true, default: '#3b82f6' }, // Default blue
  },
  { timestamps: true }
);

// NOTE: In production, indexes should be created via migration scripts
// rather than Mongoose schema definitions for better control and performance.
// See: npm run migrate:indexes:prod
//
// Development indexes (only active in development mode):
if (process.env.NODE_ENV === 'development') {
  TagSchema.index({ user: 1 }); // For getting all tags for a user
  TagSchema.index({ user: 1, name: 1 }, { unique: true }); // Ensure unique tag names per user
}

export default model<ITag>('Tag', TagSchema);

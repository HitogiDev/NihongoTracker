import { Schema, model } from 'mongoose';
import { IApiKey } from '../types.js';

const ApiKeySchema = new Schema<IApiKey>(
  {
    key: { type: String, required: true, unique: true }, // SHA-256 hash
    keyPrefix: { type: String, required: true }, // First 8 chars for display
    name: { type: String, required: true, maxlength: 100 },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    lastUsedAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null },
  },
  { timestamps: true }
);

ApiKeySchema.index({ user: 1 });
ApiKeySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default model<IApiKey>('ApiKey', ApiKeySchema);

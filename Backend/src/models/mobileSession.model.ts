import { Schema, model, Types } from 'mongoose';

export interface IMobileSession {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  refreshTokenHash: string;
  expiresAt: Date;
  pushToken?: string;
  createdAt: Date;
}

const MobileSessionSchema = new Schema<IMobileSession>(
  {
    user: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
    refreshTokenHash: { type: String, required: true, select: false },
    expiresAt: { type: Date, required: true },
    // FCM registration token. Deleting the session also stops its push messages.
    pushToken: { type: String, trim: true, maxlength: 4096 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

if (process.env.NODE_ENV === 'development') {
  MobileSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  MobileSessionSchema.index({ user: 1, createdAt: -1 });
  MobileSessionSchema.index(
    { pushToken: 1 },
    { partialFilterExpression: { pushToken: { $type: 'string' } } }
  );
}

export default model<IMobileSession>('MobileSession', MobileSessionSchema);

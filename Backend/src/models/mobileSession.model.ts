import { Schema, model, Types } from 'mongoose';

export interface IMobileSession {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  refreshTokenHash: string;
  expiresAt: Date;
  createdAt: Date;
}

const MobileSessionSchema = new Schema<IMobileSession>(
  {
    user: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
    refreshTokenHash: { type: String, required: true, select: false },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

if (process.env.NODE_ENV === 'development') {
  MobileSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  MobileSessionSchema.index({ user: 1, createdAt: -1 });
}

export default model<IMobileSession>('MobileSession', MobileSessionSchema);

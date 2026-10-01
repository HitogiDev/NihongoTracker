import { Schema, model, Types } from 'mongoose';

export interface ICompanionPresence {
  owner: Types.ObjectId;
  active: boolean;
  mediaTitle: string;
  mediaType: string;
  startedAt: Date;
  elapsedSeconds: number;
  updatedAt: Date;
  expiresAt: Date;
}

const CompanionPresenceSchema = new Schema<ICompanionPresence>(
  {
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    active: { type: Boolean, default: false, required: true },
    mediaTitle: { type: String, default: '' },
    mediaType: { type: String, default: '' },
    startedAt: { type: Date, default: Date.now },
    elapsedSeconds: { type: Number, default: 0, min: 0 },
    expiresAt: { type: Date, required: true, expires: 0 },
  },
  { timestamps: true }
);

export default model<ICompanionPresence>('CompanionPresence', CompanionPresenceSchema);

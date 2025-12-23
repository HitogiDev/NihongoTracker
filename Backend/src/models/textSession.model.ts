import { Schema, model } from 'mongoose';
import { ITextSession } from '../types.js';

const TextSessionSchema = new Schema<ITextSession>({
  roomId: { type: String, index: true, unique: true, sparse: true },
  hostToken: { type: String },
  userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
  mediaId: { type: Schema.Types.ObjectId, ref: 'Media', index: true },
  lines: [
    {
      id: String,
      text: String,
      charsCount: Number,
      createdAt: { type: Date, default: Date.now },
    },
  ],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  expireAt: { type: Date, index: { expires: 0 } },
});

TextSessionSchema.index(
  { userId: 1, mediaId: 1 },
  { unique: true, sparse: true }
);

export default model<ITextSession>('TextSession', TextSessionSchema);

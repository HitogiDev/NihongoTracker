import { Schema, model } from 'mongoose';
import { ITextSession } from '../types.js';

const TextSessionSchema = new Schema<ITextSession>({
  roomId: { type: String, index: true, unique: true, sparse: true },
  hostToken: { type: String },
  userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
  mediaId: { type: Schema.Types.ObjectId, ref: 'Media', index: true },
  timerSeconds: { type: Number, default: 0 },
  lines: [
    {
      id: String,
      text: String,
      charsCount: Number,
      createdAt: { type: Date, default: Date.now },
    },
  ],
  sessionHistory: [
    {
      loggedAt: { type: Date, default: Date.now },
      isShared: { type: Boolean, default: false },
      connectedUsersCount: { type: Number, default: 0 },
      linesLogged: { type: Number, default: 0 },
      charactersLogged: { type: Number, default: 0 },
      readingSpeed: { type: Number, default: 0 },
      sessionSeconds: { type: Number, default: 0 },
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

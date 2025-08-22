import { Schema, model } from 'mongoose';
import { IUser, userRoles, IUserSettings } from '../types.js';
import bcrypt from 'bcryptjs';
import Log from './log.model.js';
import { calculateXp } from '../services/calculateLevel.js';

const SettingsSchema = new Schema<IUserSettings>(
  {
    blurAdultContent: { type: Boolean, default: true },
    hideUnmatchedLogsAlert: { type: Boolean, default: false },
  },
  { _id: false }
);

const UserSchema = new Schema<IUser>(
  {
    username: {
      type: String,
      required: true,
      index: {
        unique: true,
        collation: { locale: 'en', strength: 2 },
      },
    },
    password: { type: String, required: true },
    discordId: { type: String, sparse: true, unique: true },
    stats: {
      userLevel: { type: Number, required: true, default: 1 },
      userXp: { type: Number, required: true, default: 0 },
      userXpToNextLevel: {
        type: Number,
        required: true,
        default: calculateXp(2),
      },
      userXpToCurrentLevel: {
        type: Number,
        required: true,
        default: calculateXp(1),
      },
      readingXp: { type: Number, required: true, default: 0 },
      readingLevel: { type: Number, required: true, default: 1 },
      readingXpToNextLevel: {
        type: Number,
        required: true,
        default: calculateXp(2),
      },
      readingXpToCurrentLevel: {
        type: Number,
        required: true,
        default: calculateXp(1),
      },
      listeningXp: { type: Number, required: true, default: 0 },
      listeningLevel: { type: Number, required: true, default: 1 },
      listeningXpToNextLevel: {
        type: Number,
        required: true,
        default: calculateXp(2),
      },
      listeningXpToCurrentLevel: {
        type: Number,
        required: true,
        default: calculateXp(1),
      },
      currentStreak: { type: Number, required: true, default: 0 },
      longestStreak: { type: Number, required: true, default: 0 },
      lastStreakDate: { type: Date, default: null },
    },
    clubs: [{ type: Schema.Types.ObjectId, ref: 'Club' }],
    avatar: { type: String, default: '' },
    banner: { type: String, default: '' },
    titles: { type: [String], default: [], required: true },
    roles: [
      {
        type: String,
        enum: Object.values(userRoles),
        default: userRoles.user,
        required: true,
      },
    ],
    lastImport: { type: Date, default: null },
    settings: { type: SettingsSchema, default: { blurAdultContent: true } },
  },
  { timestamps: true }
);

UserSchema.pre('save', async function (next) {
  if (this.isModified('password')) {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  }
  next();
});

UserSchema.pre(
  'findOneAndDelete',
  { document: true, query: false },
  async function (this: IUser, next) {
    await Log.deleteMany({ user: this._id });
    next();
  }
);

UserSchema.method(
  'matchPassword',
  async function (enteredPassword: string): Promise<boolean> {
    return await bcrypt.compare(enteredPassword, this.password);
  }
);

export default model<IUser>('User', UserSchema);

import { Schema, model } from 'mongoose';
import {
  IUser,
  userRoles,
  IUserSettings,
  IAnilistData,
  IPatreonData,
  IUserModeration,
  IUserModerationHistoryItem,
  IFavoriteEntry,
  IUserCustomization,
  SUPPORTED_LANGUAGES,
  NAME_EFFECTS,
  AVATAR_FRAMES,
  PROFILE_ACCENTS,
  SIGNATURE_STATS,
  BANNER_EFFECTS,
} from '../types.js';
import bcrypt from 'bcryptjs';
import Log from './log.model.js';
import { calculateXp } from '../services/calculateLevel.js';
import { getCustomizationDowngrade } from '../services/customization.js';
import Tag from './tag.model.js';

const FAVORITE_MEDIA_TYPES = [
  'anime',
  'manga',
  'reading',
  'vn',
  'video',
  'movie',
  'tv show',
  'game',
  'book',
];

const FavoriteEntrySchema = new Schema<IFavoriteEntry>(
  {
    mediaId: { type: String, required: true },
    mediaType: { type: String, required: true, enum: FAVORITE_MEDIA_TYPES },
    note: { type: String, maxlength: 500 },
    order: { type: Number, required: true, default: 0 },
    addedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const SettingsSchema = new Schema<IUserSettings>(
  {
    blurAdultContent: { type: Boolean, default: true },
    hideUnmatchedLogsAlert: { type: Boolean, default: false },
    timezone: { type: String, default: 'UTC' },
    language: { type: String, enum: SUPPORTED_LANGUAGES, default: 'en' },
    hiddenRecentMedia: { type: [String], default: [] },
    statsLayout: { type: [Schema.Types.Mixed], default: [] },
    profileLayout: { type: [Schema.Types.Mixed], default: [] },
    notificationsLastViewedAt: { type: Date, default: null },
    dismissedNotificationClubIds: { type: [String], default: [] },
    dismissedNotificationClubAt: { type: Schema.Types.Mixed, default: {} },
    lastSeenChangelogAt: { type: Date, default: null },
  },
  { _id: false }
);

const PatreonSchema = new Schema<IPatreonData>(
  {
    patreonId: { type: String, sparse: true, unique: true }, // OAuth2: ID único de Patreon
    patreonEmail: { type: String },
    patreonAccessToken: { type: String, select: false }, // OAuth2: Token de acceso
    patreonRefreshToken: { type: String, select: false }, // OAuth2: Token de refresh
    patreonTokenExpiry: { type: Date }, // OAuth2: Expiración del access token
    tier: {
      type: String,
      enum: ['donator', 'enthusiast', 'consumer', null],
      default: null,
    },
    customBadgeText: {
      type: String,
      maxlength: 20,
      default: '',
    },
    badgeColor: {
      type: String,
      default: '',
    },
    badgeTextColor: {
      type: String,
      default: '',
    },
    memberSince: { type: Date, default: null },
    lastChecked: { type: Date },
    isActive: { type: Boolean, default: false },
    manualTierExpiry: { type: Date, default: null },
  },
  { _id: false }
);

const AnilistSchema = new Schema<IAnilistData>(
  {
    anilistId: { type: Number, sparse: true, unique: true },
    anilistUsername: { type: String },
    anilistAvatar: { type: String },
    // AniList tokens live a year and have no refresh grant — kept out of every
    // query by default and only ever read by the sync service.
    accessToken: { type: String, select: false },
    tokenExpiry: { type: Date },
    linkedAt: { type: Date },
    autoSync: { type: Boolean, default: true },
    lastActivityId: { type: Number, default: 0 },
    syncFrom: { type: Date, default: null },
    lastSyncedAt: { type: Date, default: null },
    lastSyncStatus: {
      type: String,
      enum: ['ok', 'error', null],
      default: null,
    },
    lastSyncError: { type: String, default: null },
    syncedLogCount: { type: Number, default: 0 },
  },
  { _id: false }
);

const ModerationSchema = new Schema<IUserModeration>(
  {
    rankingBanned: { type: Boolean, default: false },
    banned: { type: Boolean, default: false },
    banReason: { type: String, default: '', maxlength: 500 },
    updatedAt: { type: Date, default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    updatedByUsername: { type: String, default: '' },
    history: {
      type: [
        new Schema<IUserModerationHistoryItem>(
          {
            field: {
              type: String,
              enum: ['rankingBanned', 'banned', 'banReason'],
              required: true,
            },
            previousValue: { type: Schema.Types.Mixed, required: true },
            newValue: { type: Schema.Types.Mixed, required: true },
            reasonSnapshot: { type: String, default: '', maxlength: 500 },
            updatedAt: { type: Date, required: true, default: Date.now },
            updatedBy: {
              type: Schema.Types.ObjectId,
              ref: 'User',
              default: null,
            },
            updatedByUsername: { type: String, default: '' },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
  },
  { _id: false }
);

// Cosmetics only. Enums keep unknown values out of the DB, but what a given
// user is *allowed* to equip is decided by services/customization.ts.
const CustomizationSchema = new Schema<IUserCustomization>(
  {
    nameEffect: { type: String, enum: NAME_EFFECTS, default: 'none' },
    nameColor1: { type: String, default: '' },
    nameColor2: { type: String, default: '' },
    avatarFrame: { type: String, enum: AVATAR_FRAMES, default: 'none' },
    profileAccent: {
      type: String,
      enum: PROFILE_ACCENTS,
      default: 'default',
    },
    accentColor: { type: String, default: '' },
    signatureStat: { type: String, enum: SIGNATURE_STATS, default: 'none' },
    equippedTitle: { type: String, default: '' },
    bannerEffect: { type: String, enum: BANNER_EFFECTS, default: 'none' },
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
    email: {
      type: String,
      required: false,
      index: {
        unique: true,
        sparse: true,
        collation: { locale: 'en', strength: 2 },
      },
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        'Please fill a valid email address',
      ],
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true, select: false },
    discordId: { type: String, sparse: true, unique: true }, // For Manabe log importing
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
    verified: { type: Boolean, required: true, default: false },
    verificationToken: { type: String, default: null, select: false },
    verificationTokenExpiry: { type: Date, default: null, select: false },
    lastVerificationEmailSent: { type: Date, default: null },
    resetPasswordToken: { type: String, default: null, select: false },
    resetPasswordTokenExpiry: { type: Date, default: null, select: false },
    avatar: { type: String, default: '' },
    banner: { type: String, default: '' },
    about: { type: String, default: '', maxlength: 2000 },
    titles: { type: [String], default: [], required: true },
    roles: [
      {
        type: String,
        enum: Object.values(userRoles),
        default: userRoles.user,
        required: true,
      },
    ],
    firstImport: { type: Boolean, default: true },
    settings: {
      type: SettingsSchema,
      default: { blurAdultContent: true, timezone: 'UTC' },
    },
    patreon: {
      type: PatreonSchema,
      default: { tier: null, isActive: false },
    },
    anilist: { type: AnilistSchema, default: null },
    moderation: {
      type: ModerationSchema,
      default: { rankingBanned: false, banned: false, banReason: '' },
    },
    favorites: { type: [FavoriteEntrySchema], default: [] },
    customization: { type: CustomizationSchema, default: () => ({}) },
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

/**
 * Losing a Patreon tier takes the paid cosmetics with it.
 *
 * Exported so it can be tested against a real document without a database —
 * the hook below is the only caller.
 */
export function applyPatreonCustomizationDowngrade(user: IUser): boolean {
  // No `isModified('patreon')` guard: it does not report nested writes like
  // `user.patreon.isActive = false`, which is how half the call sites clear a
  // tier. Recomputing is two small objects and a field comparison, and running
  // it on every save means a document can never drift out of entitlement.
  const downgrade = getCustomizationDowngrade(user.customization, user.patreon);
  if (!downgrade) return false;

  user.set('customization', downgrade);
  return true;
}

/**
 * This lives on the model rather than at the call sites because the tier is
 * cleared from half a dozen places — the webhook, the OAuth sync, unlinking,
 * the admin panel, and the manual-expiry check in `authMiddleware` — and every
 * one of them ends in `user.save()`. One hook cannot be forgotten by the next
 * one added.
 */
UserSchema.pre('save', function (next) {
  applyPatreonCustomizationDowngrade(this);
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

UserSchema.pre(
  'findOneAndDelete',
  { document: true, query: false },
  async function (this: IUser, next) {
    await Tag.deleteMany({ user: this._id });
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

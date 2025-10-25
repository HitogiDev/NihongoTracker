import { Request } from 'express';
import { Document, Types } from 'mongoose';

export interface decodedJWT {
  id: Types.ObjectId;
  iat: number;
  exp: number;
}

export interface IRanking extends Document {
  _id: Types.ObjectId;
  month: number;
  year: number;
  users?: Types.ObjectId[];
}

export enum userRoles {
  admin = 'admin',
  user = 'user',
  mod = 'mod',
}

export interface IUserSettings {
  blurAdultContent: boolean;
  hideUnmatchedLogsAlert?: boolean;
  timezone?: string;
}

export interface IPatreonData {
  patreonId?: string;
  patreonEmail?: string;
  patreonAccessToken?: string;
  patreonRefreshToken?: string;
  patreonTokenExpiry?: Date;
  tier?: 'donator' | 'enthusiast' | 'consumer' | null;
  customBadgeText?: string;
  badgeColor?: string;
  badgeTextColor?: string;
  lastChecked?: Date;
  isActive?: boolean;
}

export interface IUserAchievement {
  achievement: Types.ObjectId;
  unlockedAt: Date;
  progress?: number; // For tracking partial progress (optional)
}

export interface IUser extends Document {
  _id: Types.ObjectId;
  avatar?: string;
  banner?: string;
  username: string;
  email?: string;
  verified?: boolean;
  verificationToken?: string;
  verificationTokenExpiry?: Date;
  lastVerificationEmailSent?: Date;
  resetPasswordToken?: string;
  resetPasswordTokenExpiry?: Date;
  password: string;
  discordId?: string;
  clubs?: Types.ObjectId[];
  stats: IStats;
  titles: string[];
  roles: userRoles[];
  lastImport?: Date;
  createdAt?: Date;
  updatedAt?: Date;
  settings?: IUserSettings;
  patreon?: IPatreonData;
  achievements?: IUserAchievement[];
  achievementPoints?: number;
  matchPassword: (enteredPassword: string) => Promise<boolean>;
}

export interface IMediaTitle {
  contentTitleNative: string;
  contentTitleRomaji?: string;
  contentTitleEnglish?: string;
}

interface MediaDescription {
  description: string;
  language: 'eng' | 'jpn' | 'spa';
}

export interface IMediaDocument {
  _id?: Types.ObjectId;
  contentId: string;
  title: IMediaTitle;
  contentImage?: string;
  coverImage?: string;
  description?: MediaDescription[];
  type: 'anime' | 'manga' | 'reading' | 'vn' | 'video' | 'movie' | 'tv show';
  episodes?: number;
  episodeDuration?: number;
  genres?: string[];
  chapters?: number;
  volumes?: number;
  seasons?: number;
  runtime?: number;
  synonyms?: string[];
  isAdult: boolean;
  lastLogDate?: Date;
}

export interface IImportLogs {
  forced: boolean;
  logs: ILog[];
}

export interface IStats {
  userLevel: number;
  userXp: number;
  userXpToNextLevel: number;
  userXpToCurrentLevel: number;
  readingXp: number;
  readingLevel: number;
  readingXpToNextLevel: number;
  readingXpToCurrentLevel: number;
  listeningXp: number;
  listeningLevel: number;
  listeningXpToNextLevel: number;
  listeningXpToCurrentLevel: number;
  currentStreak: number;
  longestStreak: number;
  lastStreakDate: Date | null;
}

export interface SearchAnilistArgs {
  search?: string | null;
  ids?: number[] | null;
  type?: 'ANIME' | 'MANGA' | null;
  format?:
    | 'TV'
    | 'TV_SHORT'
    | 'MOVIE'
    | 'SPECIAL'
    | 'OVA'
    | 'ONA'
    | 'MUSIC'
    | 'MANGA'
    | 'NOVEL'
    | 'ONE_SHOT'
    | null;
}

export interface IEditedFields {
  episodes?: number;
  pages?: number;
  chars?: number;
  time?: number;
  xp?: number;
}

export interface AnilistSearchResult {
  Page: {
    pageInfo: {
      total: number;
      currentPage: number;
      lastPage: number;
      hasNextPage: boolean;
      perPage: number;
    };
    media: {
      id: number;
      title: {
        romaji: string;
        english: string;
        native: string;
      };
      format: 'NOVEL' | 'MANGA' | 'ONE_SHOT';
      type: 'ANIME' | 'MANGA';
      coverImage: {
        extraLarge: string;
        medium: string;
        large: string;
        color: string;
      };
      synonyms: string[];
      episodes?: number;
      duration?: number;
      chapters?: number;
      volumes?: number;
      isAdult: boolean;
      bannerImage: string;
      siteUrl: string;
      description: string;
    }[];
  };
}

export interface ITag extends Document {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  name: string;
  color: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ILog extends Document {
  user: Types.ObjectId;
  type:
    | 'reading'
    | 'anime'
    | 'vn'
    | 'video'
    | 'manga'
    | 'audio'
    | 'movie'
    | 'other';
  mediaId?: string;
  manabeId?: string;
  mediaTitle?: string;
  xp: number;
  private: boolean;
  isAdult: boolean;
  description?: string;
  editedFields?: IEditedFields | null;
  episodes?: number;
  pages?: number;
  chars?: number;
  time?: number;
  date: Date;
  tags?: Types.ObjectId[];
}

export interface IContentMedia {
  contentId: string;
  contentImage?: string;
  coverImage?: string;
  contentTitleNative: string;
  contentTitleRomaji?: string;
  contentTitleEnglish: string;
  description?: {
    description: string;
    language: 'eng' | 'jpn' | 'spa';
  }[];
  type: 'anime' | 'manga' | 'reading' | 'vn' | 'video' | 'movie';
  episodes?: number;
  episodeDuration?: number;
  chapters?: number;
  volumes?: number;
  runtime?: number;
  synonyms?: string[] | null;
  isAdult: boolean;
  date?: Date | null;
  // YouTube specific fields
  channelId?: string;
  channelTitle?: string;
  channelImage?: string;
  channelDescription?: string;
}

export interface ICreateLog extends ILog {
  mediaData?: IContentMedia;
}

export interface IUpdateRequest {
  username?: string;
  email?: string;
  password?: string;
  newPassword?: string;
  newPasswordConfirm?: string;
  discordId?: string;
  blurAdultContent?: string;
  hideUnmatchedLogsAlert?: string;
  timezone?: string;
}

export interface IRegister {
  username: string;
  email?: string;
  password: string;
  passwordConfirmation: string;
}

export interface ILogin {
  login: string;
  password: string;
}

export interface IRequest<Type> extends Request {
  body: Type;
}

export interface TMWLog {
  'Log ID': string;
  'Media Type': string;
  'Media Name': string;
  Comment: string;
  'Amount Logged': string;
  'Points Received': string;
  'Log Date': string;
}

export interface ManabeTSVLog {
  Fecha: string; // Date
  Medio: string; // Media type
  Cantidad: string; // Quantity/Amount
  Descripción: string; // Description
  Puntos: string; // Points
  Caracteres: string; // Characters
  Tiempo: string; // Time
}

export interface VNCRLog {
  id: number;
  user_id: string;
  guild_id: string;
  name: string;
  primary_type: 'listening' | 'reading';
  media_type: 'anime' | 'manga' | 'visual_novel' | 'book';
  duration: number; // in seconds
  date: string;
  created_at: string;
  meta: {
    characters?: number;
    pages?: number;
    episodes?: number;
    episode_duration?: number;
    reading_speed?: number;
    anilist_id?: number;
    anilist?: {
      id: number;
      titles: {
        native: string;
        romaji: string;
        english: string;
      };
    };
    vn?: {
      id: string;
      titles: {
        ja: string;
        romaji: string;
        en: string;
      };
    };
  };
}

export interface IDailyGoal extends Document {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  type: 'time' | 'chars' | 'episodes' | 'pages';
  target: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IDailyGoalProgress {
  date: string;
  time: number;
  chars: number;
  episodes: number;
  pages: number;
  completed: {
    time: boolean;
    chars: boolean;
    episodes: boolean;
    pages: boolean;
  };
}

export interface ILongTermGoal extends Document {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  type: 'time' | 'chars' | 'episodes' | 'pages';
  totalTarget: number;
  targetDate: Date;
  displayTimeframe: 'daily' | 'weekly' | 'monthly';
  startDate: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ILongTermGoalProgress {
  goalId: Types.ObjectId;
  totalProgress: number;
  requiredPerTimeframe: number;
  remainingDays: number;
  remainingTarget: number;
  isOnTrack: boolean;
  timeframeName: string;
  progressToday?: number;
  progressThisWeek?: number;
  progressThisMonth?: number;
}

export interface IClubMember {
  user: Types.ObjectId;
  role: 'leader' | 'moderator' | 'member';
  joinedAt: Date;
  status: 'active' | 'pending' | 'banned';
}

export interface IClubMediaCandidate {
  mediaId: string;
  title: string;
  description?: string;
  image?: string;
  addedBy: Types.ObjectId;
  addedAt?: Date;
  votes: Types.ObjectId[];
}

export interface IClubMediaVoting {
  _id?: Types.ObjectId;
  title: string;
  description?: string;
  mediaType:
    | 'anime'
    | 'manga'
    | 'reading'
    | 'vn'
    | 'video'
    | 'movie'
    | 'custom';
  customMediaType?: string;

  // Voting configuration
  candidateSubmissionType: 'manual' | 'member_suggestions';

  // Date periods
  suggestionStartDate?: Date;
  suggestionEndDate?: Date;
  votingStartDate: Date;
  votingEndDate: Date;
  consumptionStartDate: Date;
  consumptionEndDate: Date;

  // Status and management
  status:
    | 'setup'
    | 'suggestions_open'
    | 'suggestions_closed'
    | 'voting_open'
    | 'voting_closed'
    | 'completed';
  isActive: boolean;
  createdBy: Types.ObjectId;

  candidates: IClubMediaCandidate[];
  winnerCandidate?: {
    mediaId: string;
    title: string;
    description?: string;
    image?: string;
  };
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IClubMedia {
  _id?: Types.ObjectId;
  mediaId: string;
  mediaType: 'anime' | 'manga' | 'reading' | 'vn' | 'video' | 'movie';
  title: string;
  description?: string;
  startDate: Date;
  endDate: Date;
  isActive: boolean;
  addedBy: Types.ObjectId;
  votes: Array<{
    user: Types.ObjectId;
    vote: number;
  }>;
  mediaDocument?: IMediaDocument;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IClubReview extends Document {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  clubMedia: Types.ObjectId;
  content: string;
  rating?: number;
  hasSpoilers: boolean;
  likes: Types.ObjectId[];
  editedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IClub extends Document {
  _id: Types.ObjectId;
  name: string;
  description?: string;
  avatar?: string;
  banner?: string;
  isPublic: boolean;
  level: number;
  totalXp: number;
  members: IClubMember[];
  currentMedia: IClubMedia[];
  mediaVotings: IClubMediaVoting[];
  tags: string[];
  memberLimit: number;
  rules?: string;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ICreateClubRequest {
  name: string;
  description?: string;
  isPublic?: boolean;
  tags?: string[];
  rules?: string;
  memberLimit?: number;
}

export interface IClubResponse {
  _id: Types.ObjectId;
  name: string;
  description?: string;
  avatar?: string;
  banner?: string;
  isPublic: boolean;
  level: number;
  totalXp: number;
  members: IClubMember[];
  currentMedia: IClubMedia[];
  tags: string[];
  memberLimit: number;
  rules?: string;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  memberCount: number;
  isUserMember: boolean;
  userRole?: 'leader' | 'moderator' | 'member';
  userStatus?: 'active' | 'pending' | 'banned';
}

export interface IClubListResponse {
  clubs: IClubResponse[];
  total: number;
  page: number;
  limit: number;
}

export interface IChangelogChange {
  type: 'feature' | 'improvement' | 'bugfix' | 'breaking';
  description: string;
}

export interface IChangelog extends Document {
  _id: Types.ObjectId;
  version: string;
  title: string;
  description: string;
  changes: IChangelogChange[];
  date: Date;
  createdBy: Types.ObjectId;
  published: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

// Achievement System Types
export enum AchievementCategory {
  GENERAL = 'general',
  READING = 'reading',
  LISTENING = 'listening',
  ANIME = 'anime',
  MANGA = 'manga',
  VN = 'vn',
  VIDEO = 'video',
  STREAK = 'streak',
  LEVEL = 'level',
  SOCIAL = 'social',
}

export enum AchievementRarity {
  C = 'C',      // Common - Easy achievements (50-60% of achievements)
  B = 'B',      // Uncommon - Regular achievements (25-30%)
  A = 'A',      // Rare - Challenging achievements (10-15%)
  S = 'S',      // Super Rare - Difficult achievements (5-8%)
  SS = 'SS',    // Super Super Rare - Very difficult (2-3%)
  SSR = 'SSR',  // Super Super Rare+ - Legendary achievements (<1%)
}

export interface IAchievementCriteria {
  type:
    | 'total_xp'
    | 'category_xp'
    | 'level_reached'
    | 'category_level'
    | 'streak_days'
    | 'total_logs'
    | 'category_logs'
    | 'episodes_watched'
    | 'pages_read'
    | 'chars_read'
    | 'hours_listened'
    | 'club_member'
    | 'club_owner';
  category?: 'reading' | 'listening';
  threshold: number;
}

export interface IAchievement extends Document {
  _id: Types.ObjectId;
  key: string; // Unique identifier (e.g., 'first_log', 'reading_master_100k')
  name: string;
  description: string;
  icon?: string; // Emoji or icon identifier
  category: AchievementCategory;
  rarity: AchievementRarity;
  criteria: IAchievementCriteria;
  points: number; // Achievement points for gamification
  hidden: boolean; // Secret achievements
  createdAt?: Date;
  updatedAt?: Date;
}

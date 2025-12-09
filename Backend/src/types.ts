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

export interface IUserMediaStatus extends Document {
  user: Types.ObjectId;
  mediaId: string;
  type: 'anime' | 'manga' | 'reading' | 'vn' | 'video' | 'movie' | 'tv show';
  completed: boolean;
  completedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IPatreonEvent {
  data: {
    attributes: {
      campaign_lifetime_support_cents: number;
      currently_entitled_amount_cents: number;
      email: string;
      full_name: string;
      is_follower: boolean;
      last_charge_date: Date;
      last_charge_status: string;
      lifetime_support_cents: number;
      next_charge_date: Date;
      note: string;
      patron_status: string;
      pledge_cadence: number;
      pledge_relationship_start: Date;
      will_pay_amount_cents: number;
    };
    id: string;
    relationships: {
      address: {
        data?: unknown[];
      };
      campaign: {
        data: {
          id: number;
          type: string;
        };
        links: {
          related: string;
        };
      };
      currently_entitled_tiers: {
        data: unknown[];
      };
      user: {
        data: {
          id: number;
          type: string;
        };
        links: {
          related: string;
        };
      };
    };
    type: string;
  };
  included: {
    attributes:
      | {
          created_at: Date;
          creation_name: string;
          discord_server_id?: string;
          google_analytics_id?: string;
          has_rss: boolean;
          has_sent_rss_notify: boolean;
          image_small_url: string;
          image_url: string;
          is_charged_immediately: boolean;
          is_monthly: boolean;
          is_nsfw: boolean;
          main_video_embed?: string;
          main_video_url?: string;
          one_liner?: string;
          patron_count: number;
          pay_per_name: string;
          pledge_url: string;
          published_at: Date;
          rss_artwork_url?: string;
          rss_feed_title?: string;
          summary: string;
          thanks_embed?: string;
          thanks_msg?: string;
          thanks_video_url?: string;
          url: string;
          vanity: string;
        }
      | {
          attributes: {
            about: string;
            created: Date;
            first_name: string;
            full_name: string;
            hide_pledges: boolean;
            image_url: string;
            is_creator: boolean;
            last_name: string;
            like_count: number;
            social_connections: {
              deviantart?: string;
              discord?: string;
              facebook?: string;
              google?: string;
              instagram?: string;
              reddit?: string;
              spotify?: string;
              twitch?: string;
              twitter?: string;
              vimeo?: string;
              youtube?: string;
            };
            thumb_url: string;
            url: string;
            vanity?: string;
          };
          id: number;
          type: string;
        }[];
  };
  links: {
    self: string;
  };
}

export interface IPatreonIncludedTier {
  id: string;
  type: 'tier';
  attributes: {
    title: string;
    amount_cents: number;
  };
}

export interface IPatreonIncludedMember {
  id: string;
  type: 'member';
  attributes: {
    patron_status: 'active_patron' | 'former_patron' | string | null;
    currently_entitled_amount_cents: number | null;
  };
  relationships?: {
    campaign: {
      data: {
        id: string;
        type: 'campaign';
      };
      links: {
        related: string;
      };
    };
    currently_entitled_tiers?: {
      data: Array<{
        id: string;
        type: 'tier';
      }>;
    };
  };
}

export interface IPatreonIdentityResponse {
  data: {
    id: string;
    type: 'user';
    attributes: {
      email: string | null;
      full_name: string | null;
      is_email_verified?: boolean; // Patreon la envía solo si aplica
    };
    relationships: {
      memberships?: {
        data: Array<{
          id: string;
          type: 'membership';
        }>;
      };
    };
  };

  included?: Array<IPatreonIncludedMember | IPatreonIncludedTier>;

  links?: {
    self: string;
  };
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
  firstImport?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  settings?: IUserSettings;
  patreon?: IPatreonData;
  matchPassword: (enteredPassword: string) => Promise<boolean>;
}

export interface IMediaTitle {
  contentTitleNative: string;
  contentTitleRomaji?: string;
  contentTitleEnglish?: string;
}

interface IMediaDescription {
  description: string;
  language: 'eng' | 'jpn' | 'spa';
}

export interface IMediaDocument {
  _id?: Types.ObjectId;
  contentId: string;
  title: IMediaTitle;
  contentImage?: string;
  coverImage?: string;
  description?: IMediaDescription[];
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
  isCompleted?: boolean;
  completedAt?: Date | null;
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
    | 'other'
    | 'tv show';
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
  timezone?: string;
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
  isAdult?: boolean;
}

export interface IClubMediaVoting {
  _id?: Types.ObjectId;
  club: Types.ObjectId;
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
  completedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IClubMedia {
  _id?: Types.ObjectId;
  mediaId?: string;
  mediaType: 'anime' | 'manga' | 'reading' | 'vn' | 'video' | 'movie';
  title: string;
  description?: string;
  startDate: Date;
  endDate: Date;
  isActive: boolean;
  addedBy: Types.ObjectId;
  votingId?: Types.ObjectId; // Links to the voting that created this media
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
  tags: string[];
  memberLimit: number;
  rules?: string;
  isActive: boolean;
  legacyMediaVotings?: IClubMediaVoting[];
  migratedMediaVotingsAt?: Date;
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

export interface manabeLogs {
  _id: string;
  descripcion: string;
  medio:
    | 'ANIME'
    | 'MANGA'
    | 'LECTURA'
    | 'TIEMPOLECTURA'
    | 'VN'
    | 'VIDEO'
    | 'AUDIO'
    | 'OUTPUT'
    | 'JUEGO'
    | 'LIBRO'
    | 'JUEGOLECTURA';
  tiempo?: number;
  caracteres?: number;
  parametro: number;
  createdAt: string;
  officialId?: string;
}

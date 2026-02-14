export interface IUser {
  _id: string;
  avatar?: string;
  banner?: string;
  about?: string;
  username: string;
  email?: string;
  verified?: boolean;
  clubs?: string[];
  discordId?: string;
  patreon?: {
    patreonId?: string;
    patreonEmail?: string;
    tier: 'donator' | 'enthusiast' | 'consumer' | null;
    customBadgeText?: string;
    badgeColor?: string;
    badgeTextColor?: string;
    isActive: boolean;
    lastChecked?: Date;
  };
  stats: IStats;
  titles: string[];
  roles: userRoles;
  createdAt?: Date;
  updatedAt?: Date;
  settings?: {
    blurAdultContent: boolean;
    hideUnmatchedLogsAlert?: boolean;
    timezone?: string;
  };
  matchPassword: (enteredPassword: string) => Promise<boolean>;
}

enum userRoles {
  admin = 'admin',
  user = 'user',
  mod = 'mod',
}

export type OutletProfileContextType = {
  user: IUser | undefined;
  username: string;
};

export type OutletMediaContextType = {
  mediaDocument?: IMediaDocument & { jiten?: IJitenResponse };
  mediaType?: string;
  username?: string;
};

export type OutletClubMediaContextType = {
  club?: IClubResponse;
  clubMedia?: IClubMedia;
  clubMediaData?: { media: IClubMedia[]; total?: number };
  clubMediaError?: Error | null;
  user?: ILoginResponse | null;
};

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
  // Add hours fields
  userHours?: number;
  readingHours?: number;
  listeningHours?: number;
  // Add chars field for global characters ranking
  userChars?: number;
  currentStreak: number;
  longestStreak: number;
  lastStreakDate: Date | null;
}

export type ILoginResponse = Pick<
  IUser,
  | '_id'
  | 'username'
  | 'email'
  | 'verified'
  | 'about'
  | 'stats'
  | 'avatar'
  | 'banner'
  | 'titles'
  | 'roles'
  | 'discordId'
  | 'patreon'
  | 'settings'
>;

export interface IRegisterInput {
  username: string;
  email?: string;
  password: string;
  passwordConfirmation: string;
  timezone?: string;
}

export interface ILoginInput {
  login: string;
  password: string;
}

export interface IForgotPasswordInput {
  email: string;
}

export interface IResetPasswordInput {
  password: string;
  passwordConfirmation: string;
}

// Add validation interfaces
export interface IValidationError {
  field: string;
  message: string;
}

export interface IFormValidation {
  isValid: boolean;
  errors: Record<string, string>;
}

export interface IPasswordValidation {
  minLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumber: boolean;
  hasSpecialChar: boolean;
}

export interface IUsernameValidation {
  minLength: boolean;
  maxLength: boolean;
  validCharacters: boolean;
  notEmpty: boolean;
}

export interface ILogValidation {
  type: boolean;
  mediaName: boolean;
  episodes: boolean;
  timeSpent: boolean;
  activity: boolean;
  reasonableValues: boolean;
}

export type logoutResponseType = {
  message: string;
};

export type sortTypes = 'asc' | 'desc';

export type filterTypes =
  | 'userLevel'
  | 'userXp'
  | 'userChars'
  | 'readingXp'
  | 'readingLevel'
  | 'listeningXp'
  | 'listeningLevel'
  | 'charCountVn'
  | 'charCountLn'
  | 'readingTimeVn'
  | 'charCountReading'
  | 'pageCountLn'
  | 'readingTimeLn'
  | 'pageCountManga'
  | 'charCountManga'
  | 'readingTimeManga'
  | 'mangaPages'
  | 'listeningTime'
  | 'readingTime'
  | 'animeEpisodes'
  | 'animeWatchingTime'
  | 'videoWatchingTime'
  | 'userHours'
  | 'readingHours'
  | 'listeningHours';

export interface IRankingParams {
  page?: number;
  limit?: number;
  sort?: sortTypes;
  filter?: filterTypes;
  timeFilter?: string; // Add time filter parameter
  timezone?: string; // Add timezone parameter
  start?: string; // YYYY-MM-DD
  end?: string; // YYYY-MM-DD
}

export interface ILogsParams extends Pick<IRankingParams, 'page' | 'limit'> {
  mediaId?: string;
  search?: string;
  start?: string;
  end?: string;
  type?: ILog['type'] | ILog['type'][];
  sortBy?: 'date' | 'xp' | 'episodes' | 'chars' | 'pages' | 'time';
  sortDirection?: 'asc' | 'desc';
}

// Add interface for MatchMedia logs (minimal required fields)
export interface IMatchMediaLog {
  _id: string;
  type:
    | 'anime'
    | 'manga'
    | 'reading'
    | 'vn'
    | 'video'
    | 'movie'
    | 'tv show'
    | 'audio'
    | 'other';
  description: string;
  mediaId?: string;
  date: Date;
  episodes?: number;
  pages?: number;
  chars?: number;
  time?: number;
  xp: number;
}

export interface updateUserRequest {
  username?: string;
  email?: string;
  password?: string;
  discordId?: string;
  avatar?: string;
  newPassword?: string;
  newPasswordConfirm?: string;
  blurAdultContent?: boolean;
  about?: string;
}

export interface IEditedFields {
  episodes?: number;
  pages?: number;
  chars?: number;
  time?: number;
  xp?: number;
}

export interface IUpdateLogRequest {
  description?: string;
  time?: number;
  date?: Date;
  type?: ILog['type'];
  contentId?: number;
  episodes?: number;
  pages?: number;
  chars?: number;
  mediaId?: string;
  tags?: string[];
}

export interface IContentMedia {
  contentId: string;
  contentImage: string | null;
  coverImage: string | null;
  contentTitleNative: string;
  contentTitleRomaji?: string;
  contentTitleEnglish: string;
  description?: string;
  episodes?: number;
  episodeDuration?: number;
  chapters?: number;
  volumes?: number;
  synonyms?: string[] | null;
  isAdult: boolean;
  date?: Date | null;
  // YouTube specific fields
  channelId?: string;
  channelTitle?: string;
  channelImage?: string;
  channelDescription?: string;
}

export interface ICreateLog
  extends Omit<ILog, '_id' | 'user' | 'createdAt' | 'updatedAt' | 'xp'> {
  mediaData?: IContentMedia & {
    // YouTube specific fields
    channelId?: string;
    channelTitle?: string;
    channelImage?: string;
    channelDescription?: string;
  };
}

export interface ITag {
  _id: string;
  user: string;
  name: string;
  color: string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface ILog {
  _id: string;
  user: {
    _id: string;
    username: string;
    avatar?: string;
  };
  userId?: {
    _id: string;
    username: string;
    avatar?: string;
  };
  type:
    | 'anime'
    | 'manga'
    | 'reading'
    | 'vn'
    | 'video'
    | 'movie'
    | 'tv show'
    | 'audio'
    | 'other';
  description: string;
  episodes?: number;
  pages?: number;
  chars?: number;
  time?: number;
  date: Date | string;
  xp: number;
  mediaId?: string;
  manabeId?: string;
  media?: {
    contentId: string;
    title: {
      contentTitleNative: string;
      contentTitleEnglish?: string;
      contentTitleRomaji?: string;
    };
    contentImage?: string;
    type: string;
  };
  tags?: ITag[] | string[];
  private: boolean;
  isAdult: boolean;
}

export interface IRankingResponse {
  username: string;
  avatar: string;
  stats: Pick<IStats, filterTypes>;
  patreon?: {
    isActive: boolean;
    tier: 'donator' | 'enthusiast' | 'consumer' | null;
    customBadgeText?: string;
    badgeColor?: string;
    badgeTextColor?: string;
  };
}

export interface IRankingSummaryDetails {
  position: number;
  totalUsers: number;
  userXp: number;
  nextUser: {
    username: string;
    xp: number;
    gap: number;
  } | null;
}

export interface IRankingSummary extends IRankingSummaryDetails {
  monthly: IRankingSummaryDetails;
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

export interface IAnimeDocument {
  _id: string;
  sources?: string[];
  title: string;
  type: 'TV' | 'MOVIE' | 'OVA' | 'ONA' | 'SPECIAL' | 'UNKNOWN';
  episodes?: number;
  status: 'FINISHED' | 'ONGOING' | 'UPCOMING' | 'UNKNOWN';
  animeSeason: {
    season?: 'SPRING' | 'SUMMER' | 'FALL' | 'WINTER' | 'UNDEFINED';
    year: number | null;
  };
  picture?: string;
  thumbnail?: string;
  duration?: {
    value?: number;
    unit?: 'SECONDS';
  } | null;
  synonyms?: string[];
  relatedAnime?: string[];
  tags?: string[];
}

export interface IMediaTitle {
  contentTitleNative: string;
  contentTitleRomaji?: string;
  contentTitleEnglish?: string;
}

export interface IImmersionList {
  anime: IMediaDocument[];
  manga: IMediaDocument[];
  reading: IMediaDocument[];
  vn: IMediaDocument[];
  video: IMediaDocument[];
  movie: IMediaDocument[];
  'tv show': IMediaDocument[];
}

interface IMediaDescription {
  description: string;
  language: 'eng' | 'jpn' | 'spa';
}

interface IMediaDescription {
  description: string;
  language: 'eng' | 'jpn' | 'spa';
}

export interface IMediaDocument {
  _id?: string;
  contentId: string;
  title: IMediaTitle;
  contentImage?: string;
  coverImage?: string;
  description?: Array<IMediaDescription>;
  type: 'anime' | 'manga' | 'reading' | 'vn' | 'video' | 'movie' | 'tv show';
  episodes?: number;
  episodeDuration?: number;
  runtime?: number;
  seasons?: number;
  chapters?: number;
  volumes?: number;
  synonyms?: string[] | null;
  isAdult: boolean;
  lastLogDate?: string;
  isCompleted?: boolean;
  completedAt?: string | Date | null;
}

export interface IAverageColor {
  rgb: string;
  rgba: string;
  hex: string;
  hexa: string;
  value: [number, number, number, number];
  isDark: boolean;
  isLight: boolean;
  error?: Error;
}

export interface ILogData {
  type: string | null;
  titleNative: string;
  titleRomaji: string | null;
  titleEnglish: string | null;
  description: string | null;
  mediaDescription: string;
  mediaName: string;
  mediaId: string;
  episodes: number;
  time: number;
  chars: number;
  pages: number;
  hours: number;
  minutes: number;
  showTime: boolean;
  showChars: boolean;
  img: string;
  cover: string;
  date: Date | null;
}

interface IUserStats {
  totals: {
    totalLogs: number;
    totalXp: number;
    totalTimeHours: number;
    readingHours: number;
    listeningHours: number;
    untrackedCount: number;
    totalChars: number;
    dailyAverageHours: number;
    dailyAverageChars: number;
    dayCount: number;
  };
  streaks: {
    currentStreak: number;
    longestStreak: number;
  };
  statsByType: Array<{
    type: string;
    count: number;
    totalXp: number;
    totalTimeMinutes: number;
    totalTimeHours: number;
    totalChars: number;
    totalPages: number;
    totalEpisodes: number;
    untrackedCount: number;
    dates: Array<{
      date: Date;
      xp: number;
      time?: number;
      episodes?: number;
      localDate?: {
        iso: string;
        year: number;
        month: number;
        day: number;
        hour: number;
        minute: number;
        second: number;
        dayKey: string;
        monthKey: string;
        utcMillis: number;
      };
    }>;
  }>;
  readingSpeedData?: Array<{
    date: Date;
    type: string;
    time: number;
    chars?: number;
    pages?: number;
    charsPerHour?: number | null;
    localDate?: {
      iso: string;
      year: number;
      month: number;
      day: number;
      hour: number;
      minute: number;
      second: number;
      dayKey: string;
      monthKey: string;
      utcMillis: number;
    };
  }>;
  timeRange: 'today' | 'week' | 'month' | 'year' | 'total' | 'custom';
  selectedType: string;
  timezone: string;
}

export interface youtubeChannelInfo {
  channelId: string;
  channelTitle: string;
  channelImage?: string;
  channelDescription: string;
}

export interface IDailyGoal {
  _id?: string;
  type: 'time' | 'chars' | 'episodes' | 'pages';
  target: number;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
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

export interface IDailyGoalsResponse {
  goals: IDailyGoal[];
  todayProgress: IDailyGoalProgress;
}

export interface ILongTermGoal {
  _id?: string;
  type: 'time' | 'chars' | 'episodes' | 'pages';
  totalTarget: number; // Total amount to achieve by target date
  targetDate: Date | string; // Deadline for achieving the goal
  displayTimeframe: 'daily' | 'weekly' | 'monthly'; // How to display progress
  startDate: Date | string; // When the goal period started
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  progress?: ILongTermGoalProgress; // Calculated progress data
}

export interface ILongTermGoalProgress {
  goalId: string;
  totalProgress: number; // Current total progress
  requiredPerTimeframe: number; // Required progress per display timeframe to meet goal
  remainingDays: number;
  remainingTarget: number;
  isOnTrack: boolean; // Whether current pace will meet the goal
  timeframeName: string; // "today", "this week", "this month"
  progressToday?: number; // Progress made today (for context)
  progressThisWeek?: number; // Progress made this week
  progressThisMonth?: number; // Progress made this month
}

export interface ILongTermGoalsResponse {
  goals: ILongTermGoal[];
}

interface IJitenDeck {
  deckId: number;
  creationDate: Date;
  coverName: string;
  mediaType: number;
  originalTitle: string;
  romajiTitle: string;
  englishTitle: string;
  characterCount: number;
  wordCount: number;
  uniqueWordCount: number;
  uniqueWordUsedOnceCount: number;
  uniqueKanjiCount: number;
  uniqueKanjiUsedOnceCount: number;
  difficulty: number;
  difficultyRaw: number;
  sentenceCount: number;
  averageSentenceLength: number;
  parentDeckId: number | null;
  links: Array<{
    linkId: number;
    linkType: number;
    url: string;
  }>;
  childrenDeckCount: number;
  selectedWordOcurrences: number;
  dialoguePercentage: number;
}

export interface IJitenResponse {
  parentDeck: IJitenDeck;
  mainDeck: IJitenDeck;
  subDecks: IJitenDeck[];
}

// Club-related interfaces
export interface IClubMember {
  user: IUser;
  role: 'leader' | 'moderator' | 'member';
  joinedAt: Date;
  status: 'active' | 'pending' | 'banned';
}

export interface IClubMedia {
  _id?: string;
  mediaId: string;
  mediaType:
    | 'anime'
    | 'manga'
    | 'reading'
    | 'vn'
    | 'video'
    | 'movie'
    | 'tv show';
  title: string;
  description?: string;
  startDate: Date;
  endDate: Date;
  isActive: boolean;
  addedBy: IUser;
  // Reference to the actual media document for images and metadata
  mediaDocument?: IMediaDocument | null;
  votes: Array<{
    user: string;
    vote: number;
  }>;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IClubReview {
  _id: string;
  user: IUser;
  clubMedia: string;
  content: string;
  rating?: number;
  hasSpoilers: boolean;
  likes: string[];
  editedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IClubMediaCandidate {
  mediaId: string;
  title: string;
  description?: string;
  image?: string;
  addedBy: IUser;
  addedAt?: Date;
  votes: string[];
  isAdult?: boolean;
}

export interface IClubMediaVoting {
  _id?: string;
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
  createdBy: IUser;

  candidates: IClubMediaCandidate[];
  winnerCandidate?: {
    mediaId: string;
    title: string;
    description?: string;
    image?: string;
    isAdult?: boolean;
  };
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IClub {
  _id: string;
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
  mediaVotings: IClubMediaVoting[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IClubResponse extends IClub {
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

export interface ICreateClubRequest {
  name: string;
  description?: string;
  isPublic?: boolean;
  tags?: string[];
  rules?: string;
  memberLimit?: number;
}

type OptionalExceptFor<T, TRequired extends keyof T> = Partial<T> &
  Pick<T, TRequired>;

export type SearchResultType = OptionalExceptFor<
  IMediaDocument,
  '_id' | 'contentId' | 'title' | 'contentImage' | 'isAdult' | 'type'
>;

export interface ITextLine {
  id: string;
  text: string;
  charsCount: number;
  createdAt: string;
}

export interface ITextSession {
  _id: string;
  roomId?: string;
  userId?: string;
  mediaId?: string | IMediaDocument;
  timerSeconds?: number;
  lines: ITextLine[];
  createdAt: string;
  updatedAt?: string;
}

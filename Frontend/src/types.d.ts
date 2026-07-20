export type StatsCardId =
  | 'totalXp'
  | 'timeSpent'
  | 'logCount'
  | 'dailyAverage'
  | 'currentStreak'
  | 'longestStreak'
  | 'readingHours'
  | 'listeningHours'
  | 'readingListeningBalance'
  | 'episodeTotals'
  | 'avgReadingSpeed'
  | 'dailyAvgChars'
  | 'charsRead'
  | 'pagesRead'
  | 'logCountChart'
  | 'timeDistributionChart'
  | 'xpDistributionChart'
  | 'readingSpeedChart'
  | 'progressTimelineChart';

export type StatsGroupId =
  | 'totals'
  | 'streaks'
  | 'timeBreakdown'
  | 'readingMetrics'
  | 'chartDistribution'
  | 'chartProgress'
  | 'chartReading';

export interface StatsLayoutItem {
  id: StatsCardId;
  visible: boolean;
}

export interface StatsGroupLayout {
  id: StatsGroupId;
  visible: boolean;
  cards: StatsLayoutItem[];
}

export interface IUser {
  _id: string;
  avatar?: string;
  banner?: string;
  about?: string;
  username: string;
  email?: string;
  verified?: boolean;
  clubs?: string[];
  clubGoals?: IClubGoal[];
  discordId?: string;
  patreon?: {
    patreonId?: string;
    patreonEmail?: string;
    tier: 'donator' | 'enthusiast' | 'consumer' | null;
    customBadgeText?: string;
    badgeColor?: string;
    badgeTextColor?: string;
    isActive: boolean;
    memberSince?: Date | string | null;
    lastChecked?: Date;
  };
  moderation?: {
    rankingBanned: boolean;
    banned: boolean;
    banReason?: string;
    updatedAt?: string | Date | null;
    updatedBy?: string | null;
    updatedByUsername?: string;
    history?: {
      field: 'rankingBanned' | 'banned' | 'banReason';
      previousValue: boolean | string;
      newValue: boolean | string;
      reasonSnapshot?: string;
      updatedAt: string | Date;
      updatedBy?: string | null;
      updatedByUsername?: string;
    }[];
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
    statsLayout?: StatsGroupLayout[];
    notificationsLastViewedAt?: string | Date | null;
    dismissedNotificationClubIds?: string[];
    dismissedNotificationClubAt?: Record<string, string | Date>;
  };
  statsLayout?: StatsGroupLayout[];
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
  mediaTitle?: string;
  start?: string;
  end?: string;
  type?: ILog['type'] | ILog['type'][];
  sortBy?:
    | 'date'
    | 'xp'
    | 'episodes'
    | 'chars'
    | 'pages'
    | 'time'
    | 'readingSpeed';
  sortDirection?: 'asc' | 'desc';
  tags?: string[] | string;
  tagsMode?: 'any' | 'all';
  volume?: number;
  volumeMin?: number;
  volumeMax?: number;
  episodes?: number;
  episodesMin?: number;
  episodesMax?: number;
  pages?: number;
  pagesMin?: number;
  pagesMax?: number;
  chars?: number;
  charsMin?: number;
  charsMax?: number;
  time?: number;
  timeMin?: number;
  timeMax?: number;
}

// Add interface for MatchMedia logs (minimal required fields)
export interface IMatchMediaLog {
  _id: string;
  type:
    | 'anime'
    | 'manga'
    | 'reading'
    | 'vn'
    | 'game'
    | 'video'
    | 'movie'
    | 'tv show'
    | 'audio'
    | 'other';
  description: string;
  mediaId?: string;
  date: Date;
  episodes?: number;
  volume?: number;
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
  volume?: number;
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
  volume?: number;
  pages?: number;
  chars?: number;
  mediaId?: string;
  tags?: string[];
}

export interface IContentMedia {
  contentId: string;
  type: 'anime' | 'manga' | 'reading' | 'vn' | 'video' | 'movie' | 'game';
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
  isAdultImage?: boolean;
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
    | 'game'
    | 'video'
    | 'movie'
    | 'tv show'
    | 'audio'
    | 'other';
  description: string;
  playlistBatchId?: string;
  playlistBatchTitle?: string;
  episodes?: number;
  volume?: number;
  pages?: number;
  chars?: number;
  time?: number;
  unknownDate?: boolean;
  date: Date | string;
  xp: number;
  mediaId?: string;
  manabeId?: string;
  media?: Pick<
    IContentMedia,
    | 'contentId'
    | 'contentImage'
    | 'coverImage'
    | 'type'
    | 'isAdult'
    | 'isAdultImage'
  > & {
    title: {
      contentTitleNative: string;
      contentTitleRomaji?: string;
      contentTitleEnglish: string;
    };
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

export interface IRankingHistoryPoint {
  date: string;
  globalPosition: number;
  monthlyPosition: number;
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

export type MediaRequestStatus = 'pending' | 'approved' | 'rejected';

export type MediaRequestType =
  | 'anime'
  | 'manga'
  | 'reading'
  | 'vn'
  | 'video'
  | 'movie'
  | 'tv show'
  | 'game';

export interface IMediaRequest {
  _id: string;
  user: { _id: string; username: string; avatar?: string } | string;
  title: IMediaTitle;
  type: MediaRequestType;
  description?: IMediaDescription[];
  referenceUrl?: string;
  coverImage?: string;
  isAdult: boolean;
  note?: string;
  status: MediaRequestStatus;
  reviewedBy?: { _id: string; username: string } | string | null;
  reviewNote?: string;
  reviewedAt?: string | null;
  createdMediaContentId?: string | null;
  createdMediaType?: MediaRequestType | null;
  createdAt: string;
  updatedAt: string;
}

export interface ICreateMediaRequest {
  title: IMediaTitle;
  type: MediaRequestType;
  description?: IMediaDescription[];
  referenceUrl?: string;
  coverImage?: string;
  isAdult?: boolean;
  note?: string;
}

export interface IMediaRequestListResponse {
  requests: IMediaRequest[];
  page: number;
  totalPages: number;
  total: number;
  pendingCount: number;
}

export interface IImmersionList {
  anime: IMediaDocument[];
  manga: IMediaDocument[];
  reading: IMediaDocument[];
  vn: IMediaDocument[];
  game: IMediaDocument[];
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
  type:
    | 'anime'
    | 'manga'
    | 'reading'
    | 'vn'
    | 'game'
    | 'video'
    | 'movie'
    | 'tv show';
  episodes?: number;
  episodeDuration?: number;
  runtime?: number;
  seasons?: number;
  chapters?: number;
  volumes?: number;
  characters?: number;
  genres?: string[];
  platforms?: string[];
  synonyms?: string[] | null;
  isAdult: boolean;
  isAdultImage?: boolean;
  lastLogDate?: string;
  isCompleted?: boolean;
  completedAt?: string | Date | null;
  autoCompleteSuppressed?: boolean;
  mediaStatus?:
    | 'completed'
    | 'dropped'
    | 'paused'
    | 'planning'
    | 'in_progress'
    | null;
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
      unknownDate?: boolean;
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

interface IJitenDeckLink {
  linkId: number;
  linkType: number;
  url: string;
  deckId: number;
}

interface IJitenDeck {
  deckId: number;
  creationDate: string;
  releaseDate: string | null;
  coverName: string;
  mediaType: number;
  originalTitle: string;
  romajiTitle: string | null;
  englishTitle: string | null;
  description: string;
  characterCount: number;
  wordCount: number;
  uniqueWordCount: number;
  uniqueWordUsedOnceCount: number;
  uniqueKanjiCount: number;
  uniqueKanjiUsedOnceCount: number;
  difficulty: number;
  difficultyRaw: number;
  difficultyOverride: number;
  difficultyAlgorithmic: number;
  sentenceCount: number;
  speechDuration: number;
  speechMoraCount: number;
  speechSpeed: number;
  averageSentenceLength: number;
  parentDeckId: number | null;
  links: IJitenDeckLink[];
  aliases: string[];
  childrenDeckCount: number;
  selectedWordOccurrences: number;
  dialoguePercentage: number;
  hideDialoguePercentage: boolean;
  coverage: number;
  uniqueCoverage: number;
  youngCoverage: number;
  youngUniqueCoverage: number;
  externalRating: number;
  exampleSentence: string | null;
  genres: number[];
  tags: unknown[];
  relationships: unknown[];
  status: string | null;
  isFavourite: boolean | null;
  isIgnored: boolean | null;
  distinctVoterCount: number;
  userAdjustment: number;
}

export interface IJitenResponse {
  parentDeck: IJitenDeck | null;
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
    | 'game'
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

export interface IMediaReview {
  _id: string;
  user: IUser;
  mediaContentId: string;
  mediaType:
    | 'anime'
    | 'manga'
    | 'reading'
    | 'vn'
    | 'game'
    | 'video'
    | 'movie'
    | 'tv show';
  summary: string;
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
  isAdultImage?: boolean;
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
    | 'game'
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
    isAdultImage?: boolean;
  };
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IClubGoal {
  type: 'time' | 'chars' | 'episodes' | 'pages';
  target: number;
  period: 'weekly' | 'monthly' | 'custom' | 'indefinite';
  currentProgress: number;
  isActive: boolean;
  startDate?: string;
  endDate?: string;
  createdAt?: string;
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
  clubGoals: IClubGoal[];
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

/**
 * Mirrors NOTIFICATION_TYPES in Backend/src/types.ts. Keep both in sync when
 * adding a new notification kind.
 */
export type NotificationType =
  | 'review_like'
  | 'review_comment'
  | 'comment_reply'
  | 'comment_like'
  | 'mention'
  | 'follow'
  | 'club_join_request'
  | 'club_join_approved'
  | 'club_join_rejected'
  | 'club_member_removed'
  | 'club_media_added'
  | 'club_voting_started'
  | 'club_voting_finished'
  | 'club_leadership_transferred'
  | 'media_request_approved'
  | 'media_request_rejected'
  | 'achievement_unlocked'
  | 'level_up'
  | 'goal_completed'
  | 'streak_lost'
  | 'changelog'
  | 'system';

export type NotificationSectionType =
  | 'club_join_requests'
  | 'changelog'
  | 'activity';

export interface INotificationSummaryItem {
  id: string;
  label: string;
  count: number;
  type?: NotificationType | 'club_join_requests';
  meta?: Record<string, string>;
}

export interface INotificationSummarySection {
  type: NotificationSectionType;
  title: string;
  items: INotificationSummaryItem[];
}

export interface INotificationSummaryResponse {
  totalCount: number;
  sections: INotificationSummarySection[];
}

export interface INotificationListItem {
  id: string;
  label: string;
  body?: string;
  type?: NotificationType | 'club_join_requests';
  count: number;
  isRead: boolean;
  createdAt: string;
  /** Route to open. Present on stored notifications; derived ones fall back. */
  link?: string;
  /** Image override (media cover, club icon…). Falls back to actor avatar. */
  image?: string;
  meta?: Record<string, string>;
}

export interface INotificationListResponse {
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
  items: INotificationListItem[];
}

export interface ICreateClubRequest {
  name: string;
  description?: string;
  isPublic?: boolean;
  tags?: string[];
  rules?: string;
  memberLimit?: number;
  clubGoals?: IClubGoal[];
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

export interface ITextSessionHistoryEntry {
  loggedAt: string;
  isShared: boolean;
  connectedUsersCount: number;
  linesLogged?: number;
  charactersLogged: number;
  readingSpeed: number;
  sessionSeconds: number;
}

export interface ITextSession {
  _id: string;
  roomId?: string;
  userId?: string;
  mediaId?: string | IMediaDocument;
  blankId?: string;
  name?: string;
  timerSeconds?: number;
  lines: ITextLine[];
  sessionHistory?: ITextSessionHistoryEntry[];
  createdAt: string;
  updatedAt?: string;
}

export interface IGanttMediaItem {
  mediaId: string;
  type: string;
  title: string; // contentTitleNative
  titleEnglish?: string; // contentTitleEnglish (optional)
  contentImage?: string; // cover thumbnail URL
  firstLogDate: string; // ISO 8601 datetime string
  lastLogDate: string; // ISO 8601 datetime string
  isCompleted: boolean;
  completedAt?: string; // ISO 8601 datetime string, set when completed
  logCount: number;
  totalTime: number; // total minutes across all logs
  totalXp: number;
  activeDates: string[]; // sorted YYYY-MM-DD strings (one per active day)
}

// ─── Achievement System ──────────────────────────────────────────────────────

export type AchievementRarity =
  | 'common'
  | 'rare'
  | 'epic'
  | 'legendary'
  | 'secret';

export type AchievementCategory =
  | 'streaks'
  | 'immersion'
  | 'social'
  | 'milestone'
  | 'secret';

export interface IAchievement {
  _id: string;
  key: string;
  name?: string;           // undefined for hidden secrets
  description?: string;    // undefined for hidden secrets
  hint?: string;
  category: AchievementCategory;
  rarity: AchievementRarity;
  iconSlug?: string;
  isSecret: boolean;
  isHidden: boolean;
  condition?: {
    type: string;
    threshold?: number;
    mediaType?: string;
    stat?: string;
  };
  points: number;
  order?: number;
  rarityPercent?: number;
  isEarned?: boolean;
  unlockedAt?: string | null;
  progress?: number;
}

export interface IUserAchievement {
  _id: string;
  user: string;
  achievement: IAchievement;
  unlockedAt: string;
  progress: number;
  notified: boolean;
}

declare global {
  interface Window {
    /**
     * Replays the achievement reveal modal with demo data.
     * Optional rarity: 'common' | 'rare' | 'epic' | 'legendary' | 'secret'.
     */
    previewAchievementReveal?: (rarity?: string) => void;
    /** Replays the post-log celebration overlay with demo data. */
    previewLogCelebration?: (overrides?: Partial<ILogCelebration>) => void;
  }
}

/**
 * Mirror of Backend/src/types.ts ILogCelebration — post-log feedback payload
 * returned inline by POST /logs.
 */
export interface ILogCelebration {
  xpGained: number;
  streak: number;
  levelUp?: { from: number; to: number };
  xp: {
    current: number;
    toCurrentLevel: number;
    toNextLevel: number;
    level: number;
  };
  rank?: {
    timeframe: 'month';
    rank: number;
    previousRank: number;
    overtaken: { username: string; avatar?: string; xp: number }[];
  };
}

export interface IPendingAchievement {
  userAchievementId: string;
  unlockedAt: string;
  achievement: IAchievement;
  rarityPercent: number;
  user?: { username: string; avatar?: string };
}

// ─── Unified Feed ─────────────────────────────────────────────────────────────

export type UnifiedFeedItem =
  | { kind: 'log';         sortDate: Date; data: ILog }
  | { kind: 'achievement'; sortDate: Date; data: IPendingAchievement };

export type UnifiedFeedFilter = 'all' | 'logs' | 'achievements';

// ─── Media Lists ──────────────────────────────────────────────────────────────

export type MediaListMediaType = IMediaDocument['type'];

export interface IMediaListEntry {
  mediaId: string;
  mediaType: MediaListMediaType;
  note?: string;
  order: number;
  addedAt?: string;
  media: IMediaDocument | null;
}

export interface IMediaList {
  _id: string;
  user: IUser;
  title: string;
  description?: string;
  isRanked: boolean;
  isPublic: boolean;
  entryCount: number;
  /** Entry count per media type, e.g. { vn: 30 }. */
  entryTypeCounts?: Partial<Record<MediaListMediaType, number>>;
  likeCount: number;
  isLiked: boolean;
  commentCount: number;
  clonedFrom?: { _id: string; title: string; user: string } | string | null;
  createdAt?: string;
  updatedAt?: string;
  /** Only present on list detail responses. */
  entries?: IMediaListEntry[];
  /** Only present on browse/profile card responses. */
  preview?: IMediaDocument[];
  /** Only present on the "my lists" response when a media query is given. */
  containsMedia?: boolean;
}

export interface IMediaListComment {
  _id: string;
  list: string;
  user: IUser;
  content: string;
  editedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}



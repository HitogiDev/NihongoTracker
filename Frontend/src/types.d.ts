export interface IUser {
  _id: string;
  avatar?: string;
  banner?: string;
  username: string;
  clubs?: string[];
  discordId?: string;
  stats: IStats;
  titles: string[];
  roles: userRoles;
  createdAt?: Date;
  updatedAt?: Date;
  settings?: {
    blurAdultContent: boolean;
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
  username: string | undefined;
};

export type OutletMediaContextType = {
  mediaDocument?: IMediaDocument & { jiten?: IJitenResponse };
  mediaType?: string;
  username?: string;
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
  currentStreak: number;
  longestStreak: number;
  lastStreakDate: Date | null;
}

export type ILoginResponse = Pick<
  IUser,
  | '_id'
  | 'username'
  | 'stats'
  | 'avatar'
  | 'titles'
  | 'roles'
  | 'discordId'
  | 'settings'
>;

export interface IRegisterInput {
  username: string;
  password: string;
  passwordConfirmation: string;
}

export interface ILoginInput {
  username: string;
  password: string;
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
  | 'videoWatchingTime';

export interface IRankingParams {
  page?: number;
  limit?: number;
  sort?: sortTypes;
  filter?: filterTypes;
  timeFilter?: string; // Add time filter parameter
}

export interface ILogsParams extends Pick<IRankingParams, 'page' | 'limit'> {
  mediaId?: string;
  search?: string;
  start?: string;
  end?: string;
  type?: ILog['type'] | ILog['type'][];
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
  password?: string;
  discordId?: string;
  avatar?: string;
  newPassword?: string;
  newPasswordConfirm?: string;
  blurAdultContent?: boolean;
}

export interface IEditedFields {
  episodes?: number;
  pages?: number;
  chars?: number;
  time?: number;
  xp?: number;
}

export interface updateLogRequest {
  description?: string;
  time?: number;
  date?: Date;
  type?: ILog['type'];
  contentId?: number;
  episodes?: number;
  pages?: number;
  chars?: number;
  mediaId?: string;
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

export interface ILog {
  _id: string;
  user: string;
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
  private: boolean;
  isAdult: boolean;
}

export interface IRankingResponse {
  username: string;
  avatar: string;
  stats: Pick<IStats, filterTypes>;
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

export interface IVNDocument {
  _id: string;
  id: string;
  title: string;
  latin: string | null;
  alias: string[];
  image: string;
  score: number;
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

interface MediaDescription {
  description: string;
  language: 'eng' | 'jpn' | 'spa';
}

interface MediaDescription {
  description: string;
  language: 'eng' | 'jpn' | 'spa';
}

export interface IMediaDocument {
  contentId: string;
  title: IMediaTitle;
  contentImage?: string;
  coverImage?: string;
  description?: Array<MediaDescription>;
  type: 'anime' | 'manga' | 'reading' | 'vn' | 'video' | 'movie' | 'tv show';
  episodes?: number;
  episodeDuration?: number;
  runtime?: number;
  chapters?: number;
  volumes?: number;
  synonyms?: string[] | null;
  isAdult: boolean;
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
  };
  statsByType: Array<{
    type: string;
    count: number;
    totalXp: number;
    totalTimeMinutes: number;
    totalTimeHours: number;
    totalChars: number;
    untrackedCount: number;
    dates: Array<{
      date: Date;
      xp: number;
      time?: number;
      episodes?: number;
    }>;
  }>;
  readingSpeedData?: Array<{
    date: Date;
    type: string;
    time: number;
    chars?: number;
    pages?: number;
    charsPerHour?: number | null;
  }>;
  timeRange: 'today' | 'month' | 'year' | 'total';
  selectedType: string;
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

import axiosInstance from './axiosConfig';
import {
  ILoginResponse,
  IRegisterInput,
  ILoginInput,
  ICreateLog,
  ILog,
  IUser,
  IRankingResponse,
  IRankingParams,
  ILogsParams,
  IMediaDocument,
  IImmersionList,
  IAverageColor,
  IUserStats,
  IUpdateLogRequest,
  IDailyGoal,
  IDailyGoalsResponse,
  ILongTermGoal,
  ILongTermGoalsResponse,
  IJitenResponse,
  ITag,
  SearchResultType,
  IRankingSummary,
  ITextSession,
  ITextLine,
} from '../types';

const api = axiosInstance;

export async function registerUserFn(
  user: IRegisterInput
): Promise<ILoginResponse> {
  const userParams = Object.entries(user).reduce((params, [key, value]) => {
    params.append(key, value);
    return params;
  }, new URLSearchParams());

  const { data } = await api.post<ILoginResponse>('auth/register', userParams);
  return data;
}

export async function loginUserFn(user: ILoginInput): Promise<ILoginResponse> {
  const userParams = Object.entries(user).reduce((params, [key, value]) => {
    params.append(key, value);
    return params;
  }, new URLSearchParams());

  const { data } = await api.post<ILoginResponse>('auth/login', userParams);
  return data;
}

export async function logoutUserFn() {
  const { data } = await api.post('auth/logout');
  return data;
}

export async function forgotPasswordFn(email: string) {
  const { data } = await api.post('auth/forgot-password', { email });
  return data;
}

export async function resetPasswordFn(
  token: string,
  password: string,
  passwordConfirmation: string
) {
  const { data } = await api.post(`auth/reset-password/${token}`, {
    password,
    passwordConfirmation,
  });
  return data;
}

export async function resendVerificationEmailFn() {
  const { data } = await api.post('auth/resend-verification');
  return data;
}

export async function getPublicStatsFn(): Promise<{
  totalUsers: number;
  totalLogs: number;
  totalXp: number;
}> {
  const { data } = await api.get('auth/stats');
  return data;
}

export async function getUserFn(username: string): Promise<IUser> {
  const { data } = await api.get<IUser>(`users/${username}`);
  return data;
}

export async function updateUserFn(updateValues: FormData) {
  const { data } = await api.put<IUser>(`/users`, updateValues, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return data;
}

export async function clearUserDataFn(username: string) {
  const { data } = await api.post(`users/cleardata`, { username });
  return data;
}

export async function getRankingFn(params?: IRankingParams) {
  const { data } = await api.get<IRankingResponse[]>(`users/ranking`, {
    params,
  });
  return data;
}

export async function getMediumRankingFn(params: {
  page?: number;
  limit?: number;
  type:
    | 'anime'
    | 'manga'
    | 'reading'
    | 'vn'
    | 'video'
    | 'movie'
    | 'tv show'
    | 'audio';
  metric: 'xp' | 'time' | 'episodes' | 'chars' | 'pages';
  timeFilter?: string;
  timezone?: string;
  start?: string;
  end?: string;
}) {
  const { data } = await api.get<
    Array<{
      username: string;
      avatar?: string;
      stats?: { userLevel?: number };
      xp?: number;
      hours?: number;
      episodes?: number;
      chars?: number;
      pages?: number;
      patreon?: {
        isActive: boolean;
        tier: 'donator' | 'enthusiast' | 'consumer' | null;
        customBadgeText?: string;
        badgeColor?: string;
        badgeTextColor?: string;
      };
    }>
  >(`users/ranking/media`, { params });
  return data;
}

export async function getLogFn(id: string): Promise<ILog> {
  const { data } = await api.get<ILog>(`logs/${id}`);
  return data;
}

export const updateLogFn = async (id: string, data: IUpdateLogRequest) => {
  const response = await api.patch(`/logs/${id}`, data);
  return response.data;
};

export async function searchMediaFn(params: {
  type: string;
  search: string;
  ids?: number[];
  page?: number;
  perPage?: number;
}): Promise<SearchResultType[]> {
  const { data } = await api.get<SearchResultType[]>(`media/search`, {
    params,
  });
  return data || [];
}

export async function getMediaFn(
  mediaId: string,
  mediaType: string
): Promise<IMediaDocument & { jiten?: IJitenResponse }> {
  if (!mediaId || !mediaType) {
    throw new Error('Both mediaId and mediaType are required');
  }
  const { data } = await api.get<IMediaDocument & { jiten?: IJitenResponse }>(
    `media/${mediaType}/${mediaId}`
  );
  return data;
}

interface IAssignData {
  logsId: string[];
  contentMedia: IMediaDocument;
}

export async function assignMediaFn(assignData: Array<IAssignData>) {
  const { data } = await api.put(`logs/assign-media`, assignData);
  return data;
}

export async function getUserLogsFn(username: string, params?: ILogsParams) {
  const { data } = await api.get<ILog[]>(`users/${username}/logs`, { params });
  return data;
}

export async function createLogFn(logValues: ICreateLog) {
  // Ensure date is properly serialized with timezone information
  const logData = {
    ...logValues,
    date: logValues.date
      ? logValues.date instanceof Date
        ? logValues.date.toISOString()
        : logValues.date
      : new Date().toISOString(),
  };
  const { data } = await api.post<ILog>(`logs`, logData);
  return data;
}

export async function deleteLogFn(id: string) {
  const { data } = await api.delete(`logs/${id}`);
  return data;
}

export async function importLogsFn() {
  const { data } = await api.post(`logs/import`);
  return data;
}

export async function getImmersionListFn(
  username: string,
  params?: { completed?: 'completed' | 'incomplete' }
) {
  const { data } = await api.get<IImmersionList>(
    `users/${username}/immersionlist`,
    { params }
  );
  return data;
}

export async function updateMediaCompletionStatusFn(payload: {
  mediaId: string;
  type: IMediaDocument['type'];
  completed: boolean;
}) {
  const { data } = await api.post(`users/media/status`, payload);
  return data as {
    mediaId: string;
    type: IMediaDocument['type'];
    isCompleted: boolean;
    completedAt: string | null;
  };
}

export async function getAverageColorFn(imageUrl?: string) {
  if (!imageUrl) return null;
  const { data } = await api.get<IAverageColor>(`media/utils/avgcolor`, {
    params: { imageUrl },
  });
  return data;
}

export async function getUntrackedLogsFn() {
  const { data } = await api.get<ILog[]>(`logs/untrackedlogs`);
  return data;
}

export async function importLogFileFn(file: FormData) {
  const { data } = await api.post(`logs/logfileimport`, file, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return data;
}

interface IDashboardHours {
  currentMonth: {
    totalTime: number;
    readingTime: number;
    listeningTime: number;
  };
  previousMonth: {
    totalTime: number;
    readingTime: number;
    listeningTime: number;
  };
}

export async function getDashboardHoursFn(username: string | undefined) {
  if (!username) {
    throw new Error('Username is required to fetch dashboard hours');
  }
  const { data } = await api.get<IDashboardHours>(
    `users/${username}/dashboard`
  );
  return data;
}

export async function getRecentLogsFn(username: string | undefined) {
  if (!username) {
    throw new Error('Username is required to fetch recent logs');
  }
  const { data } = await api.get<ILog[]>(`users/${username}/recentlogs`, {
    params: { limit: 10 },
  });
  return data;
}

export async function getRankingSummaryFn(username: string, timezone?: string) {
  const params = timezone ? { timezone } : undefined;
  const { data } = await api.get<IRankingSummary>(
    `users/${username}/ranking-summary`,
    { params }
  );
  return data;
}

export async function getGlobalFeedFn(params?: {
  type?: ILog['type'] | 'all';
  timeRange?: 'day' | 'week' | 'month' | 'year' | 'all';
  limit?: number;
  includeSelf?: boolean;
}) {
  const { data } = await api.get<ILog[]>('logs/feed', {
    params,
  });
  return data;
}

export async function getUserStatsFn(
  username: string | undefined,
  params?: {
    timeRange?: string;
    type?: string;
    start?: string;
    end?: string;
    timezone?: string;
    includedTags?: string;
    excludedTags?: string;
  }
) {
  if (!username) {
    throw new Error('Username is required to fetch user stats');
  }
  const { data } = await api.get<IUserStats>(`users/${username}/stats`, {
    params,
  });
  return data;
}

export const compareUserStatsFn = async (
  user1: string,
  user2: string,
  mediaId: string,
  type: string
): Promise<IComparisonResult> => {
  const { data } = await api.get<IComparisonResult>('/users/compare', {
    params: { user1, user2, mediaId, type },
  });
  return data;
};

export async function searchYouTubeVideoFn(url: string) {
  const { data } = await api.get<{
    video: IMediaDocument;
    channel: IMediaDocument;
  }>(`media/youtube/video`, {
    params: { url },
  });
  return data;
}

export async function getDailyGoalsFn(username: string | undefined) {
  if (!username) return null;
  const { data } = await api.get<IDailyGoalsResponse>(
    `goals/daily/${username}`
  );
  return data;
}

export async function createDailyGoalFn(
  goal: Omit<IDailyGoal, '_id' | 'createdAt' | 'updatedAt'>
) {
  const { data } = await api.post<IDailyGoal>('goals/daily', goal);
  return data;
}

export async function updateDailyGoalFn(
  goalId: string,
  goal: Partial<IDailyGoal>
) {
  const { data } = await api.patch<IDailyGoal>(`goals/daily/${goalId}`, goal);
  return data;
}

export async function deleteDailyGoalFn(goalId: string) {
  const { data } = await api.delete(`goals/daily/${goalId}`);
  return data;
}

// Long-term goals API functions
export async function getLongTermGoalsFn(username: string | undefined) {
  if (!username) return null;
  const { data } = await api.get<ILongTermGoalsResponse>(
    `goals/long-term/${username}`
  );
  return data;
}

export async function createLongTermGoalFn(
  goal: Omit<ILongTermGoal, '_id' | 'createdAt' | 'updatedAt' | 'progress'>
) {
  const { data } = await api.post<ILongTermGoal>('goals/long-term', goal);
  return data;
}

export async function updateLongTermGoalFn(
  goalId: string,
  goal: Partial<ILongTermGoal>
) {
  const { data } = await api.patch<ILongTermGoal>(
    `goals/long-term/${goalId}`,
    goal
  );
  return data;
}

export async function deleteLongTermGoalFn(goalId: string) {
  const { data } = await api.delete(`goals/long-term/${goalId}`);
  return data;
}

export const getLogDetailsFn = async (logId: string) => {
  const response = await api.get(`/logs/${logId}/details`);
  return response.data;
};

export async function getRecentMediaLogsFn(
  mediaId: string,
  type: string,
  limit = 50
) {
  const { data } = await api.get<ILog[]>(`logs/media/recent`, {
    params: { mediaId, type, limit },
  });
  return data;
}

export interface IComparisonStats {
  totalXp: number;
  totalTime: number;
  totalChars: number;
  totalPages: number;
  totalEpisodes: number;
  logCount: number;
  readingSpeed: number;
  readingPercentage: number | null; // null when no character count data available
}

export interface IComparisonResult {
  user1: {
    username: string;
    stats: IComparisonStats;
  };
  user2: {
    username: string;
    stats: IComparisonStats;
  };
  mediaInfo: {
    contentId: string;
    type: string;
    totalCharCount?: number;
  };
}

// Log screen statistics interface
export interface ILogScreenStats {
  type: string;
  total: {
    logs: number;
    episodes: number;
    characters: number;
    pages: number;
    minutes: number;
    hours: number;
    xp: number;
  };
  today: {
    logs: number;
    episodes: number;
    characters: number;
    pages: number;
    minutes: number;
    hours: number;
    xp: number;
  };
  thisWeek: {
    logs: number;
    episodes: number;
    characters: number;
    pages: number;
    minutes: number;
    hours: number;
    xp: number;
  };
  thisMonth: {
    logs: number;
    episodes: number;
    characters: number;
    pages: number;
    minutes: number;
    hours: number;
    xp: number;
  };
}

export async function getLogScreenStatsFn(
  type?: string
): Promise<ILogScreenStats> {
  const { data } = await api.get<ILogScreenStats>('logs/stats/logscreen', {
    params: type ? { type } : undefined,
  });
  return data;
}

// Media-specific statistics interface
export interface IMediaStats {
  mediaId: string;
  type: string;
  total: {
    logs: number;
    episodes: number;
    characters: number;
    pages: number;
    minutes: number;
    hours: number;
    xp: number;
    firstLogDate: string | null;
    lastLogDate: string | null;
  };
  today: {
    logs: number;
    episodes: number;
    characters: number;
    pages: number;
    minutes: number;
    hours: number;
    xp: number;
  };
  thisWeek: {
    logs: number;
    episodes: number;
    characters: number;
    pages: number;
    minutes: number;
    hours: number;
    xp: number;
  };
  thisMonth: {
    logs: number;
    episodes: number;
    characters: number;
    pages: number;
    minutes: number;
    hours: number;
    xp: number;
  };
}

export async function getUserMediaStatsFn(
  mediaId: string,
  type: string
): Promise<IMediaStats> {
  const { data } = await api.get<IMediaStats>('logs/stats/media', {
    params: { mediaId, type },
  });
  return data;
}

export async function getGlobalMediaStatsFn(
  mediaId: string,
  type: string
): Promise<IMediaStats> {
  const { data } = await api.get<IMediaStats>('logs/stats/media/global', {
    params: { mediaId, type },
  });
  return data;
}

// Admin API functions
export async function getAdminStatsFn() {
  const { data } = await api.get('admin/stats');
  return data;
}

export async function getAdminUsersFn(params: {
  page?: number;
  limit?: number;
  search?: string;
}) {
  const { data } = await api.get('admin/users', { params });
  return data;
}

export async function deleteUserFn(userId: string) {
  const { data } = await api.delete(`admin/users/${userId}`);
  return data;
}

export async function recalculateStatsFn(type: 'streaks' | 'xp') {
  const endpoint =
    type === 'streaks' ? 'recalculateStreaks' : 'recalculateStats';
  const { data } = await api.get(`admin/${endpoint}`);
  return data;
}

export async function syncManabeIdsFn() {
  const { data } = await api.post('logs/sync-manabe-ids');
  return data;
}

// Admin: logs management
export async function searchAdminLogsFn(params: {
  page?: number;
  limit?: number;
  search?: string;
  type?: string;
  username?: string;
  start?: string; // YYYY-MM-DD
  end?: string; // YYYY-MM-DD
}) {
  const { data } = await api.get(`admin/logs`, { params });
  return data as {
    logs: Array<{
      _id: string;
      username?: string;
      user: string;
      type: string;
      description: string;
      episodes?: number;
      pages?: number;
      chars?: number;
      time?: number;
      xp: number;
      date: string;
      mediaTitle?: string;
    }>;
    total: number;
    page: number;
    totalPages: number;
  };
}

export async function adminUpdateLogFn(
  logId: string,
  payload: Partial<IUpdateLogRequest>
) {
  const { data } = await api.put(`admin/logs/${logId}`, payload);
  return data;
}

export async function adminDeleteLogFn(logId: string) {
  const { data } = await api.delete(`admin/logs/${logId}`);
  return data;
}

export async function adminUpdateUserFn(
  userId: string,
  payload: Partial<Omit<IUser, 'roles'>> & { roles?: string[] }
) {
  const { data } = await api.put(`admin/users/${userId}`, payload);
  return data;
}

export async function adminResetPasswordFn(
  userId: string,
  newPassword: string
) {
  const { data } = await api.post(`admin/users/${userId}/reset-password`, {
    newPassword,
  });
  return data;
}

// Patreon API functions
export async function getPatreonStatusFn(): Promise<{
  patreonEmail?: string;
  patreonId?: string;
  tier?: 'donator' | 'enthusiast' | 'consumer' | null;
  isActive: boolean;
  lastChecked?: Date;
  customBadgeText?: string;
  badgeColor?: string;
  badgeTextColor?: string;
}> {
  const { data } = await api.get('patreon/status');
  return data;
}

export async function initiatePatreonOAuthFn(): Promise<{
  authUrl: string;
  message: string;
}> {
  const { data } = await api.get('patreon/oauth/init');
  return data;
}

export async function linkPatreonAccountFn(patreonEmail: string) {
  const { data } = await api.post('patreon/link', { patreonEmail });
  return data;
}

export async function unlinkPatreonAccountFn() {
  const { data } = await api.post('patreon/unlink');
  return data;
}

export async function updateCustomBadgeTextFn(customBadgeText: string) {
  const { data } = await api.patch('patreon/badge', { customBadgeText });
  return data;
}

export async function updateBadgeColorsFn(
  badgeColor: string,
  badgeTextColor: string
) {
  const { data } = await api.patch('patreon/badge-colors', {
    badgeColor,
    badgeTextColor,
  });
  return data;
}

export async function getPatronStatsFn() {
  const { data } = await api.get('admin/stats/patrons');
  return data;
}

// Tags API
export async function getUserTagsByUsernameFn(
  username: string
): Promise<ITag[]> {
  const { data } = await api.get(`tags/user/${username}`);
  return data;
}

export async function createTagFn(tag: {
  name: string;
  color: string;
}): Promise<ITag> {
  const { data } = await api.post('tags', tag);
  return data;
}

export async function updateTagFn(
  id: string,
  tag: { name?: string; color?: string }
): Promise<ITag> {
  const { data } = await api.patch(`tags/${id}`, tag);
  return data;
}

export async function deleteTagFn(id: string): Promise<{ message: string }> {
  const { data } = await api.delete(`tags/${id}`);
  return data;
}

// Changelog API
export interface IChangelogChange {
  type: 'feature' | 'improvement' | 'bugfix' | 'breaking';
  description: string;
}

export interface IChangelog {
  _id: string;
  version: string;
  title: string;
  description?: string;
  changes: IChangelogChange[];
  date: Date;
  createdBy: {
    _id: string;
    username: string;
  };
  published: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export async function getChangelogsFn(): Promise<IChangelog[]> {
  const { data } = await api.get('changelogs');
  return data.data;
}

export async function getAdminChangelogsFn(): Promise<IChangelog[]> {
  const { data } = await api.get('changelogs/admin/all');
  return data.data;
}

export async function getChangelogByIdFn(id: string): Promise<IChangelog> {
  const { data } = await api.get(`changelogs/${id}`);
  return data.data;
}

export async function createChangelogFn(payload: {
  version: string;
  title: string;
  description?: string;
  changes: IChangelogChange[];
  date?: Date;
  published?: boolean;
}): Promise<IChangelog> {
  const { data } = await api.post('changelogs', payload);
  return data.data;
}

export async function updateChangelogFn(
  id: string,
  payload: Partial<{
    version: string;
    title: string;
    description: string;
    changes: IChangelogChange[];
    date: Date;
    published: boolean;
  }>
): Promise<IChangelog> {
  const { data } = await api.patch(`changelogs/${id}`, payload);
  return data.data;
}

export async function deleteChangelogFn(
  id: string
): Promise<{ message: string }> {
  const { data } = await api.delete(`changelogs/${id}`);
  return data;
}

export async function getRecentTextSessionsFn(): Promise<{
  sessions: ITextSession[];
  stats: {
    totalSessions: number;
    totalLines: number;
    totalChars: number;
  };
}> {
  const { data } = await api.get('texthooker/recent');
  return data;
}

export async function getTextSessionFn(
  contentId: string
): Promise<ITextSession> {
  const { data } = await api.get<ITextSession>(`texthooker/${contentId}`);
  return data;
}

export async function updateSessionTimerFn(
  contentId: string,
  timerSeconds: number
): Promise<{ timerSeconds: number }> {
  const { data } = await api.patch<{ timerSeconds: number }>(
    `texthooker/${contentId}/timer`,
    { timerSeconds }
  );
  return data;
}

export async function addLinesToSessionFn(
  contentId: string,
  lines: Partial<ITextLine>[]
): Promise<ITextSession> {
  const { data } = await api.post<ITextSession>(
    `texthooker/${contentId}/lines`,
    { lines }
  );
  return data;
}

export async function checkRoomExistsFn(
  roomId: string
): Promise<{ exists: boolean }> {
  const { data } = await api.get<{ exists: boolean }>(
    `texthooker/room/${roomId}/exists`
  );
  return data;
}

export async function removeLinesFromSessionFn(
  contentId: string,
  lineIds: string[]
): Promise<ITextSession> {
  const { data } = await api.delete<ITextSession>(
    `texthooker/${contentId}/lines`,
    { data: { lineIds } }
  );
  return data;
}

export async function clearSessionLinesFn(
  contentId: string
): Promise<ITextSession> {
  const { data } = await api.delete<ITextSession>(
    `texthooker/${contentId}/lines/all`
  );
  return data;
}

export async function deleteTextSessionFn(contentId: string) {
  const { data } = await api.delete(`texthooker/${contentId}`);
  return data;
}

export async function hideRecentMediaFn(
  action: 'add' | 'remove',
  mediaId: string
) {
  const { data } = await api.patch(`users/settings/hidden-media`, {
    action,
    mediaId,
  });
  return data;
}

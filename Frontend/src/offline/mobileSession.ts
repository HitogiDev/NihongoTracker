import axios from 'axios';
import { SecureStorage } from '@aparajita/capacitor-secure-storage';
import { isNativeApp, apiBaseUrl } from '../utils/nativeRuntime';
import i18n from '../i18n';
import { cacheApiResponse } from './offlineStore';

const SESSION_KEY = 'nihongo.mobile.session.v1';

export interface MobileSession {
  accessToken: string;
  refreshToken: string;
  sessionId: string;
  expiresAt: string;
}

const mobileAuthApi = axios.create({ baseURL: apiBaseUrl(), timeout: 12000 });
mobileAuthApi.interceptors.request.use((config) => {
  config.headers['Accept-Language'] = i18n.language || 'en';
  return config;
});
let session: MobileSession | null = null;
let refreshInFlight: Promise<string | null> | null = null;
let sessionRevision = 0;
let storageWrite: Promise<void> = Promise.resolve();

export function getMobileAccessToken() {
  return session?.accessToken ?? null;
}

export function getMobileSessionUserId(): string | null {
  try {
    const payload = session?.accessToken.split('.')[1];
    if (!payload) return null;
    const decoded: unknown = JSON.parse(
      atob(payload.replace(/-/g, '+').replace(/_/g, '/')),
    );
    if (
      decoded &&
      typeof decoded === 'object' &&
      'id' in decoded &&
      typeof decoded.id === 'string'
    )
      return decoded.id;
  } catch {
    return null;
  }
  return null;
}

export async function saveMobileSession(nextSession: MobileSession) {
  const revision = ++sessionRevision;
  const write = storageWrite
    .catch(() => undefined)
    .then(() =>
      SecureStorage.setItem(SESSION_KEY, JSON.stringify(nextSession)),
    );
  storageWrite = write;
  await write;
  if (revision !== sessionRevision)
    throw new axios.CanceledError('Session changed');
  session = nextSession;
}

export async function clearMobileSession() {
  sessionRevision++;
  session = null;
  const write = storageWrite
    .catch(() => undefined)
    .then(async () => {
      await SecureStorage.remove(SESSION_KEY);
    });
  storageWrite = write;
  await write;
}

export async function loginMobile(login: string, password: string) {
  const { data } = await mobileAuthApi.post<{
    user: import('../types').ILoginResponse;
    session: MobileSession;
  }>('auth/mobile/login', { login, password });
  await saveMobileSession(data.session);
  await cacheApiResponse(
    data.user._id,
    mobileAuthApi.getUri({ url: 'users/me' }),
    data.user,
  ).catch(() => undefined);
  return data.user;
}

export async function refreshMobileAccessToken() {
  if (!isNativeApp() || !session) return null;
  if (refreshInFlight) return refreshInFlight;

  const refreshingSession = session;
  const refreshingRevision = sessionRevision;
  refreshInFlight = mobileAuthApi
    .post<{ session: MobileSession }>('auth/mobile/refresh', {
      sessionId: session.sessionId,
      refreshToken: session.refreshToken,
    })
    .then(async ({ data }) => {
      if (
        session !== refreshingSession ||
        refreshingRevision !== sessionRevision
      )
        throw new axios.CanceledError('Session changed');
      await saveMobileSession(data.session);
      return data.session.accessToken;
    })
    .catch(async (error: unknown) => {
      if (refreshingRevision !== sessionRevision)
        throw new axios.CanceledError('Session changed');
      if (
        axios.isAxiosError(error) &&
        [401, 403].includes(error.response?.status ?? 0)
      ) {
        await clearMobileSession();
        return null;
      }
      throw error;
    })
    .finally(() => {
      refreshInFlight = null;
    });

  return refreshInFlight;
}

export async function initializeMobileSession() {
  if (!isNativeApp()) return true;
  try {
    const stored = await SecureStorage.getItem(SESSION_KEY);
    if (!stored) return false;
    const parsed: unknown = JSON.parse(stored);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const value = parsed as Record<string, unknown>;
      if (
        typeof value.accessToken === 'string' &&
        typeof value.refreshToken === 'string' &&
        typeof value.sessionId === 'string' &&
        typeof value.expiresAt === 'string' &&
        Date.parse(value.expiresAt) > Date.now()
      ) {
        session = {
          accessToken: value.accessToken,
          refreshToken: value.refreshToken,
          sessionId: value.sessionId,
          expiresAt: value.expiresAt,
        };
        return true;
      }
    }
  } catch {
    // Remove malformed credentials before the app reads account data.
  }
  await clearMobileSession().catch(() => undefined);
  return false;
}

export async function logoutMobile() {
  const token = getMobileAccessToken();
  try {
    if (token) {
      await mobileAuthApi
        .post('auth/mobile/logout', undefined, {
          headers: { Authorization: `Bearer ${token}` },
        })
        .catch(() => undefined);
    }
  } finally {
    await clearMobileSession();
  }
}

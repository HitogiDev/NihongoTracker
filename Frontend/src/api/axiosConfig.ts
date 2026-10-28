import axios, { type InternalAxiosRequestConfig } from 'axios';
import i18n from '../i18n';
import { DEFAULT_LANGUAGE } from '../i18n/languages';
import { useUserDataStore } from '../store/userData';
import { apiBaseUrl, isNativeApp } from '../utils/nativeRuntime';
import {
  clearMobileSession,
  getMobileAccessToken,
  getMobileSessionUserId,
  refreshMobileAccessToken,
} from '../offline/mobileSession';
import {
  cacheApiResponse,
  readCachedApiResponse,
} from '../offline/offlineStore';

const UPLOAD_TIMEOUT_MS = 120000;

const axiosInstance = axios.create({
  baseURL: apiBaseUrl(),
  withCredentials: !isNativeApp(),
  timeout: isNativeApp() ? 12000 : 0,
});

type MobileAxiosConfig = InternalAxiosRequestConfig & {
  _mobileRetried?: boolean;
  _accountId?: string;
};

// Request interceptor: tell the backend which language to answer in. Needed for
// the requests where the server has no user to read `settings.language` from
// (login/register failures, optionalProtect routes, public pages).
axiosInstance.interceptors.request.use(async (config) => {
  config.headers['Accept-Language'] = i18n.language || DEFAULT_LANGUAGE;
  if (isNativeApp()) {
    config.withCredentials = false;
    const mobileConfig = config as MobileAxiosConfig;
    const accountId = useUserDataStore.getState().user?._id;
    if (mobileConfig._accountId && mobileConfig._accountId !== accountId)
      throw new axios.CanceledError('Account changed');
    mobileConfig._accountId = accountId;
    const token = getMobileAccessToken();
    if (token && accountId) {
      if (getMobileSessionUserId() !== accountId)
        throw new axios.CanceledError('Session changed');
      config.headers.Authorization = `Bearer ${token}`;
    }
    if (!navigator.onLine)
      throw new axios.AxiosError('Offline', 'ERR_NETWORK', config);
    // Files cannot wait in the offline queue, so give uploads time on slow networks.
    if (
      config.data instanceof FormData &&
      [...config.data.values()].some((value) => value instanceof Blob)
    )
      config.timeout = UPLOAD_TIMEOUT_MS;
  }
  return config;
});

// Variable para evitar múltiples redirects
let isRedirecting = false;

// Response interceptor para manejar tokens expirados
axiosInstance.interceptors.response.use(
  (response) => {
    const accountId = (response.config as MobileAxiosConfig)._accountId;
    if (
      isNativeApp() &&
      accountId &&
      accountId !== useUserDataStore.getState().user?._id
    )
      throw new axios.CanceledError('Account changed');
    if (
      isNativeApp() &&
      response.config.method?.toLowerCase() === 'get' &&
      !/\b(auth|api-keys|admin)\b/.test(response.config.url ?? '') &&
      (!response.config.responseType || response.config.responseType === 'json')
    ) {
      const userId = (response.config as MobileAxiosConfig)._accountId;
      if (userId && userId === useUserDataStore.getState().user?._id) {
        void cacheApiResponse(
          userId,
          axiosInstance.getUri(response.config),
          response.data,
        ).catch(() => undefined);
      }
    }
    return response;
  },
  async (error) => {
    const config = error.config as MobileAxiosConfig | undefined;
    if (
      isNativeApp() &&
      config?._accountId &&
      config._accountId !== useUserDataStore.getState().user?._id
    )
      return Promise.reject(new axios.CanceledError('Account changed'));
    if (
      isNativeApp() &&
      error.response?.status === 401 &&
      config &&
      !config._mobileRetried &&
      !config.url?.includes('/auth/mobile/')
    ) {
      config._mobileRetried = true;
      let token: string | null;
      try {
        token = await refreshMobileAccessToken();
      } catch (refreshError) {
        if (axios.isCancel(refreshError)) return Promise.reject(refreshError);
        if (!axios.isAxiosError(refreshError) || refreshError.response) {
          return Promise.reject(refreshError);
        }
        error = refreshError;
        error.config = config;
        token = null;
      }
      if (config._accountId !== useUserDataStore.getState().user?._id)
        return Promise.reject(new axios.CanceledError('Account changed'));
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
        return axiosInstance.request(config);
      }
      if (error.response) {
        await clearMobileSession();
        useUserDataStore.getState().handleTokenExpiration();
        return Promise.reject(error);
      }
    }

    if (
      isNativeApp() &&
      !error.response &&
      config?.method?.toLowerCase() === 'get'
    ) {
      const userId = config._accountId;
      if (userId && userId === useUserDataStore.getState().user?._id) {
        const data = await readCachedApiResponse(
          userId,
          axiosInstance.getUri(config),
        ).catch(() => null);
        if (data !== null) {
          return {
            data,
            status: 200,
            statusText: 'OK (offline cache)',
            headers: {},
            config,
          };
        }
      }
    }

    if (error.response?.status === 401 && !isRedirecting) {
      isRedirecting = true;

      // Usar el store de Zustand para manejar la expiración del token
      useUserDataStore.getState().handleTokenExpiration();

      // Reset flag después de un breve delay
      setTimeout(() => {
        isRedirecting = false;
      }, 1000);
    }
    return Promise.reject(error);
  },
);

export default axiosInstance;

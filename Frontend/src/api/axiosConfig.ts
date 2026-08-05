import axios from 'axios';
import i18n from '../i18n';
import { DEFAULT_LANGUAGE } from '../i18n/languages';
import { useUserDataStore } from '../store/userData';

const axiosInstance = axios.create({
  baseURL: '/api/',
  withCredentials: true,
});

// Request interceptor: tell the backend which language to answer in. Needed for
// the requests where the server has no user to read `settings.language` from
// (login/register failures, optionalProtect routes, public pages).
axiosInstance.interceptors.request.use((config) => {
  config.headers['Accept-Language'] = i18n.language || DEFAULT_LANGUAGE;
  return config;
});

// Variable para evitar múltiples redirects
let isRedirecting = false;

// Response interceptor para manejar tokens expirados
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
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
  }
);

export default axiosInstance;

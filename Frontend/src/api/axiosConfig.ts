import axios from 'axios';
import { useUserDataStore } from '../store/userData';

const axiosInstance = axios.create({
  baseURL: '/api/',
  withCredentials: true,
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

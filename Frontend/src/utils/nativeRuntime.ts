import { Capacitor } from '@capacitor/core';

export const isNativeApp = () => Capacitor.isNativePlatform();

export function isMobileApp() {
  if (isNativeApp()) return true;
  if (!import.meta.env.DEV || typeof window === 'undefined') return false;
  try {
    if (new URLSearchParams(window.location.search).get('mobilePreview') === '1')
      sessionStorage.setItem('nihongo:mobile-preview', 'true');
    return sessionStorage.getItem('nihongo:mobile-preview') === 'true';
  } catch {
    return false;
  }
}

export const apiBaseUrl = () => {
  const configured = import.meta.env.VITE_API_BASE_URL?.trim();
  if (!isNativeApp()) return '/api/';
  return configured || 'https://nihongotracker.app/api/';
};

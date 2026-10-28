import { useEffect } from 'react';
import type { NavigateFunction } from 'react-router-dom';
import { PushNotifications } from '@capacitor/push-notifications';
import api from '../api/axiosConfig';
import queryClient from '../queryClient';
import { isNativeApp } from '../utils/nativeRuntime';

/** The build enables push only when the Android project has `google-services.json`. */
const PUSH_ENABLED = import.meta.env.VITE_PUSH_ENABLED === 'true';

/** Accept only in-app paths so a push message cannot open another origin. */
function pushRoute(link: unknown) {
  if (typeof link !== 'string' || !link.startsWith('/') || link.startsWith('//'))
    return null;
  return link;
}

/**
 * Register the device for push messages while an account is signed in.
 * The backend stores the token on the mobile session, so logout stops delivery.
 */
export function useNativePush(
  accountId: string | undefined,
  navigate: NavigateFunction,
) {
  useEffect(() => {
    if (!isNativeApp() || !accountId || !PUSH_ENABLED) return undefined;
    let active = true;
    const listeners = [
      PushNotifications.addListener('registration', ({ value }) => {
        if (!active) return;
        void api
          .put('auth/mobile/push-token', { token: value })
          .catch(() => undefined);
      }),
      PushNotifications.addListener('pushNotificationReceived', () => {
        void queryClient.invalidateQueries({ queryKey: ['notifications'] });
      }),
      PushNotifications.addListener(
        'pushNotificationActionPerformed',
        ({ notification }) => {
          const route = pushRoute(notification.data?.link);
          navigate(route ?? '/notifications');
        },
      ),
    ];

    void (async () => {
      let permission = await PushNotifications.checkPermissions();
      if (permission.receive === 'prompt')
        permission = await PushNotifications.requestPermissions();
      if (!active || permission.receive !== 'granted') return;
      await PushNotifications.createChannel({
        id: 'default',
        name: 'NihongoTracker',
        importance: 4,
      }).catch(() => undefined);
      await PushNotifications.register();
    })().catch(() => undefined);

    return () => {
      active = false;
      listeners.forEach(
        (listener) => void listener.then((handle) => handle.remove()),
      );
    };
  }, [accountId, navigate]);
}

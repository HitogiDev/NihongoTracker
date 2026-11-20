import { useEffect } from 'react';
import type { NavigateFunction } from 'react-router-dom';
import { PushNotifications } from '@capacitor/push-notifications';
import { create } from 'zustand';
import api from '../api/axiosConfig';
import queryClient from '../queryClient';
import { isNativeApp } from '../utils/nativeRuntime';

/** The build enables push only when the Android project has `google-services.json`. */
const PUSH_ENABLED = import.meta.env.VITE_PUSH_ENABLED === 'true';
const DISMISS_KEY = 'nihongo:native:push-prompt-dismissed';

/**
 * `prompt` means Android can still ask the user.
 * The app asks only from `NativePushPrompt`, after it explains the benefit.
 * Android does not show the system dialog again after a refusal.
 */
export const usePushPermissionStore = create<{
  status: 'unknown' | 'prompt' | 'granted' | 'denied';
}>(() => ({ status: 'unknown' }));

/** Accept only in-app paths so a push message cannot open another origin. */
function pushRoute(link: unknown) {
  if (typeof link !== 'string' || !link.startsWith('/') || link.startsWith('//'))
    return null;
  return link;
}

async function registerDevice() {
  await PushNotifications.createChannel({
    id: 'default',
    name: 'NihongoTracker',
    importance: 4,
  }).catch(() => undefined);
  await PushNotifications.register();
}

/** Show the system permission dialog, then register when the user allows it. */
export async function requestPushPermission() {
  const permission = await PushNotifications.requestPermissions();
  const granted = permission.receive === 'granted';
  usePushPermissionStore.setState({ status: granted ? 'granted' : 'denied' });
  if (granted) await registerDevice();
  return granted;
}

export function isPushPromptDismissed(accountId: string) {
  try {
    return localStorage.getItem(`${DISMISS_KEY}:${accountId}`) === 'true';
  } catch {
    return false;
  }
}

export function dismissPushPrompt(accountId: string) {
  try {
    localStorage.setItem(`${DISMISS_KEY}:${accountId}`, 'true');
  } catch {
    // The card returns on the next launch. That is acceptable.
  }
  usePushPermissionStore.setState({ status: 'denied' });
}

/**
 * Register the device for push messages while an account is signed in.
 * The backend stores the token on the mobile session, so logout stops delivery.
 * The hook registers only when the user already gave permission.
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
      const permission = await PushNotifications.checkPermissions();
      if (!active) return;
      if (permission.receive === 'granted') {
        usePushPermissionStore.setState({ status: 'granted' });
        await registerDevice();
      } else if (
        permission.receive.startsWith('prompt') &&
        !isPushPromptDismissed(accountId)
      ) {
        usePushPermissionStore.setState({ status: 'prompt' });
      } else {
        usePushPermissionStore.setState({ status: 'denied' });
      }
    })().catch(() => undefined);

    return () => {
      active = false;
      usePushPermissionStore.setState({ status: 'unknown' });
      listeners.forEach(
        (listener) => void listener.then((handle) => handle.remove()),
      );
    };
  }, [accountId, navigate]);
}

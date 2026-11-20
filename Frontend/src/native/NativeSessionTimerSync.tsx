import { useEffect } from 'react';
import { App } from '@capacitor/app';
import { useUserDataStore } from '../store/userData';
import { refreshSessionTimer, syncSessionTimer } from '../store/sessionTimer';
import { onSessionChange } from './sessionTimer';
import { useSessionLabels } from './useStartSession';
import { isNativeApp } from '../utils/nativeRuntime';

/**
 * Keep the session timer store aligned with the native state.
 * Notification actions change the native state while the app is open or closed.
 */
export default function NativeSessionTimerSync() {
  const userId = useUserDataStore((store) => store.user?._id);
  const labels = useSessionLabels();

  useEffect(() => {
    void syncSessionTimer(userId);
    const stop = onSessionChange(() => void syncSessionTimer(userId));
    if (!isNativeApp()) return stop;
    const handle = App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) void syncSessionTimer(userId);
    });
    return () => {
      stop();
      void handle.then((listener) => listener.remove());
    };
  }, [userId]);

  // Show the notification again after a reboot, and update its language.
  useEffect(() => {
    if (!userId) return;
    void refreshSessionTimer(labels).then(() => syncSessionTimer(userId));
  }, [labels, userId]);

  return null;
}

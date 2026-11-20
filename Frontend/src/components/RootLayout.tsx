import { Outlet } from 'react-router-dom';
import AchievementRevealHost from './achievements/AchievementRevealHost';
import LanguageSync from './LanguageSync';
import LogCelebrationHost from './LogCelebrationHost';
import OfflineSyncStatus from './OfflineSyncStatus';
import { ConfirmDialogHost } from './ui/ConfirmDialog';
import NativeAppLifecycle from './NativeAppLifecycle';
import NativeWidgetSync from '../native/NativeWidgetSync';
import NativeSessionTimerSync from '../native/NativeSessionTimerSync';
import { isMobileApp, isNativeApp } from '../utils/nativeRuntime';

/**
 * Outermost layout: sits above both the texthooker routes and the main
 * <App> shell so the log celebration and achievement reveal can fire from
 * anywhere in the app.
 */
export default function RootLayout() {
  return (
    <>
      <LanguageSync />
      <LogCelebrationHost />
      <AchievementRevealHost />
      <OfflineSyncStatus />
      <ConfirmDialogHost />
      <NativeAppLifecycle />
      {isNativeApp() && <NativeWidgetSync />}
      {isMobileApp() && <NativeSessionTimerSync />}
      <Outlet />
    </>
  );
}

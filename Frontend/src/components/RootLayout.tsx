import { Outlet } from 'react-router-dom';
import AchievementRevealHost from './achievements/AchievementRevealHost';
import LanguageSync from './LanguageSync';
import LogCelebrationHost from './LogCelebrationHost';

/**
 * Outermost layout — sits above both the texthooker routes and the main
 * <App> shell so the log celebration and achievement reveal can fire from
 * anywhere in the app.
 */
export default function RootLayout() {
  return (
    <>
      <LanguageSync />
      <LogCelebrationHost />
      <AchievementRevealHost />
      <Outlet />
    </>
  );
}

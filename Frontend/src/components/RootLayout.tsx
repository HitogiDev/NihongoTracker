import { Outlet } from 'react-router-dom';
import AchievementRevealHost from './achievements/AchievementRevealHost';
import LogCelebrationHost from './LogCelebrationHost';

/**
 * Outermost layout — sits above both the texthooker routes and the main
 * <App> shell so the log celebration and achievement reveal can fire from
 * anywhere in the app.
 */
export default function RootLayout() {
  return (
    <>
      <LogCelebrationHost />
      <AchievementRevealHost />
      <Outlet />
    </>
  );
}

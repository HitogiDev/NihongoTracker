import './index.css';
import '@fontsource/roboto/300.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';
import 'react-image-crop/dist/ReactCrop.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import {
  createBrowserRouter,
  createRoutesFromElements,
  Route,
  RouterProvider,
} from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { TimezoneProvider } from './contexts/TimezoneContext.tsx';
import AboutScreen from './screens/AboutScreen.tsx';
import App from './App.tsx';
import CalculatorScreen from './screens/CalculatorScreen.tsx';
import FeaturesScreen from './screens/FeaturesScreen.tsx';
import HomeScreen from './screens/HomeScreen.tsx';
import ListScreen from './screens/ListScreen.tsx';
import LoginScreen from './screens/LoginScreen.tsx';
import LogScreen from './screens/LogScreen.tsx';
import MatchMedia from './screens/MatchMedia.tsx';
import MediaDetails from './screens/MediaDetails.tsx';
import MediaHeader from './components/MediaHeader.tsx';
import NotFound from './screens/NotFound.tsx';
import ProfileHeader from './components/ProfileHeader.tsx';
import ProfileScreen from './screens/ProfileScreen.tsx';
import ProtectedRoutes from './contexts/protectedRoute.tsx';
import queryClient from './queryClient.ts';
import RankingScreen from './screens/RankingScreen.tsx';
// import RegisterScreen from './screens/RegisterScreen.tsx';
import SettingsScreen from './screens/SettingsScreen.tsx';
import SharedLogScreen from './screens/SharedLogScreen.tsx';
import StatsScreen from './screens/StatsScreen.tsx';
import MediaSocial from './screens/MediaSocial.tsx';
import AdminScreen from './screens/AdminScreen.tsx';
import ClubsScreen from './screens/ClubsScreen.tsx';
import CreateClubScreen from './screens/CreateClubScreen.tsx';
import ClubDetailScreen from './screens/ClubDetailScreen.tsx';
import ClubMediaHeader from './components/club/ClubMediaHeader.tsx';
import ClubMediaInfo from './screens/ClubMediaInfo.tsx';
import ClubMediaActivity from './screens/ClubMediaActivity.tsx';
import ClubMediaReviews from './screens/ClubMediaReviews.tsx';
import ClubMediaRankings from './screens/ClubMediaRankings.tsx';
import GoalsScreen from './screens/GoalsScreen.tsx';
import SupportScreen from './screens/SupportScreen.tsx';
import PrivacyPolicyScreen from './screens/PrivacyPolicyScreen.tsx';
import TermsOfServiceScreen from './screens/TermsOfServiceScreen.tsx';
import ChangelogScreen from './screens/ChangelogScreen.tsx';
import ForgotPasswordScreen from './screens/ForgotPasswordScreen.tsx';
import ResetPasswordScreen from './screens/ResetPasswordScreen.tsx';
import VerifyEmailScreen from './screens/VerifyEmailScreen.tsx';

const router = createBrowserRouter(
  createRoutesFromElements(
    <Route path="/" element={<App />}>
      <Route index={true} path="/" element={<HomeScreen />} />
      <Route path="login" element={<LoginScreen />} />
      {/* <Route path="register" element={<RegisterScreen />} /> */}
      <Route path="forgot-password" element={<ForgotPasswordScreen />} />
      <Route path="reset-password/:token" element={<ResetPasswordScreen />} />
      <Route path="verify-email/:token" element={<VerifyEmailScreen />} />
      <Route path="settings" element={<SettingsScreen />} />
      <Route path="ranking" element={<RankingScreen />} />
      <Route path="clubs" element={<ClubsScreen />} />
      <Route path="clubs/create" element={<CreateClubScreen />} />
      <Route path="clubs/:clubId" element={<ClubDetailScreen />} />
      <Route path="clubs/:clubId/media/:mediaId" element={<ClubMediaHeader />}>
        <Route index element={<ClubMediaInfo />} />
        <Route path="activity" element={<ClubMediaActivity />} />
        <Route path="reviews" element={<ClubMediaReviews />} />
        <Route path="rankings" element={<ClubMediaRankings />} />
      </Route>
      <Route path="calculator" element={<CalculatorScreen />} />
      <Route path="features" element={<FeaturesScreen />} />
      <Route path="about" element={<AboutScreen />} />
      <Route path="support" element={<SupportScreen />} />
      <Route path="privacy" element={<PrivacyPolicyScreen />} />
      <Route path="terms" element={<TermsOfServiceScreen />} />
      <Route path="changelog" element={<ChangelogScreen />} />
      <Route path="admin" element={<AdminScreen />} />
      <Route path="/shared-log/:logId" element={<SharedLogScreen />} />
      <Route path="user/:username" element={<ProfileHeader />}>
        <Route index element={<ProfileScreen />} />
        <Route path="stats" element={<StatsScreen />} />
        <Route path="list" element={<ListScreen />} />
        <Route path="goals" element={<GoalsScreen />} />
      </Route>
      <Route element={<ProtectedRoutes />}>
        <Route index path="createlog" element={<LogScreen />} />
        <Route path="matchmedia" element={<MatchMedia />} />
      </Route>
      <Route path=":mediaType/:mediaId/:username?" element={<MediaHeader />}>
        <Route index element={<MediaDetails />} />
        <Route path="social" element={<MediaSocial />} />
      </Route>
      <Route path="404" element={<NotFound />} />
      <Route path="*" element={<NotFound />} />
    </Route>
  )
);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <TimezoneProvider>
        <RouterProvider router={router} />
      </TimezoneProvider>
    </QueryClientProvider>
  </React.StrictMode>
);

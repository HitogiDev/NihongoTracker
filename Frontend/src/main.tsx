import './index.css';
import '@fontsource/roboto/300.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';
import 'react-image-crop/dist/ReactCrop.css';
import React, { Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
import {
  createBrowserRouter,
  createRoutesFromElements,
  Route,
  RouterProvider,
} from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { TimezoneProvider } from './contexts/TimezoneContext.tsx';
import queryClient from './queryClient.ts';

const App = lazy(() => import('./App.tsx'));
const CalculatorScreen = lazy(() => import('./screens/CalculatorScreen.tsx'));
const FeaturesScreen = lazy(() => import('./screens/FeaturesScreen.tsx'));
const HomeScreen = lazy(() => import('./screens/HomeScreen.tsx'));
const ListScreen = lazy(() => import('./screens/ListScreen.tsx'));
const LoginScreen = lazy(() => import('./screens/LoginScreen.tsx'));
const LogScreen = lazy(() => import('./screens/LogScreen.tsx'));
const MatchMedia = lazy(() => import('./screens/MatchMedia.tsx'));
const MediaDetails = lazy(() => import('./screens/MediaDetails.tsx'));
const MediaHeader = lazy(() => import('./components/MediaHeader.tsx'));
const NotFound = lazy(() => import('./screens/NotFound.tsx'));
const ProfileHeader = lazy(() => import('./components/ProfileHeader.tsx'));
const ProfileScreen = lazy(() => import('./screens/ProfileScreen.tsx'));
const ProtectedRoutes = lazy(() => import('./contexts/protectedRoute.tsx'));
const RankingScreen = lazy(() => import('./screens/RankingScreen.tsx'));
const RegisterScreen = lazy(() => import('./screens/RegisterScreen.tsx'));
const SettingsScreen = lazy(() => import('./screens/SettingsScreen.tsx'));
const SharedLogScreen = lazy(() => import('./screens/SharedLogScreen.tsx'));
const StatsScreen = lazy(() => import('./screens/StatsScreen.tsx'));
const TextHooker = lazy(() => import('./screens/HookerScreen.tsx'));
const MediaSocial = lazy(() => import('./screens/MediaSocial.tsx'));
const MediaReviews = lazy(() => import('./screens/MediaReviews.tsx'));
const MediaWriteReview = lazy(() => import('./screens/MediaWriteReview.tsx'));
const ReviewDetailScreen = lazy(
  () => import('./screens/ReviewDetailScreen.tsx')
);
const AdminScreen = lazy(() => import('./screens/AdminScreen.tsx'));
const ClubsScreen = lazy(() => import('./screens/ClubsScreen.tsx'));
const CreateClubScreen = lazy(() => import('./screens/CreateClubScreen.tsx'));
const ClubDetailScreen = lazy(() => import('./screens/ClubDetailScreen.tsx'));
const ClubMediaHeader = lazy(
  () => import('./components/club/ClubMediaHeader.tsx')
);
const ClubMediaInfo = lazy(() => import('./screens/ClubMediaInfo.tsx'));
const ClubMediaActivity = lazy(() => import('./screens/ClubMediaActivity.tsx'));
const ClubMediaRankings = lazy(() => import('./screens/ClubMediaRankings.tsx'));
const GoalsScreen = lazy(() => import('./screens/GoalsScreen.tsx'));
const SupportScreen = lazy(() => import('./screens/SupportScreen.tsx'));
const PrivacyPolicyScreen = lazy(
  () => import('./screens/PrivacyPolicyScreen.tsx')
);
const TermsOfServiceScreen = lazy(
  () => import('./screens/TermsOfServiceScreen.tsx')
);
const RefundPolicyScreen = lazy(
  () => import('./screens/RefundPolicyScreen.tsx')
);
const ChangelogScreen = lazy(() => import('./screens/ChangelogScreen.tsx'));
const ForgotPasswordScreen = lazy(
  () => import('./screens/ForgotPasswordScreen.tsx')
);
const ResetPasswordScreen = lazy(
  () => import('./screens/ResetPasswordScreen.tsx')
);
const VerifyEmailScreen = lazy(() => import('./screens/VerifyEmailScreen.tsx'));
const TextHookerDashboard = lazy(
  () => import('./screens/TextHookerDashboard.tsx')
);
const ProfileModerationScreen = lazy(
  () => import('./screens/ProfileModerationScreen.tsx')
);

const router = createBrowserRouter(
  createRoutesFromElements(
    <Route path="/">
      <Route element={<ProtectedRoutes />}>
        <Route path=":mediaType/:mediaId/texthooker" element={<TextHooker />} />
        <Route path="texthooker/:contentId" element={<TextHooker />} />
        <Route path="texthooker/session" element={<TextHooker />} />
      </Route>
      <Route path="/" element={<App />}>
        <Route index={true} path="/" element={<HomeScreen />} />
        <Route path="login" element={<LoginScreen />} />
        <Route path="register" element={<RegisterScreen />} />
        <Route path="forgot-password" element={<ForgotPasswordScreen />} />
        <Route path="reset-password/:token" element={<ResetPasswordScreen />} />
        <Route path="verify-email/:token" element={<VerifyEmailScreen />} />
        <Route path="settings" element={<SettingsScreen />} />
        <Route path="ranking" element={<RankingScreen />} />
        <Route path="clubs" element={<ClubsScreen />} />
        <Route path="clubs/create" element={<CreateClubScreen />} />
        <Route path="clubs/:clubId" element={<ClubDetailScreen />} />
        <Route
          path="clubs/:clubId/media/:mediaId"
          element={<ClubMediaHeader />}
        >
          <Route index element={<ClubMediaInfo />} />
          <Route path="activity" element={<ClubMediaActivity />} />
          <Route path="rankings" element={<ClubMediaRankings />} />
        </Route>
        <Route path="calculator" element={<CalculatorScreen />} />
        <Route path="features" element={<FeaturesScreen />} />
        <Route path="pricing" element={<SupportScreen />} />
        <Route path="privacy" element={<PrivacyPolicyScreen />} />
        <Route path="terms" element={<TermsOfServiceScreen />} />
        <Route path="refund-policy" element={<RefundPolicyScreen />} />
        <Route path="changelog" element={<ChangelogScreen />} />
        <Route path="texthooker" element={<TextHookerDashboard />} />
        <Route path="admin" element={<AdminScreen />} />
        <Route path="/shared-log/:logId" element={<SharedLogScreen />} />
        <Route path="user/:username" element={<ProfileHeader />}>
          <Route index element={<ProfileScreen />} />
          <Route path="stats" element={<StatsScreen />} />
          <Route path="list" element={<ListScreen />} />
          <Route path="goals" element={<GoalsScreen />} />
          <Route path="moderation" element={<ProfileModerationScreen />} />
        </Route>
        <Route path="review/:reviewId" element={<ReviewDetailScreen />} />
        <Route element={<ProtectedRoutes />}>
          <Route index path="log" element={<LogScreen />} />
          <Route path="matchmedia" element={<MatchMedia />} />
          <Route
            path=":mediaType/:mediaId/texthooker"
            element={<TextHooker />}
          />
          <Route path="texthooker/session" element={<TextHooker />} />
        </Route>
        <Route path=":mediaType/:mediaId/:username?" element={<MediaHeader />}>
          <Route index element={<MediaDetails />} />
          <Route path="reviews" element={<MediaReviews />} />
          <Route path="reviews/write" element={<MediaWriteReview />} />
          <Route path="social" element={<MediaSocial />} />
        </Route>
        <Route path="404" element={<NotFound />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Route>
  )
);

// Global click handler for Discord-style spoilers (click to reveal/hide)
document.addEventListener('click', (e) => {
  const target = (e.target as HTMLElement).closest('.spoiler');
  if (target) {
    target.classList.toggle('revealed');
  }
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <TimezoneProvider>
        <Suspense
          fallback={
            <div className="min-h-screen bg-base-200 flex items-center justify-center">
              <span className="loading loading-spinner loading-lg text-primary"></span>
            </div>
          }
        >
          <RouterProvider router={router} />
        </Suspense>
      </TimezoneProvider>
    </QueryClientProvider>
  </React.StrictMode>
);

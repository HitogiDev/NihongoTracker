import ProfileNavbar from './ProfileNavbar';
import { useTranslation } from 'react-i18next';
import {
  getApiErrorMessage,
  isPrivateProfileError,
} from '../utils/apiError';
import ShareStatsModal from './ShareStatsModal';
import { useEffect, useState } from 'react';
import { Link, Outlet, useNavigate, useParams } from 'react-router-dom';
import {
  Handshake,
  Heart,
  Inbox,
  Lock,
  Share2,
  UserRoundCheck,
  UserRoundPlus,
} from 'lucide-react';
import {
  followUserFn,
  getUserFn,
  unfollowUserFn,
} from '../api/trackerApi';
import { AxiosError } from 'axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { OutletProfileContextType } from '../types';
import { getPatreonBadgeProps } from '../utils/patreonBadge';
import { usePatreonBadgeText } from '../hooks/usePatreonBadgeText';
import { getAvatarInitials } from '../utils/avatar';
import {
  getAvatarFrameClass,
  getNameEffectRender,
  getProfileAccentStyle,
  getSignatureStatValue,
  hasAvatarFrame,
} from '../utils/customization';
import { getAchievementName } from '../utils/achievementText';
import BannerEffectOverlay from './BannerEffectOverlay';
import { useUserDataStore } from '../store/userData';
import Spinner from './ui/Spinner';

function PrivateProfileNotice({ username }: { username: string }) {
  const { t } = useTranslation('profile');

  return (
    <main className="flex min-h-[calc(100vh-5rem)] items-center justify-center bg-base-200 px-4 pb-16 pt-28">
      <div className="card surface w-full max-w-xl">
        <div className="card-body items-center gap-4 p-8 text-center sm:p-12">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Lock className="h-8 w-8" aria-hidden="true" />
          </div>
          <h1 className="card-title text-2xl">
            {t('privateProfile.title')}
          </h1>
          <p className="max-w-md text-base-content/80">
            {t('privateProfile.description', { username })}
          </p>
          <p className="max-w-md text-sm text-base-content/60">
            {t('privateProfile.hint')}
          </p>
          <Link to="/" className="btn btn-primary mt-2">
            {t('privateProfile.backHome')}
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function ProfileHeader() {
  const { t } = useTranslation('profile');
  const badgeText = usePatreonBadgeText();
  const { username = '' } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentUser = useUserDataStore((state) => state.user);
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const {
    data: user,
    error: userError,
    isLoading: isLoadingUser,
  } = useQuery({
    queryKey: ['user', username],
    queryFn: () => getUserFn(username as string),
    staleTime: Infinity,
  });
  const isPrivateProfile = isPrivateProfileError(userError);

  useEffect(() => {
    if (!userError || isPrivateProfile) return;

    if (userError instanceof AxiosError && userError.response?.status === 404) {
      navigate('/404', { replace: true });
      return;
    }

    toast.error(getApiErrorMessage(userError));
  }, [isPrivateProfile, navigate, userError]);

  const patreonBadge = getPatreonBadgeProps(user?.patreon);
  const customization = user?.customization;
  const nameEffect = getNameEffectRender(customization);
  const equippedTitle = customization?.equippedTitle
    ? getAchievementName({ key: customization.equippedTitle })
    : '';
  const signatureStat = getSignatureStatValue(
    user?.signature?.stat,
    user?.signature?.value
  );
  const isOwnProfile = currentUser?.username === user?.username;
  const followMutation = useMutation({
    mutationFn: () =>
      user?.social?.isFollowing
        ? unfollowUserFn(username)
        : followUserFn(username),
    onSuccess: ({ relationship }) => {
      queryClient.setQueryData(['user', username], (previous: typeof user) =>
        previous ? { ...previous, social: relationship } : previous
      );
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  useEffect(() => {
    setAvatarLoadFailed(false);
  }, [user?.avatar]);

  if (isPrivateProfile) {
    return <PrivateProfileNotice username={username} />;
  }

  return (
    // The owner's accent is set here, on the wrapper around the header *and*
    // the profile <Outlet>, so every child component inside the profile picks
    // it up through DaisyUI's color variables — and nothing outside does.
    <div
      className="flex flex-col justify-center bg-base-200 text-base-content"
      style={getProfileAccentStyle(customization)}
    >
      <div
        className={`relative h-96 w-full bg-cover bg-center bg-no-repeat ${
          isLoadingUser ? 'skeleton' : ''
        }`}
        style={{
          backgroundImage: `url(${!isLoadingUser ? user?.banner : ''})`,
        }}
      >
        {!isLoadingUser && (
          <BannerEffectOverlay
            effect={customization?.bannerEffect}
            seed={user?.username ?? 'banner'}
          />
        )}
        {/* z-[1] ties with the particle overlay, and later siblings win: the
            avatar and name stay above the ambient effect. */}
        <div className="relative z-[1] flex flex-col justify-end size-full bg-linear-to-t from-shadow/[0.6] to-40% bg-cover">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-end min-w-80 px-5 2xl:max-w-(--breakpoint-2xl) 2xl:px-24 mx-auto w-full mb-2">
            <div className="mb-2 sm:mb-0">
              {isLoadingUser ? (
                <div className="skeleton h-24 w-24 shrink-0 rounded-full"></div>
              ) : (
                <div
                  className={
                    hasAvatarFrame(customization?.avatarFrame)
                      ? `w-24 h-24 ${getAvatarFrameClass(customization?.avatarFrame)}`
                      : undefined
                  }
                >
                  <div className="avatar">
                    <div className={`${hasAvatarFrame(customization?.avatarFrame) ? 'w-full h-full' : 'w-24'} rounded-full`}>
                      {user?.avatar && !avatarLoadFailed ? (
                        <img
                          src={user.avatar}
                          alt={t('header.avatarAlt', {
                            username: user.username ?? '',
                          })}
                          onError={() => setAvatarLoadFailed(true)}
                        />
                      ) : (
                        <div className="w-full h-full bg-base-300 flex items-center justify-center text-xl font-semibold">
                          {getAvatarInitials(user?.username)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="py-22px px-25px w-full sm:w-auto text-center sm:text-left">
              <div className="flex flex-col items-center gap-2 flex-wrap sm:flex-row sm:items-center sm:gap-3">
                <h1
                  className={`text-xl font-bold inline-block text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.7)] ${nameEffect.className}`}
                  style={nameEffect.style}
                >
                  {user?.username}
                </h1>
                {equippedTitle && (
                  <span className="badge badge-outline badge-sm border-white/40 bg-black/30 text-white backdrop-blur-sm">
                    {equippedTitle}
                  </span>
                )}
                {patreonBadge && (
                  <div
                    className={`badge badge-sm gap-1.5 shadow-sm ${patreonBadge.colorClass}`}
                    style={patreonBadge.style}
                  >
                    <Heart className="h-3 w-3 fill-current" />
                    <span className="font-bold">{badgeText(patreonBadge)}</span>
                  </div>
                )}
              </div>
              {signatureStat && (
                <p className="mt-1 text-sm text-white/80 drop-shadow-[0_2px_4px_rgba(0,0,0,0.7)]">
                  {t(signatureStat.labelKey, {
                    value: signatureStat.decimal
                      ? signatureStat.value.toFixed(1)
                      : signatureStat.value.toLocaleString(),
                  })}
                </p>
              )}
              {!isLoadingUser && user?.social && (
                <div className="mt-2 flex items-center justify-center gap-4 text-sm text-white/90 sm:justify-start">
                  <Link
                    to={`/user/${encodeURIComponent(user.username)}/followers`}
                    className="link link-hover"
                  >
                    <span className="font-semibold">
                      {user.social.followerCount.toLocaleString()}
                    </span>{' '}
                    {t('social.followers')}
                  </Link>
                  <Link
                    to={`/user/${encodeURIComponent(user.username)}/following`}
                    className="link link-hover"
                  >
                    <span className="font-semibold">
                      {user.social.followingCount.toLocaleString()}
                    </span>{' '}
                    {t('social.following')}
                  </Link>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 sm:ml-auto sm:mb-2">
              {currentUser && isOwnProfile && (
                <Link
                  to="/recommendations"
                  className="btn btn-sm gap-2 bg-base-100/95 text-base-content shadow-sm backdrop-blur-sm hover:bg-base-100"
                >
                  <Inbox className="h-4 w-4" />
                  {t('social.recommendations')}
                </Link>
              )}
              {currentUser && !isOwnProfile && user && (
                <button
                  type="button"
                  onClick={() => followMutation.mutate()}
                  className={`btn btn-sm gap-2 shadow-sm backdrop-blur-sm ${
                    user.social?.isFollowing
                      ? 'bg-base-100/95 text-base-content hover:bg-base-100'
                      : 'btn-primary'
                  }`}
                  disabled={followMutation.isPending}
                >
                  {followMutation.isPending ? (
                    <Spinner size="sm" />
                  ) : user.social?.isFollowing ? (
                    user.social.mutualFollow ? (
                      <Handshake className="h-4 w-4" />
                    ) : (
                      <UserRoundCheck className="h-4 w-4" />
                    )
                  ) : (
                    <UserRoundPlus className="h-4 w-4" />
                  )}
                  {user.social?.isFollowing
                    ? user.social.mutualFollow
                      ? t('social.friends')
                      : t('social.followingLabel')
                    : t('social.follow')}
                </button>
              )}
              {currentUser && isOwnProfile && user?.socialAccess?.statistics !== false && (
                <button
                  type="button"
                  onClick={() => setShareOpen(true)}
                  className="btn btn-sm gap-2 bg-black/30 hover:bg-black/50 border-white/20 text-white backdrop-blur-sm"
                  title={t('header.shareStatsTitle')}
                >
                  <Share2 className="h-4 w-4" />
                  {t('header.shareStats')}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      {username && (
        <ShareStatsModal
          username={username}
          open={shareOpen}
          onClose={() => setShareOpen(false)}
        />
      )}
      <ProfileNavbar
        username={user?.username}
        canViewStatistics={user?.socialAccess?.statistics}
        canViewImmersionActivity={user?.socialAccess?.immersionActivity}
      />
      <Outlet context={{ user, username } satisfies OutletProfileContextType} />
    </div>
  );
}

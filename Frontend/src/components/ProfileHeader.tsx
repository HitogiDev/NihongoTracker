import ProfileNavbar from './ProfileNavbar';
import { useTranslation } from 'react-i18next';
import { getApiErrorMessage } from '../utils/apiError';
import ShareStatsModal from './ShareStatsModal';
import { useEffect, useState } from 'react';
import { Outlet, useNavigate, useParams } from 'react-router-dom';
import { Share2 } from 'lucide-react';
import { getUserFn } from '../api/trackerApi';
import { AxiosError } from 'axios';
import { useQuery } from '@tanstack/react-query';
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

export default function ProfileHeader() {
  const { t } = useTranslation('profile');
  const badgeText = usePatreonBadgeText();
  const { username = '' } = useParams<{ username: string }>();
  const navigate = useNavigate();
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

  if (userError) {
    if (userError instanceof AxiosError) {
      if (userError.status === 404) navigate('/404', { replace: true });
      toast.error(userError.response?.data.message);
    } else {
      toast.error(getApiErrorMessage(userError));
    }
  }

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

  useEffect(() => {
    setAvatarLoadFailed(false);
  }, [user?.avatar]);

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
                      ? getAvatarFrameClass(customization?.avatarFrame)
                      : undefined
                  }
                >
                  <div className="avatar">
                    <div className="w-24 rounded-full">
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
                    className={`badge gap-2 ${patreonBadge.colorClass}`}
                    style={patreonBadge.style}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"
                        clipRule="evenodd"
                      />
                    </svg>
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
            </div>
            {username && (
              <button
                type="button"
                onClick={() => setShareOpen(true)}
                className="btn btn-sm gap-2 sm:ml-auto sm:mb-2 bg-black/30 hover:bg-black/50 border-white/20 text-white backdrop-blur-sm"
                title={t('header.shareStatsTitle')}
              >
                <Share2 className="h-4 w-4" />
                {t('header.shareStats')}
              </button>
            )}
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
      <ProfileNavbar username={user?.username} />
      <Outlet context={{ user, username } satisfies OutletProfileContextType} />
    </div>
  );
}

import ProfileNavbar from './ProfileNavbar';
import { Outlet, useNavigate, useParams } from 'react-router-dom';
import { getUserFn } from '../api/trackerApi';
import { AxiosError } from 'axios';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { OutletProfileContextType } from '../types';

export default function ProfileHeader() {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();

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
      toast.error(userError.message ? userError.message : 'An error occurred');
    }
  }

  return (
    <div className="flex flex-col justify-center bg-base-200 text-base-content">
      <div
        className={`h-96 w-full bg-cover bg-center bg-no-repeat ${
          isLoadingUser ? 'skeleton' : ''
        }`}
        style={{
          backgroundImage: `url(${!isLoadingUser ? user?.banner : ''})`,
        }}
      >
        <div className="flex flex-col justify-end size-full bg-linear-to-t from-shadow/[0.6] to-40% bg-cover">
          <div className="flex items-end min-w-80 px-5 2xl:max-w-(--breakpoint-2xl) 2xl:px-24 mx-auto w-full mb-2">
            {isLoadingUser ? (
              <div className="skeleton h-24 w-24 shrink-0 rounded-full"></div>
            ) : (
              <div className="avatar">
                <div className="w-24 rounded-full">
                  <img src={user?.avatar ? user.avatar : ''} />
                </div>
              </div>
            )}
            <div className="py-22px px-25px">
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold inline-block text-slate-100">
                  {user?.username}
                </h1>
                {user?.patreon?.isActive && user?.patreon?.tier && (
                  <div
                    className={`badge gap-2 ${
                      user.patreon.tier === 'consumer' &&
                      user.patreon.badgeColor
                        ? user.patreon.badgeColor === 'rainbow'
                          ? 'badge-rainbow'
                          : user.patreon.badgeColor === 'primary'
                            ? 'badge-primary'
                            : user.patreon.badgeColor === 'secondary'
                              ? 'badge-secondary'
                              : ''
                        : 'badge-primary'
                    }`}
                    style={
                      user.patreon.tier === 'consumer' &&
                      user.patreon.badgeColor &&
                      user.patreon.badgeColor !== 'rainbow' &&
                      user.patreon.badgeColor !== 'primary' &&
                      user.patreon.badgeColor !== 'secondary'
                        ? {
                            backgroundColor: user.patreon.badgeColor,
                            color:
                              user.patreon.badgeTextColor ===
                                'primary-content' ||
                              user.patreon.badgeTextColor ===
                                'secondary-content'
                                ? undefined
                                : user.patreon.badgeTextColor || '#ffffff',
                            border: 'none',
                          }
                        : user.patreon.tier === 'consumer' &&
                            (user.patreon.badgeColor === 'rainbow' ||
                              user.patreon.badgeTextColor)
                          ? {
                              color:
                                user.patreon.badgeTextColor ===
                                  'primary-content' ||
                                user.patreon.badgeTextColor ===
                                  'secondary-content'
                                  ? undefined
                                  : user.patreon.badgeTextColor || undefined,
                              border:
                                user.patreon.badgeColor === 'rainbow'
                                  ? 'none'
                                  : undefined,
                            }
                          : {}
                    }
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
                    {/* Show custom badge text for Enthusiast+ tier, otherwise show tier name */}
                    <span className="font-bold">
                      {(user.patreon.tier === 'enthusiast' ||
                        user.patreon.tier === 'consumer') &&
                      user.patreon.customBadgeText
                        ? user.patreon.customBadgeText
                        : user.patreon.tier === 'donator'
                          ? 'Donator'
                          : user.patreon.tier === 'enthusiast'
                            ? 'Enthusiast'
                            : 'Consumer'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      <ProfileNavbar username={user?.username} />
      <Outlet context={{ user, username } satisfies OutletProfileContextType} />
    </div>
  );
}

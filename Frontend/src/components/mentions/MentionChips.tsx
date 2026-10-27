import { useQuery } from '@tanstack/react-query';
import type { MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { getMediaFn, getUserFn } from '../../api/trackerApi';
import { useUserDataStore } from '../../store/userData';
import type { IMediaDocument } from '../../types';
import { getMediaDisplayTitle } from '../../utils/mediaTitle';
import {
  MENTION_MEDIA_TYPE_LABEL_KEYS,
  type MentionableMediaType,
} from '../../utils/markdown';
import UserAvatar from '../UserAvatar';
import OfflineImage from '../OfflineImage';

export type MentionVariant = 'inline' | 'card';

const MENTION_STALE_TIME = 5 * 60 * 1000;

/** Keep a click on a mention from also activating a clickable parent card. */
function stopPropagation(event: MouseEvent) {
  event.stopPropagation();
}

const INLINE_CHIP =
  'not-prose mention-chip inline-flex max-w-full items-center gap-1.5 rounded-full align-middle text-[0.9em] font-medium leading-none no-underline transition-colors';

export function UserMention({
  username,
  variant = 'inline',
}: {
  username: string;
  variant?: MentionVariant;
}) {
  const { t } = useTranslation('common');
  const { data: user, isError } = useQuery({
    queryKey: ['user', username],
    queryFn: () => getUserFn(username),
    staleTime: MENTION_STALE_TIME,
    meta: { silentError: true },
    retry: false,
  });

  if (isError) {
    return <span className="text-base-content/60">@{username}</span>;
  }

  const displayName = user?.username ?? username;
  const profilePath = `/user/${encodeURIComponent(displayName)}`;
  const level = user?.stats?.userLevel;

  if (variant === 'card') {
    return (
      <Link
        to={profilePath}
        onClick={stopPropagation}
        className="not-prose mention-chip surface relative my-2 flex w-full max-w-sm items-center gap-3 overflow-hidden p-3 no-underline transition-shadow hover:shadow-lg"
      >
        {user?.banner && (
          <OfflineImage
            src={user.banner}
            alt=""
            loading="lazy"
            className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-25"
          />
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-base-100 via-base-100/80 to-base-100/30" />
        <UserAvatar
          username={displayName}
          avatar={user?.avatar}
          containerClassName="relative h-12 w-12 shrink-0 rounded-full ring-2 ring-primary/40"
          textClassName="text-base font-semibold"
        />
        <div className="relative min-w-0">
          <p className="truncate font-bold text-base-content">
            @{displayName}
          </p>
          {level !== undefined ? (
            <span className="badge badge-primary badge-sm mt-1">
              {t('mentions.level', { level })}
            </span>
          ) : (
            !user && <span className="skeleton mt-1 block h-4 w-16" />
          )}
        </div>
      </Link>
    );
  }

  return (
    <Link
      to={profilePath}
      onClick={stopPropagation}
      className={`${INLINE_CHIP} bg-primary/10 py-0.5 pl-0.5 pr-2 text-primary hover:bg-primary/20`}
    >
      <UserAvatar
        username={displayName}
        avatar={user?.avatar}
        containerClassName="h-5 w-5 shrink-0 rounded-full"
        textClassName="text-[0.55rem] font-semibold"
      />
      <span className="truncate">@{displayName}</span>
    </Link>
  );
}

function MediaCover({
  media,
  className,
}: {
  media?: IMediaDocument;
  className: string;
}) {
  const blurAdult = useUserDataStore(
    (state) => state.user?.settings?.blurAdultContent ?? false
  );
  if (!media?.contentImage) {
    return <span className={`${className} block bg-base-300`} />;
  }
  const isAdultImage =
    media.type === 'vn' ? (media.isAdultImage ?? false) : media.isAdult;
  return (
    <OfflineImage
      src={media.contentImage}
      alt=""
      loading="lazy"
      className={`${className} object-cover ${isAdultImage && blurAdult ? 'blur-sm' : ''}`}
    />
  );
}

export function MediaMention({
  mediaType,
  contentId,
  label,
  variant = 'inline',
}: {
  mediaType: MentionableMediaType;
  contentId: string;
  label?: string;
  variant?: MentionVariant;
}) {
  const { t } = useTranslation('common');
  const { data: media, isError } = useQuery({
    queryKey: ['media', contentId, mediaType],
    queryFn: () => getMediaFn(contentId, mediaType),
    staleTime: MENTION_STALE_TIME,
    meta: { silentError: true },
    retry: false,
  });

  const title = media ? getMediaDisplayTitle(media) : label || contentId;
  const mediaPath = `/${encodeURIComponent(mediaType)}/${encodeURIComponent(contentId)}`;

  if (isError) {
    return <span className="text-base-content/60">{title}</span>;
  }

  if (variant === 'card') {
    const nativeTitle = media?.title?.contentTitleNative;
    return (
      <Link
        to={mediaPath}
        onClick={stopPropagation}
        className="not-prose mention-chip surface my-2 flex w-full max-w-md items-center gap-3 overflow-hidden p-2 pr-4 no-underline transition-shadow hover:shadow-lg"
      >
        <MediaCover media={media} className="h-20 w-14 shrink-0 rounded-field" />
        <div className="min-w-0 space-y-1">
          <p className="line-clamp-2 font-bold leading-snug text-base-content">
            {title}
          </p>
          {nativeTitle && nativeTitle !== title && (
            <p className="truncate text-sm text-base-content/60">
              {nativeTitle}
            </p>
          )}
          <span className="badge badge-ghost badge-sm">
            {t(MENTION_MEDIA_TYPE_LABEL_KEYS[mediaType])}
          </span>
        </div>
      </Link>
    );
  }

  return (
    <Link
      to={mediaPath}
      onClick={stopPropagation}
      title={title}
      className={`${INLINE_CHIP} bg-base-200 py-0.5 pl-0.5 pr-2 text-base-content hover:bg-base-300`}
    >
      <MediaCover media={media} className="h-5 w-3.5 shrink-0 rounded-sm" />
      <span className="max-w-[16rem] truncate">{title}</span>
    </Link>
  );
}

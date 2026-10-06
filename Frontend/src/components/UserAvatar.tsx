import { useEffect, useState } from 'react';
import { getAvatarInitials } from '../utils/avatar';
import AvatarFrame from './AvatarFrame';
import type { AvatarFrame as Frame, IUserCustomization } from '../types';

interface UserAvatarProps {
  username?: string;
  avatar?: string;
  alt?: string;
  containerClassName?: string;
  imageClassName?: string;
  fallbackClassName?: string;
  textClassName?: string;
  loading?: 'lazy' | 'eager';
  /** Equipped cosmetic ring drawn around the avatar. */
  frame?: Frame | null;
  customization?: IUserCustomization;
}

export default function UserAvatar({
  username,
  avatar,
  alt,
  containerClassName = 'w-10 h-10 rounded-full',
  imageClassName = 'w-full h-full rounded-full object-cover',
  fallbackClassName = 'w-full h-full rounded-full bg-base-300 flex items-center justify-center',
  textClassName = 'text-sm font-semibold',
  loading = 'lazy',
  frame,
  customization,
}: UserAvatarProps) {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [avatar]);

  const shouldShowImage = Boolean(avatar) && !imageFailed;

  const inner = (
    <div className={containerClassName}>
      {shouldShowImage ? (
        <img
          src={avatar}
          alt={alt ?? `${username ?? 'User'} avatar`}
          className={imageClassName}
          loading={loading}
          onError={() => setImageFailed(true)}
        />
      ) : (
        <div className={fallbackClassName}>
          <span className={textClassName}>{getAvatarInitials(username)}</span>
        </div>
      )}
    </div>
  );

  return <AvatarFrame frame={frame ?? customization?.avatarFrame} customization={customization}>{inner}</AvatarFrame>;
}

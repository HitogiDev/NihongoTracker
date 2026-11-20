import { EyeOff, ImageOff } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { postImageSrc } from '../../api/postsApi';
import type { IPostImage } from '../../types';

interface PostImagesProps {
  images: IPostImage[];
  username: string;
  sensitive: boolean;
}

const GRID_CLASSES: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-2',
  4: 'grid-cols-2',
};

function PostImage({
  image,
  index,
  username,
  sensitive,
  single,
  wide,
}: {
  image: IPostImage;
  index: number;
  username: string;
  sensitive: boolean;
  single: boolean;
  wide: boolean;
}) {
  const { t } = useTranslation('social');
  const [revealed, setRevealed] = useState(!sensitive);
  const [failed, setFailed] = useState(false);
  const src = postImageSrc(image);
  const alt = t('posts.imageAlt', { index: index + 1, username });
  const ratio =
    single && image.width && image.height
      ? Math.min(Math.max(image.width / image.height, 0.6), 2.4)
      : undefined;

  const frameClass = `relative overflow-hidden rounded-box bg-base-300 ${
    wide ? 'col-span-2' : ''
  } ${single ? (ratio ? 'max-h-[32rem]' : 'aspect-video') : wide ? 'aspect-video' : 'aspect-square'}`;

  if (failed) {
    return (
      <div
        className={`${frameClass} flex items-center justify-center gap-2 text-sm text-base-content/60`}
      >
        <ImageOff className="h-4 w-4" />
        {t('posts.imageFailed')}
      </div>
    );
  }

  return (
    <div
      className={frameClass}
      style={ratio ? { aspectRatio: String(ratio) } : undefined}
    >
      <a
        href={src}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={t('posts.openImage')}
        tabIndex={revealed ? 0 : -1}
        className="block h-full w-full"
      >
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className={`h-full w-full ${single ? 'object-contain' : 'object-cover'} ${
            revealed ? '' : 'scale-110 blur-xl'
          }`}
        />
      </a>
      {!revealed && (
        <button
          type="button"
          className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-base-300/40 text-sm font-medium"
          onClick={() => setRevealed(true)}
        >
          <EyeOff className="h-5 w-5" />
          {t('posts.reveal')}
        </button>
      )}
    </div>
  );
}

export default function PostImages({
  images,
  username,
  sensitive,
}: PostImagesProps) {
  if (images.length === 0) return null;
  const count = Math.min(images.length, 4);
  return (
    <div className={`mt-3 grid gap-1.5 ${GRID_CLASSES[count]}`}>
      {images.slice(0, 4).map((image, index) => (
        <PostImage
          key={image._id}
          image={image}
          index={index}
          username={username}
          sensitive={sensitive}
          single={count === 1}
          wide={count === 3 && index === 0}
        />
      ))}
    </div>
  );
}

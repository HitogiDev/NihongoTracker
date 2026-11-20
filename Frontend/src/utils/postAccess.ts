import type { IUser } from '../types';

type PostAccessUser = Pick<IUser, 'patreon' | 'roles'> | null | undefined;

export const POST_CONTENT_MAX_LENGTH = 4000;
export const POST_IMAGES_MAX = 4;
export const POST_UPLOAD_MAX_BYTES = 8 * 1024 * 1024;
export const POST_UPLOAD_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];

/** Keep aligned with `hasHostedPostImages` in the backend. */
export function canUploadPostImages(user: PostAccessUser): boolean {
  return Boolean(
    user?.roles?.includes('admin') ||
      (user?.patreon?.isActive &&
        (user.patreon.tier === 'enthusiast' ||
          user.patreon.tier === 'consumer')),
  );
}

/** Keep aligned with `hasPostDecorations` in the backend. */
export const canDecoratePosts = canUploadPostImages;

export function canUsePosts(
  user: PostAccessUser,
  postsEnabled: boolean,
): boolean {
  return Boolean(user && (postsEnabled || user.roles?.includes('admin')));
}

/** Keep aligned with `POST_IMAGE_HOSTS` in `Backend/src/services/remoteImage.ts`. */
const POST_IMAGE_HOSTS = new Set([
  'i.imgur.com',
  'files.catbox.moe',
  'i.ibb.co',
  'i.postimg.cc',
  'cdn.discordapp.com',
  'media.discordapp.net',
  'pbs.twimg.com',
  'i.redd.it',
  'preview.redd.it',
  'i.pinimg.com',
  'media.tenor.com',
  'i.giphy.com',
  'media.giphy.com',
  'media0.giphy.com',
  'media1.giphy.com',
  'media2.giphy.com',
  'media3.giphy.com',
  'media4.giphy.com',
  'upload.wikimedia.org',
  'cdn.myanimelist.net',
  's4.anilist.co',
  't.vndb.org',
  'images.igdb.com',
  'i.ytimg.com',
  'image.tmdb.org',
]);

export type ExternalImageCheck =
  | { ok: true; url: string }
  | { ok: false; reason: 'invalid' | 'host'; host?: string };

export function checkExternalImageUrl(value: string): ExternalImageCheck {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return { ok: false, reason: 'invalid' };
  }
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.port ||
    !POST_IMAGE_HOSTS.has(url.hostname)
  ) {
    return { ok: false, reason: 'host', host: url.hostname };
  }
  return { ok: true, url: url.href };
}

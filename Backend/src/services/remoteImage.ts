import type { IncomingMessage } from 'node:http';
import { get } from 'node:https';
import sharp from 'sharp';
import { customError } from '../middlewares/errorMiddleware.js';

const IMAGE_HOSTS = new Set([
  's4.anilist.co',
  't.vndb.org',
  'images.igdb.com',
  'books.google.com',
  'books.googleusercontent.com',
  'm.media-amazon.com',
  'images-na.ssl-images-amazon.com',
  'images-fe.ssl-images-amazon.com',
  'image.tmdb.org',
  'i.ytimg.com',
  'yt3.ggpht.com',
  'firebasestorage.googleapis.com',
]);
// Free users link post images from these hosts. The server fetches them, so keep the list explicit.
export const POST_IMAGE_HOSTS = new Set([
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
const MAX_BYTES = 5 * 1024 * 1024;
const POST_IMAGE_MAX_BYTES = 8 * 1024 * 1024;

type UrlValidator = (value: string) => URL;

interface DownloadOptions {
  validate?: UrlValidator;
  maxBytes?: number;
  /** Some hosts, such as Wikimedia, reject requests without a User-Agent. */
  headers?: Record<string, string>;
}

const POST_IMAGE_REQUEST_HEADERS = {
  'User-Agent': 'NihongoTrackerImageProxy/1.0',
  Accept: 'image/*',
};

function validateUrlForHosts(value: string, hosts: Set<string>): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new customError('Invalid image URL', 400);
  }
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.port ||
    !hosts.has(url.hostname)
  ) {
    throw new customError('Unsupported image URL', 400);
  }
  return url;
}

export function validateImageUrl(value: string): URL {
  return validateUrlForHosts(value, IMAGE_HOSTS);
}

export function validatePostImageUrl(value: string): URL {
  return validateUrlForHosts(value, POST_IMAGE_HOSTS);
}

function download(
  url: URL,
  redirects = 0,
  options: DownloadOptions = {}
): Promise<Buffer> {
  const { validate = validateImageUrl, maxBytes = MAX_BYTES, headers } = options;
  return new Promise((resolve, reject) => {
    const onResponse = (response: IncomingMessage) => {
      if (
        response.statusCode &&
        [301, 302, 303, 307, 308].includes(response.statusCode)
      ) {
        response.destroy();
        try {
          if (redirects >= 3 || !response.headers.location)
            throw new customError('Too many image redirects', 400);
          resolve(
            download(
              validate(new URL(response.headers.location, url).href),
              redirects + 1,
              options
            )
          );
        } catch (error) {
          reject(error);
        }
        return;
      }
      if (
        response.statusCode !== 200 ||
        !response.headers['content-type']?.startsWith('image/')
      ) {
        response.destroy();
        reject(new customError('Image download failed', 400));
        return;
      }
      const chunks: Buffer[] = [];
      let size = 0;
      response.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > maxBytes)
          request.destroy(new customError('Image is too large', 413));
        else chunks.push(chunk);
      });
      response.on('end', () => resolve(Buffer.concat(chunks)));
      response.on('error', reject);
    };
    const request = headers
      ? get(url, { headers }, onResponse)
      : get(url, onResponse);
    const timeout = setTimeout(
      () => request.destroy(new customError('Image download timed out', 504)),
      5000
    );
    request.on('close', () => clearTimeout(timeout));
    request.on('error', reject);
  });
}

export async function downloadAverageColorImage(
  value: string
): Promise<Buffer> {
  const buffer = await download(validateImageUrl(value));
  return sharp(buffer, { limitInputPixels: 16_000_000, animated: false })
    .resize(50, 50, { fit: 'inside' })
    .png()
    .toBuffer();
}

// Share cards draw these images on a canvas. Same-origin bytes keep the canvas exportable.
export async function downloadCardImage(value: string): Promise<Buffer> {
  const buffer = await download(validateImageUrl(value));
  return sharp(buffer, { limitInputPixels: 40_000_000, animated: false })
    .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 86 })
    .toBuffer();
}

const POST_IMAGE_MAX_PIXELS = 40_000_000;
// Animated images multiply the decode cost by their frame count.
const POST_IMAGE_MAX_TOTAL_PIXELS = 150_000_000;

/** Fetch an external post image and re-encode it, so viewers never contact the external host. */
export async function downloadPostImage(value: string): Promise<Buffer> {
  const buffer = await download(validatePostImageUrl(value), 0, {
    validate: validatePostImageUrl,
    maxBytes: POST_IMAGE_MAX_BYTES,
    headers: POST_IMAGE_REQUEST_HEADERS,
  });
  return (await encodePostImageWithInfo(buffer)).data;
}

/** Re-encode a post image as WebP. Animated GIF and WebP input keeps its animation. */
export async function encodePostImageWithInfo(
  buffer: Buffer
): Promise<{ data: Buffer; width: number; height: number }> {
  let metadata: sharp.Metadata;
  try {
    metadata = await sharp(buffer, {
      limitInputPixels: POST_IMAGE_MAX_PIXELS,
    }).metadata();
  } catch {
    throw new customError('Invalid image', 400);
  }
  const width = metadata.width ?? 0;
  const frameHeight = metadata.pageHeight ?? metadata.height ?? 0;
  const pages = metadata.pages ?? 1;
  if (!width || !frameHeight) throw new customError('Invalid image', 400);
  const animated = pages > 1;
  if (width * frameHeight * pages > POST_IMAGE_MAX_TOTAL_PIXELS) {
    throw new customError('Image is too large', 413);
  }
  try {
    const { data, info } = await sharp(buffer, {
      limitInputPixels: animated
        ? POST_IMAGE_MAX_TOTAL_PIXELS
        : POST_IMAGE_MAX_PIXELS,
      animated,
    })
      .rotate()
      .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });
    return {
      data,
      width: info.width,
      height: animated && info.pageHeight ? info.pageHeight : info.height,
    };
  } catch {
    throw new customError('Invalid image', 400);
  }
}

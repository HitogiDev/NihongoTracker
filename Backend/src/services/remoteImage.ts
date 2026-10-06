import { get } from 'node:https';
import sharp from 'sharp';
import { customError } from '../middlewares/errorMiddleware.js';

const IMAGE_HOSTS = new Set([
  's4.anilist.co',
  't.vndb.org',
  'images.igdb.com',
  'books.google.com',
  'books.googleusercontent.com',
  'image.tmdb.org',
  'i.ytimg.com',
  'yt3.ggpht.com',
  'firebasestorage.googleapis.com',
]);
const MAX_BYTES = 5 * 1024 * 1024;

export function validateImageUrl(value: string): URL {
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
    !IMAGE_HOSTS.has(url.hostname)
  ) {
    throw new customError('Unsupported image URL', 400);
  }
  return url;
}

function download(url: URL, redirects = 0): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const request = get(url, (response) => {
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
              validateImageUrl(new URL(response.headers.location, url).href),
              redirects + 1
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
        if (size > MAX_BYTES)
          request.destroy(new customError('Image is too large', 413));
        else chunks.push(chunk);
      });
      response.on('end', () => resolve(Buffer.concat(chunks)));
      response.on('error', reject);
    });
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

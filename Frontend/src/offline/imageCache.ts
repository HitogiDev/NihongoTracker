import { delMany, entries, get, set } from 'idb-keyval';
import { imageCacheStore } from './idbStores';
import { apiBaseUrl } from '../utils/nativeRuntime';

interface CachedImage {
  blob: Blob;
  storedAt: number;
}
const ttl = 30 * 86400000;
const inFlight = new Map<string, Promise<Blob | null>>();
const key = (userId: string, url: string) => `nihongo:image:${userId}:${url}`;

export function mobileImageUrl(src: string) {
  if (src.startsWith('/uploads/')) return new URL(src, apiBaseUrl()).href;
  return src;
}

export async function cachedImage(userId: string, src: string) {
  const image = await get<CachedImage>(
    key(userId, mobileImageUrl(src)),
    imageCacheStore,
  );
  return image && Date.now() - image.storedAt < ttl ? image.blob : null;
}

export async function cacheImage(userId: string, src: string) {
  const url = mobileImageUrl(src);
  if (!/^https?:\/\//.test(url)) return null;
  const imageKey = key(userId, url);
  if (inFlight.has(imageKey)) return inFlight.get(imageKey)!;
  const request = (async () => {
    const stored = await cachedImage(userId, url);
    if (stored) return stored;
    const response = await fetch(url, {
      signal: AbortSignal.timeout(12000),
      credentials: 'omit',
    });
    if (!response.ok) return null;
    const blob = await response.blob();
    if (!blob.type.startsWith('image/') || blob.size > 4 * 1024 * 1024)
      return null;
    await set(
      imageKey,
      { blob, storedAt: Date.now() } satisfies CachedImage,
      imageCacheStore,
    );
    return blob;
  })()
    .catch(() => null)
    .finally(() => inFlight.delete(imageKey));
  inFlight.set(imageKey, request);
  return request;
}

export async function cacheResponseImages(userId: string, data: unknown) {
  const urls = new Set<string>();
  const visit = (value: unknown) => {
    if (!value || typeof value !== 'object') return;
    for (const [name, child] of Object.entries(value)) {
      if (
        ['avatar', 'banner', 'contentImage', 'coverImage'].includes(name) &&
        typeof child === 'string'
      )
        urls.add(child);
      else if (typeof child === 'object') visit(child);
    }
  };
  visit(data);
  const images = [...urls];
  for (let index = 0; index < images.length; index += 3) {
    await Promise.all(
      images.slice(index, index + 3).map((url) => cacheImage(userId, url)),
    );
  }
}

export async function pruneImageCache(userId: string) {
  const prefix = `nihongo:image:${userId}:`;
  const now = Date.now();
  const images = (await entries<string, CachedImage>(imageCacheStore))
    .filter(([entry]) => typeof entry === 'string' && entry.startsWith(prefix))
    .sort(([, left], [, right]) => (right?.storedAt ?? 0) - (left?.storedAt ?? 0));
  const stale = images
    .filter(
      ([, cached], index) =>
        index >= 300 || !cached || now - cached.storedAt > ttl,
    )
    .map(([entry]) => entry);
  if (stale.length) await delMany(stale, imageCacheStore);
}

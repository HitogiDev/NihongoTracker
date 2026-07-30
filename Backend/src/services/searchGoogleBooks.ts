import axios from 'axios';
import { IMediaDocument } from '../types.js';

const GOOGLE_BOOKS_API = 'https://www.googleapis.com/books/v1/volumes';

interface IGoogleBookImageLinks {
  thumbnail?: string;
  smallThumbnail?: string;
  small?: string;
  medium?: string;
  large?: string;
  extraLarge?: string;
}

interface IGoogleBookVolumeInfo {
  title?: string;
  subtitle?: string;
  authors?: string[];
  publishedDate?: string;
  description?: string;
  pageCount?: number;
  language?: string;
  imageLinks?: IGoogleBookImageLinks;
  industryIdentifiers?: { type: string; identifier: string }[];
}

interface IGoogleBookVolume {
  id: string;
  volumeInfo?: IGoogleBookVolumeInfo;
}

interface IGoogleBooksResponse {
  totalItems: number;
  items?: IGoogleBookVolume[];
}

/** Google Books thumbnails come as http with a page-curl overlay — clean them up. */
function normalizeImage(url?: string): string | undefined {
  if (!url) return undefined;
  return url.replace(/^http:\/\//, 'https://').replace(/&edge=curl/, '');
}

function pickImage(links?: IGoogleBookImageLinks): string | undefined {
  if (!links) return undefined;
  return normalizeImage(
    links.extraLarge ||
      links.large ||
      links.medium ||
      links.thumbnail ||
      links.small ||
      links.smallThumbnail
  );
}

function withKey(url: string): string {
  const key = process.env.GOOGLE_BOOKS_API_KEY;
  return key ? `${url}${url.includes('?') ? '&' : '?'}key=${key}` : url;
}

function normalizeVolume(volume: IGoogleBookVolume): IMediaDocument | null {
  const info = volume.volumeInfo;
  if (!info || !info.title) return null;

  const isJapanese = info.language === 'ja';
  const nativeTitle = info.subtitle
    ? `${info.title}: ${info.subtitle}`
    : info.title;
  const image = pickImage(info.imageLinks);

  const doc: IMediaDocument = {
    contentId: `gbooks-${volume.id}`,
    title: {
      contentTitleNative: nativeTitle,
      contentTitleRomaji: undefined,
      contentTitleEnglish: isJapanese ? undefined : nativeTitle,
    },
    contentImage: image,
    coverImage: image,
    type: 'book',
    isAdult: false,
  };

  if (info.description) {
    doc.description = [
      {
        description: info.description,
        language: isJapanese ? 'jpn' : 'eng',
      },
    ];
  }
  if (typeof info.pageCount === 'number') doc.pageCount = info.pageCount;
  if (info.authors?.length) doc.authors = info.authors;
  if (info.publishedDate) doc.publishedDate = info.publishedDate;

  return doc;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Short-lived in-memory cache. Typing (and re-typing) the same query fires many
// identical searches; Google Books rate-limits bursts with 429, so caching both
// speeds up repeats and keeps us under the quota — the main cause of the search
// feeling flaky/slow.
const SEARCH_CACHE_TTL_MS = 10 * 60 * 1000;
const searchCache = new Map<string, { at: number; data: IMediaDocument[] }>();

export async function searchGoogleBooks(
  query: string
): Promise<IMediaDocument[]> {
  const trimmed = query?.trim();
  if (!trimmed) return [];

  const cacheKey = trimmed.toLowerCase();
  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() - cached.at < SEARCH_CACHE_TTL_MS) {
    return cached.data;
  }

  const url = withKey(
    `${GOOGLE_BOOKS_API}?q=${encodeURIComponent(
      trimmed
    )}&langRestrict=ja&maxResults=20&printType=books&orderBy=relevance`
  );

  // Retry once on a 429 (transient burst rate-limit) before giving up, so a
  // momentary throttle doesn't surface as an empty "No results" flicker.
  const MAX_ATTEMPTS = 2;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const { data } = await axios.get<IGoogleBooksResponse>(url);
      const results = (data.items ?? [])
        .map(normalizeVolume)
        .filter((doc): doc is IMediaDocument => doc !== null);

      // Only cache non-empty responses. An empty result can be a soft throttle
      // rather than a genuine "no matches"; caching it would wrongly pin the
      // query to empty for the whole TTL. Empty results just aren't cached, so
      // the next keystroke retries.
      if (results.length > 0) {
        searchCache.set(cacheKey, { at: Date.now(), data: results });
      }
      return results;
    } catch (error) {
      const status = axios.isAxiosError(error)
        ? error.response?.status
        : undefined;

      if (status === 429 && attempt < MAX_ATTEMPTS) {
        await sleep(400);
        continue;
      }

      // Degrade to an empty result set instead of surfacing a 500 to the log
      // form. Do NOT cache this — it's a failure, not a real "no results", so
      // the next keystroke should retry. A persistent 429 usually means
      // GOOGLE_BOOKS_API_KEY is unset (low keyless quota).
      console.warn(
        `Google Books search failed${status ? ` (status ${status})` : ''}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return [];
    }
  }

  return [];
}

export async function getGoogleBook(
  volumeId: string
): Promise<IMediaDocument | null> {
  // Accept both the raw Google id and our `gbooks-` prefixed contentId.
  const id = volumeId.replace(/^gbooks-/, '');
  if (!id) return null;

  try {
    const { data } = await axios.get<IGoogleBookVolume>(
      withKey(`${GOOGLE_BOOKS_API}/${encodeURIComponent(id)}`)
    );
    return normalizeVolume(data);
  } catch {
    return null;
  }
}

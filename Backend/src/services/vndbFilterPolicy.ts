/**
 * Maps VNDB's ISO 639-1 language codes to the ISO 639-2 codes used
 * in NihongoTracker's description.language field.
 * Returns null for languages we do not store descriptions for.
 */
export function mapLanguageCode(
  lang: string | null
): 'eng' | 'jpn' | 'spa' | null {
  if (!lang) return null;

  switch (lang.toLowerCase()) {
    case 'en':
      return 'eng';
    case 'ja':
      return 'jpn';
    case 'es':
      return 'spa';
    default:
      return null;
  }
}

/**
 * Build the VNDB cover image URL from an image ID string like "cv81576".
 *
 * URL format: https://t.vndb.org/cv/{last2digits}/{number}.jpg
 * Example: cv81576 → https://t.vndb.org/cv/76/81576.jpg
 *
 * Returns null if the imageId is absent or does not match the expected format.
 */
export function buildVndbImageUrl(imageId: string | null): string | null {
  if (!imageId) return null;

  // Strip prefix: supports "cv", "sf", etc.
  const match = imageId.match(/^[a-z]+(\d+)$/);
  if (!match) return null;

  const prefix = imageId.replace(/\d+$/, ''); // e.g. "cv"
  const number = match[1]; // e.g. "81576"
  const last2 = number.slice(-2).padStart(2, '0'); // e.g. "76"

  return `https://t.vndb.org/${prefix}/${last2}/${number}.jpg`;
}

/**
 * Parse VNDB's pipe-separated or newline-separated alias field into a string array.
 * VNDB uses newlines as separators in the dump.
 */
export function parseVnAliases(alias: string | null): string[] {
  if (!alias) return [];

  return alias
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Screenshot metadata from the `images` table of the VNDB database dump. */
export interface IVndbScreenshotInfo {
  width: number | null;
  height: number | null;
  /** VNDB sexual rating average, 0 to 200. Unvoted images use 200. */
  sexualAvg: number;
  /** VNDB violence rating average, 0 to 200. Unvoted images use 0. */
  violenceAvg: number;
}

export interface IVnScreenshot {
  url: string;
  thumbnailUrl: string;
  width: number | null;
  height: number | null;
  /** true when the community rates the image suggestive or explicit, or brutal. */
  isAdult: boolean;
}

/**
 * Store at most this many screenshots for each VN.
 * The images stay on the VNDB CDN, so each entry costs only a few bytes.
 */
export const MAX_VN_SCREENSHOTS = 12;

/**
 * Build the full-size and thumbnail URLs of a VNDB screenshot ID like "sf12345".
 * Full size: https://t.vndb.org/sf/{last2}/{number}.jpg
 * Thumbnail: https://t.vndb.org/st/{last2}/{number}.jpg
 */
export function buildVndbScreenshotUrls(
  imageId: string | null
): { url: string; thumbnailUrl: string } | null {
  if (!imageId) return null;
  const match = imageId.match(/^sf(\d+)$/);
  if (!match) return null;

  const number = match[1];
  const last2 = number.slice(-2).padStart(2, '0');
  return {
    url: `https://t.vndb.org/sf/${last2}/${number}.jpg`,
    thumbnailUrl: `https://t.vndb.org/st/${last2}/${number}.jpg`,
  };
}

/** Sort screenshot IDs by number so each sync gives the same order. */
export function compareVndbImageIds(a: string, b: string): number {
  return Number(a.replace(/^\D+/, '')) - Number(b.replace(/^\D+/, ''));
}

/**
 * Convert the screenshot IDs of one VN into stored entries.
 * Unknown IDs are kept as adult, because VNDB treats unvoted images as explicit.
 */
export function buildVnScreenshots(
  imageIds: string[],
  infoMap: Map<string, IVndbScreenshotInfo>
): IVnScreenshot[] {
  const result: IVnScreenshot[] = [];
  const unique = [...new Set(imageIds)].sort(compareVndbImageIds);

  for (const imageId of unique) {
    if (result.length >= MAX_VN_SCREENSHOTS) break;
    const urls = buildVndbScreenshotUrls(imageId);
    if (!urls) continue;

    const info = infoMap.get(imageId);
    result.push({
      ...urls,
      width: info?.width ?? null,
      height: info?.height ?? null,
      isAdult: info ? info.sexualAvg >= 100 || info.violenceAvg >= 150 : true,
    });
  }

  return result;
}

/**
 * Pick a banner image from the screenshots.
 * Use only safe images, and prefer landscape images at least 640 px wide.
 */
export function pickVnBannerScreenshot(
  screenshots: IVnScreenshot[]
): string | null {
  const safe = screenshots.filter((shot) => !shot.isAdult);
  const wide = safe.find(
    (shot) =>
      (shot.width ?? 0) >= 640 && (shot.width ?? 0) >= (shot.height ?? 0)
  );
  return (wide ?? safe[0])?.url ?? null;
}

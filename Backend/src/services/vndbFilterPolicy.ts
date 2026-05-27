/**
 * Maps VNDB's ISO 639-1 language codes to the ISO 639-2 codes used
 * in NihongoTracker's description.language field.
 * Returns null for languages we don't store descriptions for.
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
 * Returns null if the imageId is absent or doesn't match the expected format.
 */
export function buildVndbImageUrl(imageId: string | null): string | null {
  if (!imageId) return null;

  // Strip prefix — supports "cv", "sf", etc.
  const match = imageId.match(/^[a-z]+(\d+)$/);
  if (!match) return null;

  const prefix = imageId.replace(/\d+$/, ''); // e.g. "cv"
  const number = match[1]; // e.g. "81576"
  const last2 = number.slice(-2); // e.g. "76"

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

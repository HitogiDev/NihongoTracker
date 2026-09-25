export const IGDB_MAIN_GAME_CATEGORY = 0;

const JAPANESE_SCRIPT_REGEX = /[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9fff]/;
const JAPANESE_NATIVE_MARKER = '\u65e5\u672c\u8a9e';

function normalizeLabel(value: string): string {
  return value.trim().toLowerCase();
}

function hasJapaneseLocaleToken(value: string): boolean {
  return /(^|[^a-z0-9])ja(?:[_-][a-z0-9]+)?($|[^a-z0-9])/.test(value);
}

export function isMainGameCategory(
  category: number | null | undefined
): boolean {
  return category === IGDB_MAIN_GAME_CATEGORY;
}

export function hasJapaneseTextHeuristic(
  value: string | null | undefined
): boolean {
  if (!value) {
    return false;
  }

  if (JAPANESE_SCRIPT_REGEX.test(value)) {
    return true;
  }

  const normalized = normalizeLabel(value);

  return (
    normalized.includes('japanese') ||
    normalized.includes('jpn') ||
    normalized.includes('nihongo') ||
    normalized.includes(JAPANESE_NATIVE_MARKER) ||
    hasJapaneseLocaleToken(normalized)
  );
}

export function hasJapaneseLanguageMetadata(
  values: Array<string | null | undefined>
): boolean {
  return values.some((value) => hasJapaneseTextHeuristic(value));
}

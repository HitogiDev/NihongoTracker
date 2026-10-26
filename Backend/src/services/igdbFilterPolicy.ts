// IGDB types: main game, standalone expansion, remake, remaster, expanded game, and port.
const STANDALONE_GAME_TYPES = new Set([0, 4, 8, 9, 10, 11]);

const JAPAN_RELEASE_REGION_ID = 5;
const JAPAN_RELEASE_REGION_NAME = 'japan';

const JAPANESE_SCRIPT_REGEX =/[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9fff]/;
const JAPANESE_NATIVE_MARKER = '\u65e5\u672c\u8a9e';

function normalizeLabel(value: string): string {
  return value.trim().toLowerCase();
}

function hasJapaneseLocaleToken(value: string): boolean {
  return /(^|[^a-z0-9])ja(?:[_-][a-z0-9]+)?($|[^a-z0-9])/.test(value);
}

export function isSupportedGameType(
  gameType: number | null | undefined
): boolean {
  return gameType != null && STANDALONE_GAME_TYPES.has(gameType);
}

// IGDB lists Japan as region 5. Some games have no Japanese language support
// or Japanese title, so a Japan release is the only signal for them.
export function isJapanReleaseRegion(
  region: number | string | null | undefined
): boolean {
  if (region == null) {
    return false;
  }

  return (
    Number(region) === JAPAN_RELEASE_REGION_ID ||
    normalizeLabel(String(region)) === JAPAN_RELEASE_REGION_NAME
  );
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
